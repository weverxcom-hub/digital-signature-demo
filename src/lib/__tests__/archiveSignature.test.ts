import { describe, expect, it } from "vitest";
import {
  deriveArchiveStatus,
  pickPrimarySignature,
  type SigLike,
} from "../archiveSignature";

const ts = (s: string) => new Date(s);

const sig = (overrides: Partial<SigLike>): SigLike => ({
  signedAt: ts("2026-01-01T00:00:00.000Z"),
  revokedAt: null,
  signatoryId: "SIG-default",
  ...overrides,
});

describe("deriveArchiveStatus (no required signers — legacy single-signer)", () => {
  it("returns DRAFT for an archive with zero signatures", () => {
    expect(deriveArchiveStatus([])).toBe("DRAFT");
  });

  it("returns FULLY_SIGNED when at least one signature is active", () => {
    expect(
      deriveArchiveStatus([
        sig({ signatoryId: "SIG-a", revokedAt: null }),
      ])
    ).toBe("FULLY_SIGNED");
  });

  it("returns REVOKED when all signatures are revoked", () => {
    expect(
      deriveArchiveStatus([
        sig({ signatoryId: "SIG-a", revokedAt: ts("2026-02-01T00:00:00Z") }),
      ])
    ).toBe("REVOKED");
  });

  it("returns FULLY_SIGNED if some are revoked but at least one is active", () => {
    expect(
      deriveArchiveStatus([
        sig({ signatoryId: "SIG-a", revokedAt: ts("2026-02-01T00:00:00Z") }),
        sig({ signatoryId: "SIG-b", revokedAt: null }),
      ])
    ).toBe("FULLY_SIGNED");
  });
});

describe("deriveArchiveStatus (with required signers — multi-signer)", () => {
  it("PENDING when no signatures exist", () => {
    expect(deriveArchiveStatus([], ["SIG-a", "SIG-b"])).toBe("PENDING");
  });

  it("PENDING when only some required signatories have signed", () => {
    expect(
      deriveArchiveStatus(
        [sig({ signatoryId: "SIG-a", revokedAt: null })],
        ["SIG-a", "SIG-b"]
      )
    ).toBe("PENDING");
  });

  it("FULLY_SIGNED when every required signatory has an active signature", () => {
    expect(
      deriveArchiveStatus(
        [
          sig({ signatoryId: "SIG-a", revokedAt: null }),
          sig({ signatoryId: "SIG-b", revokedAt: null }),
        ],
        ["SIG-a", "SIG-b"]
      )
    ).toBe("FULLY_SIGNED");
  });

  it("PENDING when one of the required signatures is revoked (incomplete again)", () => {
    expect(
      deriveArchiveStatus(
        [
          sig({ signatoryId: "SIG-a", revokedAt: null }),
          sig({ signatoryId: "SIG-b", revokedAt: ts("2026-03-01T00:00:00Z") }),
        ],
        ["SIG-a", "SIG-b"]
      )
    ).toBe("PENDING");
  });

  it("REVOKED only when EVERY required signatory has a revoked signature and none active", () => {
    expect(
      deriveArchiveStatus(
        [
          sig({ signatoryId: "SIG-a", revokedAt: ts("2026-03-01T00:00:00Z") }),
          sig({ signatoryId: "SIG-b", revokedAt: ts("2026-03-01T00:00:00Z") }),
        ],
        ["SIG-a", "SIG-b"]
      )
    ).toBe("REVOKED");
  });

  it("PENDING (not REVOKED) when some required signatories never signed and others are revoked", () => {
    expect(
      deriveArchiveStatus(
        [
          sig({ signatoryId: "SIG-a", revokedAt: ts("2026-03-01T00:00:00Z") }),
          // SIG-b never signed
        ],
        ["SIG-a", "SIG-b"]
      )
    ).toBe("PENDING");
  });

  it("treats signatures with empty/missing signatoryId as inactive (cannot satisfy required)", () => {
    expect(
      deriveArchiveStatus(
        [sig({ signatoryId: "", revokedAt: null })],
        ["SIG-a"]
      )
    ).toBe("PENDING");
  });

  it("FULLY_SIGNED when extra non-required signatories also sign", () => {
    expect(
      deriveArchiveStatus(
        [
          sig({ signatoryId: "SIG-a", revokedAt: null }),
          sig({ signatoryId: "SIG-extra", revokedAt: null }),
        ],
        ["SIG-a"]
      )
    ).toBe("FULLY_SIGNED");
  });
});

describe("pickPrimarySignature", () => {
  it("returns null for empty input", () => {
    expect(pickPrimarySignature([])).toBe(null);
    expect(pickPrimarySignature(null)).toBe(null);
    expect(pickPrimarySignature(undefined)).toBe(null);
  });

  it("returns the only signature when there is exactly one", () => {
    const s = sig({ signatoryId: "SIG-a" });
    expect(pickPrimarySignature([s])).toBe(s);
  });

  it("prefers the most recently signed non-revoked signature", () => {
    const older = sig({
      signatoryId: "SIG-old",
      signedAt: ts("2026-01-01T00:00:00Z"),
    });
    const newer = sig({
      signatoryId: "SIG-new",
      signedAt: ts("2026-06-01T00:00:00Z"),
    });
    expect(pickPrimarySignature([older, newer])).toBe(newer);
  });

  it("falls back to the most recent revoked signature when nothing is active", () => {
    const older = sig({
      signatoryId: "SIG-old",
      signedAt: ts("2026-01-01T00:00:00Z"),
      revokedAt: ts("2026-02-01T00:00:00Z"),
    });
    const newer = sig({
      signatoryId: "SIG-new",
      signedAt: ts("2026-06-01T00:00:00Z"),
      revokedAt: ts("2026-07-01T00:00:00Z"),
    });
    expect(pickPrimarySignature([older, newer])).toBe(newer);
  });

  it("an active signature beats a more recent revoked one", () => {
    const active = sig({
      signatoryId: "SIG-active",
      signedAt: ts("2026-01-01T00:00:00Z"),
      revokedAt: null,
    });
    const newerRevoked = sig({
      signatoryId: "SIG-revoked",
      signedAt: ts("2026-06-01T00:00:00Z"),
      revokedAt: ts("2026-07-01T00:00:00Z"),
    });
    // Sorted by signedAt desc -> revoked appears first, but we prefer
    // the active one regardless of recency. This matches the function's
    // documented priority.
    expect(pickPrimarySignature([active, newerRevoked])).toBe(active);
  });
});
