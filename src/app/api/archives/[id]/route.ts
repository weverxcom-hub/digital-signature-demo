import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  number: z.string().min(1).max(200).optional(),
  subject: z.string().min(2).max(500).optional(),
  description: z.string().max(2000).optional().nullable(),
  issuedAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")
    .optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const archive = await prisma.archive.findUnique({
    where: { id: params.id },
    include: {
      signatures: { include: { signatory: true }, orderBy: { signedAt: "desc" } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!archive) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(archive);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const existing = await prisma.archive.findUnique({
    where: { id: params.id },
    include: { signatures: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.signatures.some((s) => !s.revokedAt)) {
    return NextResponse.json(
      { error: "Cannot edit a signed archive. Revoke the signature first." },
      { status: 409 }
    );
  }
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const updated = await prisma.archive.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.number !== undefined && { number: parsed.data.number }),
      ...(parsed.data.subject !== undefined && { subject: parsed.data.subject }),
      ...(parsed.data.description !== undefined && {
        description: parsed.data.description || null,
      }),
      ...(parsed.data.issuedAt !== undefined && {
        issuedAt: new Date(parsed.data.issuedAt),
      }),
    },
  });
  await logAudit({
    action: "UPDATE",
    entityType: "Archive",
    entityId: updated.id,
    userId: session.user.id,
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const existing = await prisma.archive.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.archive.delete({ where: { id: params.id } });
  await logAudit({
    action: "DELETE",
    entityType: "Archive",
    entityId: params.id,
    userId: session.user.id,
  });
  return NextResponse.json({ ok: true });
}
