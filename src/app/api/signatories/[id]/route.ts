import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  position: z.string().min(2).max(200).optional(),
  unit: z.string().max(200).optional().nullable(),
  nip: z.string().max(50).optional().nullable(),
  active: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const signatory = await prisma.signatory.findUnique({ where: { id: params.id } });
  if (!signatory || signatory.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(signatory);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const existing = await prisma.signatory.findUnique({ where: { id: params.id } });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const updated = await prisma.signatory.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.position !== undefined && { position: parsed.data.position }),
      ...(parsed.data.unit !== undefined && { unit: parsed.data.unit || null }),
      ...(parsed.data.nip !== undefined && { nip: parsed.data.nip || null }),
      ...(parsed.data.active !== undefined && { active: parsed.data.active }),
    },
  });
  await logAudit({
    action: "UPDATE",
    entityType: "Signatory",
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
  const existing = await prisma.signatory.findUnique({ where: { id: params.id } });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.signatory.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), active: false },
  });
  await logAudit({
    action: "DELETE",
    entityType: "Signatory",
    entityId: params.id,
    userId: session.user.id,
  });
  return NextResponse.json({ ok: true });
}
