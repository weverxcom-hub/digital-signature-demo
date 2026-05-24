"use client";

/**
 * Branded full-page loading state.
 *
 * Kept as a pure client component (no DB calls!) so it doesn't drag Prisma
 * into static prerender paths like /_not-found. The logo image is loaded
 * from /api/profile/logo which falls back gracefully (hidden onError) when
 * no logo has been uploaded — but the browser has almost certainly cached
 * the response from a previous page load, so the transition feels seamless.
 */
export function LoadingScreen({
  label = "Memuat…",
}: {
  label?: string;
}) {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <div className="relative">
        <span
          aria-hidden
          className="absolute inset-0 -m-3 animate-ping rounded-full bg-[var(--brand,#0f766e)] opacity-25"
        />
        <span className="relative inline-flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-md bg-white p-2 shadow-md ring-1 ring-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/profile/logo"
            alt=""
            width={56}
            height={56}
            className="max-h-full max-w-full object-contain"
            onError={(e) => {
              // Hide if the deployment has no uploaded logo yet — the
              // spinning halo around the placeholder still reads as a
              // loading indicator.
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </span>
      </div>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
