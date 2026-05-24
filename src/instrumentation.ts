// Next.js 14 instrumentation hook — called once on server startup for
// every runtime (Node, edge). Used to wire up Sentry without ejecting
// from the app/ router.
//
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // The Sentry SDK exposes the config files differently depending on
  // runtime, so we conditionally require the right one. This matches
  // the pattern Sentry's own setup wizard generates.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Optional hook invoked when a request errors so we can attach extra
// context Sentry's default capture doesn't have. Currently a thin
// passthrough — extend if a particular route needs custom tags.
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: "Pages Router" | "App Router"; routePath: string; routeType: "render" | "route" | "action" | "middleware" }
) {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, context);
}
