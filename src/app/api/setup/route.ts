import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

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
  const body = await req.json().catch(() => null);
  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { organizationName, adminName, adminEmail, adminPassword } = parsed.data;
  const hashed = await bcrypt.hash(adminPassword, 12);

  // Re-check user count INSIDE the transaction. The previous version did
  // count + create as two separate statements which left a race window
  // where two parallel POSTs could each see zero users and both create a
  // SUPER_ADMIN. The unique email + serializable isolation forces at
  // most one to win.
  try {
    const user = await prisma.$transaction(
      async (tx) => {
        const userCount = await tx.user.count();
        if (userCount > 0) {
          throw new SetupAlreadyDoneError();
        }
        const created = await tx.user.create({
          data: {
            name: adminName,
            email: adminEmail.toLowerCase(),
            password: hashed,
            role: "SUPER_ADMIN",
          },
        });
        await tx.organizationProfile.upsert({
          where: { id: "default" },
          update: { name: organizationName, setupComplete: true },
          create: {
            id: "default",
            name: organizationName,
            setupComplete: true,
          },
        });
        return created;
      },
      { isolationLevel: "Serializable" }
    );

    await logAudit({
      action: "USER_CREATE",
      entityType: "User",
      entityId: user.id,
      userId: user.id,
      metadata: { role: "SUPER_ADMIN", viaSetup: true },
    });

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (err) {
    if (err instanceof SetupAlreadyDoneError) {
      return NextResponse.json(
        { error: "Setup already completed. An admin user already exists." },
        { status: 409 }
      );
    }
    throw err;
  }
}

class SetupAlreadyDoneError extends Error {
  constructor() {
    super("Setup already completed");
    this.name = "SetupAlreadyDoneError";
  }
}
