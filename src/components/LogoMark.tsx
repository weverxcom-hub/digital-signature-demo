import { getLogoSrc, type OrgProfileForLogo } from "@/lib/logoSrc";
import { cn } from "@/lib/utils";

type LogoMarkProps = {
  profile: OrgProfileForLogo & {
    name: string;
    shortName?: string | null;
    primaryColor?: string | null;
  };
  /** Square size in px. Maps 1:1 to width/height. */
  size?: number;
  /** Tailwind classes for the outer element. */
  className?: string;
  /** Override background of the text-initial fallback. */
  fallbackBg?: string;
  /** Override text color of the text-initial fallback. */
  fallbackColor?: string;
  /** Round corners. Defaults to `rounded`. */
  rounded?: "none" | "sm" | "md" | "lg" | "full";
};

const ROUNDED_CLASS: Record<NonNullable<LogoMarkProps["rounded"]>, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
};

/**
 * Renders the organization logo with a sensible fallback to text initials.
 *
 * Why a plain <img> instead of next/image?
 * - We need to support both an uploaded file (served by /api/profile/logo)
 *   and an arbitrary external URL.
 * - next/image's optimizer/loader is brittle with mixed sources and was the
 *   ultimate cause of the "logo tidak bisa terbaca" reports: a slightly off
 *   URL (HTML page link, redirect, missing extension) would yield a broken
 *   placeholder rather than degrading gracefully.
 * - The logo is small (well under any optimization threshold), so going
 *   through the image optimizer adds latency for zero quality win.
 *
 * The img has `loading="eager"` because the header logo is above-the-fold
 * on every authenticated page; the alt text falls back to the org name.
 */
export function LogoMark({
  profile,
  size = 36,
  className,
  fallbackBg,
  fallbackColor = "#ffffff",
  rounded = "md",
}: LogoMarkProps) {
  const src = getLogoSrc(profile);
  const dim = { width: size, height: size };
  const roundedClass = ROUNDED_CLASS[rounded];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={profile.name}
        width={size}
        height={size}
        loading="eager"
        decoding="async"
        className={cn(
          "object-contain",
          roundedClass,
          className
        )}
        style={{ width: size, height: size }}
      />
    );
  }

  const initials =
    profile.shortName?.slice(0, 2).toUpperCase() ||
    profile.name.slice(0, 2).toUpperCase();

  return (
    <span
      role="img"
      aria-label={profile.name}
      className={cn(
        "inline-flex items-center justify-center font-semibold",
        roundedClass,
        className
      )}
      style={{
        ...dim,
        backgroundColor: fallbackBg ?? profile.primaryColor ?? "#0f766e",
        color: fallbackColor,
        fontSize: Math.max(10, Math.floor(size / 2.4)),
        lineHeight: 1,
      }}
    >
      {initials}
    </span>
  );
}
