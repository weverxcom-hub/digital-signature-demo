import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySignatureHmac } from "@/lib/signature";
import { getOrCreateOrganizationProfile, getLogoSrc } from "@/lib/profile";
import { rateLimitByIp } from "@/lib/rateLimit";

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const rl = await rateLimitByIp(req, "verifyApi");
  if (rl) return rl;

  const sig = await prisma.archiveSignature.findUnique({
    where: { token: params.token },
    include: {
      archive: {
        select: {
          id: true,
          number: true,
          subject: true,
          description: true,
          issuedAt: true,
          documentSha256: true,
        },
      },
    },
  });

  const profile = await getOrCreateOrganizationProfile();
  // `logoUrl` here is whatever the consumer can render in an <img>: either
  // the externally-hosted URL, or a same-origin /api/profile/logo path that
  // streams the uploaded bytes.
  const organization = {
    name: profile.name,
    shortName: profile.shortName,
    tagline: profile.tagline,
    logoUrl: getLogoSrc(profile),
    website: profile.website,
    primaryColor: profile.primaryColor,
  };

  if (!sig) {
    return NextResponse.json(
      {
        status: "not_found" as const,
        message: "Signature token not found. The document may be invalid.",
        organization,
      },
      { status: 404 }
    );
  }

  if (sig.revokedAt) {
    return NextResponse.json(
      {
        status: "revoked" as const,
        message: "This signature has been revoked.",
        revokedAt: sig.revokedAt,
        revokedReason: sig.revokedReason,
        archive: sig.archive,
        signatory: {
          name: sig.signatoryName,
          position: sig.signatoryPosition,
          unit: sig.signatoryUnit,
        },
        signedAt: sig.signedAt,
        organization,
      },
      { status: 410 }
    );
  }

  const integrityOk = verifySignatureHmac(
    {
      archiveId: sig.archiveId,
      number: sig.archive.number,
      subject: sig.archive.subject,
      issuedAt: sig.archive.issuedAt,
      signatoryId: sig.signatoryId,
      signatoryName: sig.signatoryName,
      signatoryPosition: sig.signatoryPosition,
      signedAt: sig.signedAt,
    },
    sig.token,
    sig.hmac
  );

  if (!integrityOk) {
    return NextResponse.json(
      {
        status: "tampered" as const,
        message:
          "Integrity check failed. The signature record may have been tampered with.",
        organization,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    status: "valid" as const,
    message: "Signature is valid.",
    archive: sig.archive,
    signatory: {
      name: sig.signatoryName,
      position: sig.signatoryPosition,
      unit: sig.signatoryUnit,
    },
    signedAt: sig.signedAt,
    organization,
  });
}
