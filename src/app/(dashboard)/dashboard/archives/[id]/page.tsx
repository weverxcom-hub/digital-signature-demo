import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateOrganizationProfile } from "@/lib/profile";
import { buildVerifyUrl } from "@/lib/signature";
import { pickPrimarySignature } from "@/lib/archiveSignature";
import { ArchiveDetailClient } from "./ArchiveDetailClient";

export const dynamic = "force-dynamic";

export default async function ArchiveDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [archive, signatories, profile] = await Promise.all([
    prisma.archive.findUnique({
      where: { id: params.id },
      include: {
        signatures: { orderBy: { signedAt: "desc" } },
        requiredSignatories: {
          orderBy: { createdAt: "asc" },
          include: {
            signatory: {
              select: { id: true, name: true, position: true, unit: true },
            },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.signatory.findMany({
      where: { deletedAt: null, active: true },
      orderBy: { name: "asc" },
    }),
    getOrCreateOrganizationProfile(),
  ]);
  if (!archive) notFound();

  const primary = pickPrimarySignature(archive.signatures);
  const verifyUrl = primary
    ? buildVerifyUrl(primary.token, profile.verifyBaseUrl)
    : null;

  return (
    <ArchiveDetailClient
      archive={JSON.parse(JSON.stringify(archive))}
      signatories={signatories}
      verifyUrl={verifyUrl}
      profile={{
        name: profile.name,
        shortName: profile.shortName,
        logoUrl: profile.logoUrl,
        primaryColor: profile.primaryColor,
      }}
    />
  );
}
