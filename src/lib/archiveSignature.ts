import type { ArchiveStatus } from "@prisma/client";

/**
 * Helpers for the multi-signer schema. They keep the single-signer UX
 * working (pickPrimarySignature) and derive the archive-level status
 * from its current signatures and the optional required-signer set.
 */

export type SigLike = {
  revokedAt: Date | string | null;
  signedAt: Date | string;
  signatoryId?: string;
};

/**
 * Pick the signature that represents the archive's current state for UX.
 * Priority:
 *   1. Most recently signed non-revoked signature.
 *   2. Most recently signed revoked signature (so UI still shows the
 *      revoked state instead of "no signature").
 *   3. null if the archive has no signatures yet.
 */
export function pickPrimarySignature<T extends SigLike>(
  signatures: T[] | null | undefined
): T | null {
  if (!signatures || signatures.length === 0) return null;
  const sorted = [...signatures].sort(
    (a, b) => +new Date(b.signedAt) - +new Date(a.signedAt)
  );
  const active = sorted.find((s) => !s.revokedAt);
  return active ?? sorted[0]!;
}

/**
 * Compute the archive-level status from its signatures and required-signer
 * set.
 *
 * Without any required signers (the legacy single-signer semantics):
 *   - no signatures             -> DRAFT
 *   - any non-revoked signature -> FULLY_SIGNED
 *   - has signatures, all revoked -> REVOKED
 *
 * With one or more required signers:
 *   - every required signatory has an active signature -> FULLY_SIGNED
 *   - every required signatory has a revoked signature AND no active
 *     signature exists                                 -> REVOKED
 *   - anything else (never signed, partial, in progress) -> PENDING
 */
export function deriveArchiveStatus(
  signatures: SigLike[],
  requiredSignatoryIds: string[] = []
): ArchiveStatus {
  const activeSignatoryIds = new Set(
    signatures
      .filter((s) => !s.revokedAt)
      .map((s) => s.signatoryId)
      .filter((v): v is string => typeof v === "string" && v.length > 0)
  );

  if (requiredSignatoryIds.length === 0) {
    if (signatures.length === 0) return "DRAFT";
    return activeSignatoryIds.size > 0 ? "FULLY_SIGNED" : "REVOKED";
  }

  const allRequiredActive = requiredSignatoryIds.every((id) =>
    activeSignatoryIds.has(id)
  );
  if (allRequiredActive) return "FULLY_SIGNED";

  // No active signatures left at all? Distinguish "REVOKED across the
  // board" from "still in progress".
  if (activeSignatoryIds.size === 0 && signatures.length > 0) {
    const revokedSignatoryIds = new Set(
      signatures
        .filter((s) => !!s.revokedAt)
        .map((s) => s.signatoryId)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    );
    const allRequiredOnceSigned = requiredSignatoryIds.every((id) =>
      revokedSignatoryIds.has(id)
    );
    if (allRequiredOnceSigned) return "REVOKED";
  }

  return "PENDING";
}
