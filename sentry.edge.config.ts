// Sentry runtime config for middleware + edge runtime functions.
//
// Edge runtime has stricter API surface than Node — no replay, no profile,
// limited integrations. Initialize a minimal client that only captures
// errors and transactions.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
    environment:
      process.env.VERCEL_ENV ||
      process.env.NODE_ENV ||
      "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
  });
}
