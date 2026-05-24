import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { rateLimitByIp } from "@/lib/rateLimit";

// withAuth gives us a middleware that requires a valid NextAuth JWT.
// We delegate dashboard requests to it; everything else passes through
// after any applicable rate-limit check.
const authMiddleware = withAuth({
  pages: { signIn: "/login" },
});

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rate-limit credentials login attempts. NextAuth posts to
  // /api/auth/callback/credentials on submit; we throttle by IP to mitigate
  // brute-force without affecting GET-only routes (CSRF token, providers, etc).
  if (
    req.method === "POST" &&
    pathname.startsWith("/api/auth/callback/")
  ) {
    const blocked = await rateLimitByIp(req, "authLogin");
    if (blocked) return blocked;
  }

  // Dashboard pages require authentication.
  if (pathname.startsWith("/dashboard")) {
    return authMiddleware(req as NextRequestWithAuth, {} as never);
  }

  return NextResponse.next();
}

export const config = {
  // Run on both dashboard routes (auth) and the NextAuth callback endpoint
  // (rate-limit). Other API routes apply their own limiters inline.
  matcher: ["/dashboard/:path*", "/api/auth/callback/:path*"],
};
