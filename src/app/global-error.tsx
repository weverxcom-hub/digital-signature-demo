"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

// Catches React render errors that happen above the root layout and
// reports them to Sentry. Without this, top-level errors only show the
// default Next.js error overlay and never reach Sentry.
//
// "use client" is required: error handling has to be a Client Component.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="id">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
