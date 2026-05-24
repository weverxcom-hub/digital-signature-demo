// Rate limiting via Upstash Redis (REST API).
//
// Distributed, serverless-friendly, fail-open. If the Upstash env vars are not
// configured the limiter becomes a no-op (success=true). That keeps local dev
// + ephemeral preview deployments working without credentials, and degrades
// gracefully if Upstash is temporarily unreachable.
//
// Identifiers:
//   - `byIp(req)` for unauthenticated routes (login, public verify).
//   - `byUser(userId)` for authenticated routes; an authenticated user
//     bypasses the IP bucket so multiple users behind one NAT don't collide.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

type LimiterDef = {
  /** Stable key prefix in Redis so configs can be swapped without flushing. */
  prefix: string;
  /** Max requests inside the rolling window. */
  requests: number;
  /** Rolling window duration in seconds. */
  windowSec: number;
};

const DEFS = {
  // Login attempts (POST /api/auth/callback/credentials). Tight by IP.
  authLogin: { prefix: "rl:auth:login", requests: 10, windowSec: 60 },
  // Signing an archive — admin action, but limit spam.
  archiveSign: { prefix: "rl:archive:sign", requests: 30, windowSec: 60 },
  // PDF embed is heavy (sharp + pdf-lib).
  archiveEmbedPdf: { prefix: "rl:archive:embed", requests: 10, windowSec: 60 },
  // Logo upload/delete — admin only, limit churn.
  profileLogo: { prefix: "rl:profile:logo", requests: 20, windowSec: 60 },
  // Public verify endpoint — generous, but bounded against scraping.
  verifyApi: { prefix: "rl:verify:api", requests: 120, windowSec: 60 },
} satisfies Record<string, LimiterDef>;

export type LimiterName = keyof typeof DEFS;

let cachedRedis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    cachedRedis = null;
    return null;
  }
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

const limiterCache = new Map<LimiterName, Ratelimit>();

function getLimiter(name: LimiterName): Ratelimit | null {
  const cached = limiterCache.get(name);
  if (cached) return cached;
  const redis = getRedis();
  if (!redis) return null;
  const def = DEFS[name];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(def.requests, `${def.windowSec} s`),
    prefix: def.prefix,
    analytics: false,
  });
  limiterCache.set(name, limiter);
  return limiter;
}

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

/**
 * Run a check against the named limiter. Returns success=true (allowing the
 * request through) when Upstash is not configured.
 */
export async function checkRateLimit(
  name: LimiterName,
  identifier: string
): Promise<RateLimitResult> {
  const limiter = getLimiter(name);
  const def = DEFS[name];
  if (!limiter) {
    return {
      success: true,
      limit: def.requests,
      remaining: def.requests,
      reset: 0,
    };
  }
  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (err) {
    // Fail open on Upstash errors — surface in logs but never break the route.
    console.error(`[ratelimit] ${name} check failed`, err);
    return {
      success: true,
      limit: def.requests,
      remaining: def.requests,
      reset: 0,
    };
  }
}

/**
 * Best-effort client IP. Honors common proxy headers used by Vercel.
 * Falls back to a stable "unknown" bucket which is acceptable for fail-open
 * (Upstash absent) and conservative for fail-closed (everyone shares the
 * bucket; rate-limits trip earlier rather than not at all).
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export function ipIdentifier(req: Request, scope: string): string {
  return `${scope}:ip:${clientIp(req)}`;
}

export function userIdentifier(userId: string, scope: string): string {
  return `${scope}:user:${userId}`;
}

/** Build a 429 NextResponse from a failed RateLimitResult. */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfterSec = result.reset
    ? Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
    : 60;
  return NextResponse.json(
    {
      error: "Too Many Requests",
      message:
        "Rate limit exceeded. Please wait a moment before trying again.",
      retryAfter: retryAfterSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(result.reset),
      },
    }
  );
}

/**
 * Convenience: check by IP, and if blocked, return a NextResponse to send back.
 * Otherwise returns null (caller proceeds).
 */
export async function rateLimitByIp(
  req: Request,
  name: LimiterName
): Promise<NextResponse | null> {
  const result = await checkRateLimit(name, ipIdentifier(req, name));
  return result.success ? null : rateLimitResponse(result);
}

/**
 * Convenience: check by authenticated user ID, falling back to IP when there
 * is no user (defensive — caller should normally only invoke this after auth).
 */
export async function rateLimitByUser(
  req: Request,
  name: LimiterName,
  userId: string | null | undefined
): Promise<NextResponse | null> {
  const id = userId
    ? userIdentifier(userId, name)
    : ipIdentifier(req, name);
  const result = await checkRateLimit(name, id);
  return result.success ? null : rateLimitResponse(result);
}
