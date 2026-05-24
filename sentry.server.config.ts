// Sentry runtime config for Node.js (server-side / API routes / SSR).
//
// IMPORTANT: this file is loaded on every cold start of the server runtime.
// Keep it minimal — no DB queries, no heavy imports. The init call is a
// no-op when SENTRY_DSN is absent, so dev/preview deployments without
// the env var don't accidentally send events.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Sample 100% of errors but only 10% of transactions to stay under
    // the free tier (5k events/month) on a low-traffic deployment.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
    // Environment tag — production vs preview vs development.
    environment:
      process.env.VERCEL_ENV ||
      process.env.NODE_ENV ||
      "development",
    // Release tag from Vercel git SHA, falls back to undefined which
    // tells Sentry to bucket by deploy automatically.
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    // Skip noisy framework-internal stack frames from the breadcrumbs.
    ignoreErrors: [
      // NextAuth credential auth throws on every wrong password attempt;
      // we don't want to drown the dashboard in those.
      "CredentialsSignin",
    ],
  });
}
