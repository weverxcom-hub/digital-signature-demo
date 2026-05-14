import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
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
  const archive = await prisma.archive.findUnique({
    where: { id: params.id },
    include: {
      signatures: { orderBy: { signedAt: "desc" } },
      requiredSignatories: { select: { signatoryId: true } },
    },
  });
  if (!archive) {
    return NextResponse.json({ error: "Archive not found" }, { status: 404 });
  }
  const target = parsed.data.signatureId
    ? archive.signatures.find((s) => s.id === parsed.data.signatureId)
    : archive.signatures.find((s) => !s.revokedAt);
  if (!target) {
    return NextResponse.json(
      { error: "No matching signature on this archive" },
      { status: 404 }
    );
  }
  if (target.revokedAt) {
    return NextResponse.json({ error: "Signature already revoked" }, { status: 409 });
  }
  const updated = await prisma.archiveSignature.update({
    where: { id: target.id },
    data: {
      revokedAt: new Date(),
      revokedReason: parsed.data.reason,
      revokedById: session.user.id,
    },
  });

  const remaining = archive.signatures.map((s) =>
    s.id === target.id
      ? { ...s, revokedAt: updated.revokedAt }
      : s
  );
  const requiredIds = archive.requiredSignatories.map((r) => r.signatoryId);
  await prisma.archive.update({
    where: { id: archive.id },
    data: { status: deriveArchiveStatus(remaining, requiredIds) },
  });

  await logAudit({
    action: "SIGN_REVOKE",
    entityType: "Archive",
    entityId: archive.id,
    userId: session.user.id,
    metadata: { reason: parsed.data.reason, signatureId: target.id },
  });
  return NextResponse.json(updated);
}
