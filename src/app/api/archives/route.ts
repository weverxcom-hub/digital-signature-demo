import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const archiveSchema = z.object({
  number: z.string().min(1).max(200),
  subject: z.string().min(2).max(500),
  description: z.string().max(2000).optional().nullable(),
  issuedAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  requiredSignatoryIds: z.array(z.string().min(1)).max(20).optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const rawTake = Number(url.searchParams.get("take") ?? "50");
  const rawSkip = Number(url.searchParams.get("skip") ?? "0");
  const take = Number.isFinite(rawTake)
    ? Math.min(Math.max(Math.trunc(rawTake), 1), 100)
    : 50;
  const skip = Number.isFinite(rawSkip) ? Math.max(Math.trunc(rawSkip), 0) : 0;
  const where = q
    ? {
        OR: [
          { number: { contains: q, mode: "insensitive" as const } },
          { subject: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : undefined;
  const [items, total] = await Promise.all([
    prisma.archive.findMany({
      where,
      include: {
        signatures: {
          select: {
            id: true,
            token: true,
            signedAt: true,
            revokedAt: true,
            signatoryId: true,
            signatoryName: true,
            signatoryPosition: true,
          },
          orderBy: { signedAt: "desc" },
        },
        requiredSignatories: {
          select: {
            signatoryId: true,
            signatory: { select: { id: true, name: true, position: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.archive.count({ where }),
  ]);
  return NextResponse.json({ items, total, take, skip });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = archiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // De-dupe and validate the required-signers list before we open the
  // transaction so we can return a clean 400 if any ID is bad.
  const requiredIds = Array.from(
    new Set(parsed.data.requiredSignatoryIds ?? [])
  );
  if (requiredIds.length > 0) {
    const found = await prisma.signatory.findMany({
      where: { id: { in: requiredIds }, deletedAt: null, active: true },
      select: { id: true },
    });
    if (found.length !== requiredIds.length) {
      return NextResponse.json(
        { error: "One or more required signatories are missing or inactive" },
        { status: 400 }
      );
    }
  }

  const created = await prisma.archive.create({
    data: {
      number: parsed.data.number,
      subject: parsed.data.subject,
      description: parsed.data.description || null,
      issuedAt: new Date(parsed.data.issuedAt),
      status: requiredIds.length > 0 ? "PENDING" : "DRAFT",
      createdById: session.user.id,
      requiredSignatories: requiredIds.length
        ? {
            create: requiredIds.map((signatoryId) => ({ signatoryId })),
          }
        : undefined,
    },
  });
  await logAudit({
    action: "CREATE",
    entityType: "Archive",
    entityId: created.id,
    userId: session.user.id,
    metadata: requiredIds.length
      ? { requiredSignatoryIds: requiredIds }
      : undefined,
  });
  return NextResponse.json(created, { status: 201 });
}
