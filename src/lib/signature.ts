import { createHmac, randomBytes } from "crypto";

/**
 * Returns the secret used to HMAC-sign attestation tokens.
 *
 * Falls back to NEXTAUTH_SECRET so deployments don't need an extra env var
 * to be set, but operators can rotate the signature secret independently.
 */
function getSignatureSecret(): string {
  const secret = process.env.SIGNATURE_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "SIGNATURE_SECRET (or NEXTAUTH_SECRET as fallback) must be set for signature integrity."
    );
  }
  return secret;
}

export type SignaturePayload = {
  archiveId: string;
  number: string;
  subject: string;
  issuedAt: Date;
  signatoryId: string;
  signatoryName: string;
  signatoryPosition: string;
  signedAt: Date;
};

export function generateSignatureToken(): string {
  return randomBytes(16).toString("hex");
}

export function computeSignatureHmac(payload: SignaturePayload, token: string): string {
  const secret = getSignatureSecret();
  const data = [
    payload.archiveId,
    payload.number,
    payload.subject,
    payload.issuedAt.toISOString(),
    payload.signatoryId,
    payload.signatoryName,
    payload.signatoryPosition,
    payload.signedAt.toISOString(),
    token,
  ].join("|");
  return createHmac("sha256", secret).update(data).digest("hex");
}

export function verifySignatureHmac(
  payload: SignaturePayload,
  token: string,
  hmac: string
): boolean {
  const expected = computeSignatureHmac(payload, token);
  if (expected.length !== hmac.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ hmac.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Returns the absolute URL that the verification QR will point to.
 *
 * Priority:
 *   1. Explicit `OrganizationProfile.verifyBaseUrl` (e.g. `https://your-org.example.com`)
 *   2. `NEXT_PUBLIC_APP_URL`
 *   3. `http://localhost:3000` (development fallback)
 */
export function buildVerifyUrl(token: string, verifyBaseUrl?: string | null): string {
  const base =
    (verifyBaseUrl && verifyBaseUrl.trim()) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}/verify/${token}`;
}
