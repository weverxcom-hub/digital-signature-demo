import { cache } from "react";
import { prisma } from "./prisma";

export { getLogoSrc, type OrgProfileForLogo } from "./logoSrc";

export const DEFAULT_PROFILE_ID = "default";

const PROFILE_SELECT = {
  id: true,
  name: true,
  shortName: true,
  tagline: true,
  address: true,
  website: true,
  logoUrl: true,
  logoMimeType: true,
  logoUpdatedAt: true,
  primaryColor: true,
  verifyBaseUrl: true,
  setupComplete: true,
  updatedAt: true,
} as const;

/**
 * Returns the singleton OrganizationProfile row, creating it if missing.
 *
 * This app is single-tenant by design: one deployment = one organization.
 *
 * Perf note: this is called from the root layout and most dashboard
 * pages. The previous implementation used `upsert` which always issues
 * a write transaction even when the row already exists — measurable
 * latency on Neon (Singapore) cold starts. We now try `findUnique`
 * first (single index lookup), falling back to `upsert` only when the
 * row is genuinely missing. After the first bootstrap, every request
 * pays one indexed SELECT and nothing more.
 *
 * Wrapped in `React.cache` so the same request can call this helper
 * from multiple Server Components / layouts / pages without re-querying.
 *
 * NOTE: we deliberately exclude `logoBytes` here so it isn't dragged
 * into every page render. The bytes are only fetched by
 * /api/profile/logo and by the QR / stamp routes that need to overlay
 * the logo onto the QR code.
 */
export const getOrCreateOrganizationProfile = cache(async () => {
  const existing = await prisma.organizationProfile.findUnique({
    where: { id: DEFAULT_PROFILE_ID },
    select: PROFILE_SELECT,
  });
  if (existing) return existing;

  return prisma.organizationProfile.upsert({
    where: { id: DEFAULT_PROFILE_ID },
    update: {},
    create: { id: DEFAULT_PROFILE_ID },
    select: PROFILE_SELECT,
  });
});


