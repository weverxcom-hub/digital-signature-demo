// Sentry runtime config for the browser bundle.
//
// We use NEXT_PUBLIC_SENTRY_DSN here so it's safe to expose to clients. If
// you don't set NEXT_PUBLIC_SENTRY_DSN, the SDK is a no-op in the browser
// even if SENTRY_DSN is set server-side (which is fine — server errors
// still report).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate:
      Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE) || 0.05,
    // Replay sessions for diagnosing UI bugs (when the user reports
    // "kotak-kotak" type visual issues we can rewind). Only 5% to stay
    // inside free quotas; 100% of errored sessions are replayed.
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        // Don't capture form inputs — TTE may include signatory PII.
        maskAllInputs: true,
        // Don't capture media to keep payload small.
        blockAllMedia: true,
      }),
    ],
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ||
      (typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "development"
        : "production"),
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  });
}
