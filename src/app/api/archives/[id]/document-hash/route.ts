import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const bindSchema = z.object({
  // SHA-256 hex digest, lowercase. The browser computes this client-side
  // from the PDF bytes; the server only stores the digest.
  sha256: z.string().regex(/^[a-f0-9]{64}$/, "Expected lowercase SHA-256 hex"),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = bindSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.archive.findUnique({
    where: { id: params.id },
    select: { id: true, documentSha256: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Binding is one-shot: once a hash is recorded for an archive we refuse
  // to silently swap it for a different file. The admin can create a new
  // archive (with its own number/HMAC) to bind a different document.
  if (
    existing.documentSha256 &&
    existing.documentSha256 !== parsed.data.sha256
  ) {
    return NextResponse.json(
      {
        error:
          "Document hash already set; create a new archive to bind a different document.",
      },
      { status: 409 }
    );
  }

  const updated = await prisma.archive.update({
    where: { id: params.id },
    data: { documentSha256: parsed.data.sha256 },
    select: { id: true, documentSha256: true },
  });

  await logAudit({
    action: "BIND_DOCUMENT",
    entityType: "Archive",
    entityId: updated.id,
    userId: session.user.id,
    metadata: { sha256: updated.documentSha256 },
  });

  return NextResponse.json(updated);
}
