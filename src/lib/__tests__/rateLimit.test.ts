import { describe, expect, it, beforeEach } from "vitest";
import {
  clientIp,
  ipIdentifier,
  userIdentifier,
  checkRateLimit,
  rateLimitResponse,
  type RateLimitResult,
} from "../rateLimit";

describe("clientIp", () => {
  it("prefers the first entry in X-Forwarded-For", () => {
    const req = new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "203.0.113.1, 10.0.0.1, 192.168.1.1",
      },
    });
    expect(clientIp(req)).toBe("203.0.113.1");
  });

  it("trims whitespace from the first XFF entry", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "  203.0.113.2  , 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("203.0.113.2");
  });

  it("falls back to X-Real-IP when XFF is absent", () => {
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "203.0.113.3" },
    });
    expect(clientIp(req)).toBe("203.0.113.3");
  });

  it("returns 'unknown' when no proxy headers are present", () => {
    const req = new Request("https://example.com");
    expect(clientIp(req)).toBe("unknown");
  });
});

describe("ipIdentifier / userIdentifier", () => {
  it("namespaces IP buckets per route scope", () => {
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "10.0.0.99" },
    });
    expect(ipIdentifier(req, "authLogin")).toBe("authLogin:ip:10.0.0.99");
    expect(ipIdentifier(req, "verifyApi")).toBe("verifyApi:ip:10.0.0.99");
  });

  it("namespaces user buckets per route scope", () => {
    expect(userIdentifier("uid-1", "archiveSign")).toBe(
      "archiveSign:user:uid-1"
    );
    expect(userIdentifier("uid-1", "archiveEmbedPdf")).toBe(
      "archiveEmbedPdf:user:uid-1"
    );
  });
});

describe("checkRateLimit fail-open semantics", () => {
  // We intentionally do NOT touch UPSTASH env vars here so the test runs in
  // the "no Upstash configured" path. checkRateLimit must return success=true
  // so unconfigured dev/preview deployments don't break.
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("returns success=true when UPSTASH env vars are unset", async () => {
    const result = await checkRateLimit("authLogin", "any:identifier");
    expect(result.success).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(10);
    expect(result.reset).toBe(0);
  });

  it("returns the per-limiter request budget for each named bucket", async () => {
    expect((await checkRateLimit("verifyApi", "x")).limit).toBe(120);
    expect((await checkRateLimit("archiveSign", "x")).limit).toBe(30);
    expect((await checkRateLimit("archiveEmbedPdf", "x")).limit).toBe(10);
    expect((await checkRateLimit("profileLogo", "x")).limit).toBe(20);
  });
});

describe("rateLimitResponse", () => {
  it("emits 429 with Retry-After + X-RateLimit-* headers", () => {
    const result: RateLimitResult = {
      success: false,
      limit: 120,
      remaining: 0,
      reset: Date.now() + 30_000,
    };
    const res = rateLimitResponse(result);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("120");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("uses Retry-After=60 when reset is unknown (0)", () => {
    const result: RateLimitResult = {
      success: false,
      limit: 30,
      remaining: 0,
      reset: 0,
    };
    const res = rateLimitResponse(result);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("Retry-After is never less than 1 second even if reset is in the past", () => {
    const result: RateLimitResult = {
      success: false,
      limit: 30,
      remaining: 0,
      reset: Date.now() - 10_000,
    };
    const res = rateLimitResponse(result);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
  });
});
