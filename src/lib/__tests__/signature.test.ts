import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  buildVerifyUrl,
  computeSignatureHmac,
  generateSignatureToken,
  verifySignatureHmac,
  type SignaturePayload,
} from "../signature";

// A fixed secret used by all golden-vector tests. Do not change without
// re-deriving every "expected hmac" value below; HMACs become invalid the
// moment the secret rotates.
const TEST_SECRET = "test-signature-secret-do-not-use-in-prod-0123456789ab";

const fixedPayload = (): SignaturePayload => ({
  archiveId: "ARC-0001",
  number: "SK-001/ACME/2026",
  subject: "Pengangkatan Dosen Tetap",
  issuedAt: new Date("2026-01-15T08:00:00.000Z"),
  signatoryId: "SIG-rektor",
  signatoryName: "Prof. Dr. Budi Santoso",
  signatoryPosition: "Rektor",
  signedAt: new Date("2026-01-16T03:30:00.000Z"),
});

describe("signature HMAC", () => {
  let originalSecret: string | undefined;
  beforeAll(() => {
    originalSecret = process.env.SIGNATURE_SECRET;
    process.env.SIGNATURE_SECRET = TEST_SECRET;
  });
  afterAll(() => {
    if (originalSecret === undefined) delete process.env.SIGNATURE_SECRET;
    else process.env.SIGNATURE_SECRET = originalSecret;
  });

  it("computes a deterministic HMAC for a given (payload, token, secret) [golden vector]", () => {
    const token = "deadbeefcafebabe1122334455667788";
    const hmac = computeSignatureHmac(fixedPayload(), token);
    // Golden vector: pinned to detect any change in payload serialization,
    // key schedule, or HMAC algorithm.
    //
    // ⚠ If this value needs to change, treat it as a BREAKING change —
    // every existing signature in production becomes invalid the moment
    // the algorithm changes. Coordinate via a versioned algorithm field
    // on ArchiveSignature, not by silently updating the vector.
    expect(hmac).toBe(
      "65998ee9f917d0d1fc4b507eef7821e19d84494ef3ee4cd6130944c0aa8ac02d"
    );

    // Sanity: HMAC-SHA256 always emits 64 hex chars.
    expect(hmac).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verifySignatureHmac roundtrips compute()", () => {
    const token = "deadbeefcafebabe1122334455667788";
    const payload = fixedPayload();
    const hmac = computeSignatureHmac(payload, token);
    expect(verifySignatureHmac(payload, token, hmac)).toBe(true);
  });

  it("rejects mismatched HMAC", () => {
    const token = "deadbeefcafebabe1122334455667788";
    const hmac = computeSignatureHmac(fixedPayload(), token);
    const tampered = hmac.replace(/[0-9a-f]$/, "0");
    // If the last char already happened to be '0', force a different char.
    const wrong = tampered === hmac ? hmac.slice(0, -1) + "1" : tampered;
    expect(verifySignatureHmac(fixedPayload(), token, wrong)).toBe(false);
  });

  it("rejects HMAC of a payload whose archiveId was tampered", () => {
    const token = "deadbeefcafebabe1122334455667788";
    const original = fixedPayload();
    const hmac = computeSignatureHmac(original, token);
    const tampered: SignaturePayload = { ...original, archiveId: "ARC-EVIL" };
    expect(verifySignatureHmac(tampered, token, hmac)).toBe(false);
  });

  it("rejects HMAC of a payload whose signedAt drifted by one millisecond", () => {
    // signedAt is part of the HMAC input. Even sub-second drift must fail.
    const token = "deadbeefcafebabe1122334455667788";
    const original = fixedPayload();
    const hmac = computeSignatureHmac(original, token);
    const tampered: SignaturePayload = {
      ...original,
      signedAt: new Date(original.signedAt.getTime() + 1),
    };
    expect(verifySignatureHmac(tampered, token, hmac)).toBe(false);
  });

  it("rejects HMAC under a different token", () => {
    const payload = fixedPayload();
    const hmac = computeSignatureHmac(payload, "deadbeefcafebabe1122334455667788");
    expect(
      verifySignatureHmac(payload, "00000000000000000000000000000000", hmac)
    ).toBe(false);
  });

  it("rejects HMAC of differing length immediately (no panic)", () => {
    const payload = fixedPayload();
    const hmac = computeSignatureHmac(payload, "tok");
    expect(verifySignatureHmac(payload, "tok", hmac.slice(0, 32))).toBe(false);
    expect(verifySignatureHmac(payload, "tok", "")).toBe(false);
    expect(verifySignatureHmac(payload, "tok", hmac + "f")).toBe(false);
  });

  it("rotating SIGNATURE_SECRET invalidates pre-existing HMACs", () => {
    const token = "deadbeefcafebabe1122334455667788";
    const payload = fixedPayload();
    const hmac = computeSignatureHmac(payload, token);
    process.env.SIGNATURE_SECRET = "different-secret-after-rotation-9876543210";
    try {
      expect(verifySignatureHmac(payload, token, hmac)).toBe(false);
      // ...but a freshly computed HMAC under the new secret verifies.
      const fresh = computeSignatureHmac(payload, token);
      expect(verifySignatureHmac(payload, token, fresh)).toBe(true);
      expect(fresh).not.toBe(hmac);
    } finally {
      process.env.SIGNATURE_SECRET = TEST_SECRET;
    }
  });

  it("throws when SIGNATURE_SECRET is absent", () => {
    delete process.env.SIGNATURE_SECRET;
    try {
      expect(() =>
        computeSignatureHmac(fixedPayload(), "tok")
      ).toThrow(/SIGNATURE_SECRET/);
    } finally {
      process.env.SIGNATURE_SECRET = TEST_SECRET;
    }
  });
});

describe("generateSignatureToken", () => {
  it("emits a 32-char hex token", () => {
    const tok = generateSignatureToken();
    expect(tok).toMatch(/^[0-9a-f]{32}$/);
  });

  it("does not collide across 1000 calls", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generateSignatureToken());
    expect(set.size).toBe(1000);
  });
});

describe("buildVerifyUrl precedence", () => {
  let originalAppUrl: string | undefined;
  beforeAll(() => {
    originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  });
  afterAll(() => {
    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("uses verifyBaseUrl when provided (highest priority)", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://env-default.example.com";
    expect(buildVerifyUrl("tok123", "https://custom.example.com")).toBe(
      "https://custom.example.com/verify/tok123"
    );
  });

  it("falls back to NEXT_PUBLIC_APP_URL when verifyBaseUrl is null/blank", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://env-default.example.com";
    expect(buildVerifyUrl("tok123", null)).toBe(
      "https://env-default.example.com/verify/tok123"
    );
    expect(buildVerifyUrl("tok123", "   ")).toBe(
      "https://env-default.example.com/verify/tok123"
    );
    expect(buildVerifyUrl("tok123", undefined)).toBe(
      "https://env-default.example.com/verify/tok123"
    );
  });

  it("trims trailing slashes from the base URL", () => {
    expect(buildVerifyUrl("tok123", "https://example.com////")).toBe(
      "https://example.com/verify/tok123"
    );
  });

  it("falls back to localhost when no URL is configured", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(buildVerifyUrl("tok123", null)).toBe(
      "http://localhost:3000/verify/tok123"
    );
  });
});
