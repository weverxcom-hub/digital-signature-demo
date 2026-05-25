import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure the bundled stamp fonts ship with the serverless functions
  // that render PNG stamps (QR + signature visualization). Next.js
  // tracing follows literal fs.readFileSync paths reasonably well, but
  // we build the path with path.join(process.cwd(), …) so we list the
  // assets explicitly to be safe across Vercel runtime versions.
  //
  // In Next.js 14 this key lives under `experimental`; moved to the top
  // level in Next.js 15. Keep it nested until the dependency bump.
  experimental: {
    outputFileTracingIncludes: {
      "/api/archives/[id]/stamp": ["./public/fonts/**"],
      "/api/archives/[id]/qr": ["./public/fonts/**"],
      "/api/archives/[id]/embed-pdf": ["./public/fonts/**"],
    },
    // Required in Next.js 14 to enable src/instrumentation.ts. The flag
    // is implicit / removed in Next.js 15.
    instrumentationHook: true,
  },
  images: {
    // The dashboard now serves the org logo as an uploaded file via
    // /api/profile/logo, but the legacy `logoUrl` (external image) is
    // still rendered for backwards compatibility on a plain <img>. The
    // optimizer is not used for that source — we keep this list tight so
    // any future <Image> use can't be tricked into fetching arbitrary
    // hosts over plain HTTP.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Apply baseline security headers globally. Tuned so the public verify
  // page is the most locked-down surface (DENY framing), while the rest
  // of the app keeps reasonable defaults.
  async headers() {
    const baseline = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      },
    ];
    // Next.js applies rules in array order; when multiple sources match
    // the same path, the LAST matching rule wins for any given header
    // key. So order: general first, specific second — specific overrides.
    return [
      // Everything (baseline). Routes below override headers as needed.
      {
        source: "/:path*",
        headers: [
          ...baseline,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      // Dashboard: admin tool — keep out of search engines.
      {
        source: "/dashboard/:path*",
        headers: [
          ...baseline,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      // /verify/* is the trust anchor — never let it be framed.
      // Must come AFTER the general rule so X-Frame-Options: DENY wins.
      {
        source: "/verify/:path*",
        headers: [
          ...baseline,
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

// Wrap the config with Sentry's source-map upload + automatic
// instrumentation. When SENTRY_AUTH_TOKEN is absent (e.g. local dev,
// preview without secrets) the wrapper still applies the runtime
// instrumentation but skips the source-map upload step gracefully.
export default withSentryConfig(nextConfig, {
  // Org + project slugs only matter for source-map upload at build
  // time. Reading from env vars keeps this file generic across forks.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Don't fail the build if the source-map upload fails. We'd rather
  // ship a deployment without symbolicated traces than block the
  // release on a Sentry config glitch.
  errorHandler: (err) => {
    // eslint-disable-next-line no-console
    console.warn("[sentry] source-map upload skipped:", err.message);
  },
  // Hide sentry-cli output unless debugging.
  silent: process.env.CI !== "true",
});
