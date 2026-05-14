import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getOrCreateOrganizationProfile } from "@/lib/profile";

const setupSchema = z.object({
  organizationName: z.string().min(2).max(200),
  adminName: z.string().min(2).max(100),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).max(200),
});

export async function GET() {
  const userCount = await prisma.user.count();
  return NextResponse.json({ needsSetup: userCount === 0 });
}

export async function POST(req: Request) {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return NextResponse.json(
      { error: "Setup already completed. An admin user already exists." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { organizationName, adminName, adminEmail, adminPassword } = parsed.data;
  const hashed = await bcrypt.hash(adminPassword, 10);

  const user = await prisma.user.create({
    data: {
      name: adminName,
      email: adminEmail.toLowerCase(),
      password: hashed,
      role: "SUPER_ADMIN",
    },
  });

  await getOrCreateOrganizationProfile();
  await prisma.organizationProfile.update({
    where: { id: "default" },
    data: {
      name: organizationName,
      setupComplete: true,
    },
  });

  await logAudit({
    action: "USER_CREATE",
    entityType: "User",
    entityId: user.id,
    userId: user.id,
    metadata: { role: "SUPER_ADMIN", viaSetup: true },
  });

  return NextResponse.json({ ok: true, userId: user.id });
}
