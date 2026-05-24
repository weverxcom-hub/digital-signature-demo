import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { computeSignatureHmac, generateSignatureToken } from "@/lib/signature";
import { deriveArchiveStatus } from "@/lib/archiveSignature";
import { rateLimitByUser } from "@/lib/rateLimit";

const signSchema = z.object({
  signatoryId: z.string().min(1),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rl = await rateLimitByUser(req, "archiveSign", session.user.id);
  if (rl) return rl;
  const body = await req.json().catch(() => null);
  const parsed = signSchema.safeParse(body);
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
            signatures: true,
            requiredSignatories: { select: { signatoryId: true } },
          },
        });
        if (!archive) {
          throw new Response(JSON.stringify({ error: "Archive not found" }), {
            status: 404,
          });
        }
        const hasActiveDuplicate = archive.signatures.some(
          (s) => s.signatoryId === parsed.data.signatoryId && !s.revokedAt
        );
        if (hasActiveDuplicate) {
          throw new Response(
            JSON.stringify({
              error:
                "This signatory already has an active signature on this archive. Revoke it before re-signing.",
            }),
            { status: 409 }
          );
        }
        const signatory = await tx.signatory.findUnique({
          where: { id: parsed.data.signatoryId },
        });
        if (!signatory || signatory.deletedAt || !signatory.active) {
          throw new Response(
            JSON.stringify({ error: "Signatory not found or inactive" }),
            { status: 400 }
          );
        }

        const token = generateSignatureToken();
        const signedAt = new Date();
        const hmac = computeSignatureHmac(
          {
            archiveId: archive.id,
            number: archive.number,
            subject: archive.subject,
            issuedAt: archive.issuedAt,
            signatoryId: signatory.id,
            signatoryName: signatory.name,
            signatoryPosition: signatory.position,
            signedAt,
          },
          token
        );

        const created = await tx.archiveSignature.create({
          data: {
            archiveId: archive.id,
            signatoryId: signatory.id,
            signatoryName: signatory.name,
            signatoryPosition: signatory.position,
            signatoryUnit: signatory.unit,
            token,
            hmac,
            signedById: session.user.id,
            signedAt,
          },
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
          signature: created,
          audit: {
            entityId: archive.id,
            metadata: {
              signatoryId: signatory.id,
              signatoryName: signatory.name,
              token,
            },
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err) {
    if (err instanceof Response) return err;
    const errorCode =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code?: string }).code
        : undefined;
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (errorCode === "P2002" || errorCode === "P2034")
    ) {
      return NextResponse.json(
        {
          error:
            "This signatory already has an active signature on this archive. Revoke it before re-signing.",
        },
        { status: 409 }
      );
    }
    throw err;
  }

  await logAudit({
    action: "SIGN",
    entityType: "Archive",
    entityId: result.audit.entityId,
    userId: session.user.id,
    metadata: result.audit.metadata,
  });

  return NextResponse.json(result.signature, { status: 201 });
}
