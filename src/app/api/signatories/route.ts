import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const signatorySchema = z.object({
  name: z.string().min(2).max(200),
  position: z.string().min(2).max(200),
  unit: z.string().max(200).optional().nullable(),
  nip: z.string().max(50).optional().nullable(),
  active: z.boolean().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const signatories = await prisma.signatory.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(signatories);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = signatorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const created = await prisma.signatory.create({
    data: {
      name: parsed.data.name,
      position: parsed.data.position,
      unit: parsed.data.unit || null,
      nip: parsed.data.nip || null,
      active: parsed.data.active ?? true,
    },
  });
  await logAudit({
    action: "CREATE",
    entityType: "Signatory",
    entityId: created.id,
    userId: session.user.id,
  });
  return NextResponse.json(created, { status: 201 });
}
