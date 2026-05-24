/**
 * Client-safe helper that resolves which logo URL to render.
 *
 * Kept in its own module (no Prisma / no NextAuth imports) so client
 * components can use it without dragging server-only code into the
 * browser bundle.
 */
export type OrgProfileForLogo = {
  logoUrl: string | null;
  logoMimeType: string | null;
  logoUpdatedAt: Date | string | null;
};

export function getLogoSrc(profile: OrgProfileForLogo): string | null {
  if (profile.logoMimeType) {
    const ts = profile.logoUpdatedAt
      ? new Date(profile.logoUpdatedAt).getTime()
      : 0;
    return `/api/profile/logo?v=${ts}`;
  }
  return profile.logoUrl || null;
}
