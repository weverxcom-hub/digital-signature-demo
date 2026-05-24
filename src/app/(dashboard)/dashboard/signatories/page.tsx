import { prisma } from "@/lib/prisma";
import { SignatoriesClient } from "./SignatoriesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Signatories" };

export default async function SignatoriesPage() {
  const signatories = await prisma.signatory.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return <SignatoriesClient initial={signatories} />;
}
