import { prisma } from "./prisma";

export const DEFAULT_PROFILE_ID = "default";

/**
 * Returns the singleton OrganizationProfile row, creating it if missing.
 *
 * This app is single-tenant by design: one deployment = one organization.
 * Uses `upsert` so concurrent calls during a parallel build pass don't
 * race against the unique constraint on `id`.
 */
export async function getOrCreateOrganizationProfile() {
  return prisma.organizationProfile.upsert({
    where: { id: DEFAULT_PROFILE_ID },
    update: {},
    create: { id: DEFAULT_PROFILE_ID },
  });
}
