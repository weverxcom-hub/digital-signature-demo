import { prisma } from "@/lib/prisma";
import { ArchivesClient } from "./ArchivesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Archives" };

export default async function ArchivesPage() {
  const [archives, signatories] = await Promise.all([
    prisma.archive.findMany({
      include: {
        signatures: {
          select: {
            id: true,
            token: true,
            signedAt: true,
            revokedAt: true,
            signatoryId: true,
            signatoryName: true,
            signatoryPosition: true,
          },
          orderBy: { signedAt: "desc" },
        },
        requiredSignatories: {
          select: {
            signatoryId: true,
            signatory: { select: { id: true, name: true, position: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.signatory.findMany({
      where: { deletedAt: null, active: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <ArchivesClient
      initialArchives={JSON.parse(JSON.stringify(archives))}
      signatories={signatories}
    />
  );
}
