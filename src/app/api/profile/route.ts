import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateOrganizationProfile } from "@/lib/profile";
import { logAudit } from "@/lib/audit";

const profileSchema = z.object({
  name: z.string().min(2).max(200),
  shortName: z.string().max(50).optional().nullable(),
  tagline: z.string().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal("")),
  logoUrl: z.string().url().optional().nullable().or(z.literal("")),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color, e.g. #0f766e"),
  verifyBaseUrl: z.string().url().optional().nullable().or(z.literal("")),
});

export async function GET() {
  const profile = await getOrCreateOrganizationProfile();
  return NextResponse.json(profile);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await getOrCreateOrganizationProfile();
  const updated = await prisma.organizationProfile.update({
    where: { id: "default" },
    data: {
      name: parsed.data.name,
      shortName: parsed.data.shortName || null,
      tagline: parsed.data.tagline || null,
      address: parsed.data.address || null,
      website: parsed.data.website || null,
      logoUrl: parsed.data.logoUrl || null,
      primaryColor: parsed.data.primaryColor,
      verifyBaseUrl: parsed.data.verifyBaseUrl || null,
      setupComplete: true,
    },
  });

  await logAudit({
    action: "PROFILE_UPDATE",
    entityType: "OrganizationProfile",
    entityId: updated.id,
    userId: session.user.id,
  });

  return NextResponse.json(updated);
}
