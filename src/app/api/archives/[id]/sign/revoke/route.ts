import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions, isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { deriveArchiveStatus } from "@/lib/archiveSignature";

const revokeSchema = z.object({
  reason: z.string().min(3).max(500),
  // Optional — when omitted, the most recent active signature is revoked.
  signatureId: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdmin(session.user.role)) {
    return NextResponse.json(
      { error: "Only a super admin can revoke a signature." },
      { status: 403 }
    );
  }
  const body = await req.json().catch(() => null);
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  let result;
  try {
    result = await prisma.$transaction(
      async (tx) => {
        const archive = await tx.archive.findUnique({
          where: { id: params.id },
          include: {
            signatures: { orderBy: { signedAt: "desc" } },
            requiredSignatories: { select: { signatoryId: true } },
          },
        });
        if (!archive) {
          throw new Response(JSON.stringify({ error: "Archive not found" }), {
            status: 404,
          });
        }
        const target = parsed.data.signatureId
          ? archive.signatures.find((s) => s.id === parsed.data.signatureId)
          : archive.signatures.find((s) => !s.revokedAt);
        if (!target) {
          throw new Response(
            JSON.stringify({ error: "No matching signature on this archive" }),
            { status: 404 }
          );
        }
        if (target.revokedAt) {
          throw new Response(JSON.stringify({ error: "Signature already revoked" }), {
            status: 409,
          });
        }

        const updateResult = await tx.archiveSignature.updateMany({
          where: { id: target.id, archiveId: archive.id, revokedAt: null },
          data: {
            revokedAt: new Date(),
            revokedReason: parsed.data.reason,
            revokedById: session.user.id,
          },
        });
        if (updateResult.count !== 1) {
          throw new Response(JSON.stringify({ error: "Signature already revoked" }), {
            status: 409,
          });
        }

        const updated = await tx.archiveSignature.findUniqueOrThrow({
          where: { id: target.id },
        });
        const signatures = await tx.archiveSignature.findMany({
          where: { archiveId: archive.id },
        });
        const requiredIds = archive.requiredSignatories.map((r) => r.signatoryId);
        await tx.archive.update({
          where: { id: archive.id },
          data: { status: deriveArchiveStatus(signatures, requiredIds) },
        });

        return {
          updated,
          audit: {
            entityId: archive.id,
            metadata: { reason: parsed.data.reason, signatureId: target.id },
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  await logAudit({
    action: "SIGN_REVOKE",
    entityType: "Archive",
    entityId: result.audit.entityId,
    userId: session.user.id,
    metadata: result.audit.metadata,
  });
  return NextResponse.json(result.updated);
}
