import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySignatureHmac } from "@/lib/signature";
import { getOrCreateOrganizationProfile } from "@/lib/profile";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
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
        },
      },
    },
  });

  const profile = await getOrCreateOrganizationProfile();
  const organization = {
    name: profile.name,
    shortName: profile.shortName,
    tagline: profile.tagline,
    logoUrl: profile.logoUrl,
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
