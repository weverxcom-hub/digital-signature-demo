import Link from "next/link";

/**
 * Tiny credit bar rendered at the very bottom of every page, below any
 * page-specific footer. Kept intentionally minimal so it never competes
 * with the deploying organization's branding.
 */
export function AppFooter() {
  return (
    <div className="border-t border-slate-100 bg-white/60 py-3 text-center text-[11px] text-slate-400">
      Made with love by{" "}
      <Link
        href="https://weverx.com"
        target="_blank"
        rel="noreferrer noopener"
        className="font-medium text-slate-500 hover:text-slate-700 hover:underline"
      >
        weverx.com
      </Link>
    </div>
  );
}
