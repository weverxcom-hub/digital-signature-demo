import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PDFDocument } from "pdf-lib";
import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildVerifyUrl } from "@/lib/signature";
import { getOrCreateOrganizationProfile } from "@/lib/profile";
import { renderSignatureStamp } from "@/lib/stamp";
import { pickPrimarySignature } from "@/lib/archiveSignature";
import { logAudit } from "@/lib/audit";

// pdf-lib + sharp need the Node runtime; the default is fine but be explicit
// so a future refactor doesn't accidentally flip this route to edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 10 MB hard cap for uploaded PDFs. The whole document is buffered in
// memory while we embed the stamp so this also protects the function
// from OOMs on Vercel's serverless runtime.
const MAX_PDF_BYTES = 10 * 1024 * 1024;

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
const VALID_CORNERS: readonly Corner[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

function parseCorner(input: FormDataEntryValue | null): Corner {
  const raw = typeof input === "string" ? input : "";
  return VALID_CORNERS.includes(raw as Corner)
    ? (raw as Corner)
    : "bottom-right";
}

function parsePositiveNumber(
  input: FormDataEntryValue | null,
  fallback: number,
  max?: number
): number {
  if (typeof input !== "string" || input.trim() === "") return fallback;
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return max ? Math.min(n, max) : n;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a 'file' field" },
      { status: 400 }
    );
  }
  const fileEntry = form.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { error: "Missing PDF file in 'file' field" },
      { status: 400 }
    );
  }
  if (fileEntry.size === 0) {
    return NextResponse.json({ error: "Uploaded PDF is empty" }, { status: 400 });
  }
  if (fileEntry.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: `PDF is too large (max ${MAX_PDF_BYTES / 1024 / 1024} MB)` },
      { status: 413 }
    );
  }
  const fileBytes = new Uint8Array(await fileEntry.arrayBuffer());
  // Quick sanity check on the magic header before we hand bytes to pdf-lib.
  const header = new TextDecoder().decode(fileBytes.slice(0, 5));
  if (!header.startsWith("%PDF-")) {
    return NextResponse.json(
      { error: "File does not look like a PDF" },
      { status: 400 }
    );
  }

  const sigId = (form.get("signatureId") as string | null)?.trim() || null;
  const pageSpec =
    (form.get("page") as string | null)?.trim().toLowerCase() || "last";
  const corner = parseCorner(form.get("corner"));
  const stampWidthPt = parsePositiveNumber(
    form.get("stampWidth"),
    220,
    600
  );
  const marginPt = parsePositiveNumber(form.get("margin"), 28, 200);

  const archive = await prisma.archive.findUnique({
    where: { id: params.id },
    include: { signatures: { orderBy: { signedAt: "desc" } } },
  });
  if (!archive) {
    return NextResponse.json({ error: "Archive not found" }, { status: 404 });
  }
  const signature = sigId
    ? archive.signatures.find((s) => s.id === sigId)
    : pickPrimarySignature(archive.signatures);
  if (!signature) {
    return NextResponse.json(
      { error: "Archive has no signature yet" },
      { status: 404 }
    );
  }
  if (signature.revokedAt) {
    return NextResponse.json(
      { error: "Cannot embed a revoked signature" },
      { status: 409 }
    );
  }

  const profile = await getOrCreateOrganizationProfile();
  const verifyUrl = buildVerifyUrl(signature.token, profile.verifyBaseUrl);

  const stampPng = await renderSignatureStamp({
    verifyUrl,
    signatoryName: signature.signatoryName,
    signatoryPosition: signature.signatoryPosition,
    signatoryUnit: signature.signatoryUnit,
    organizationName: profile.name,
    footerLine1: `Dokumen ini ditandatangani secara elektronik oleh ${profile.name}.`,
    footerLine2: `Pindai QR untuk verifikasi di ${stripScheme(verifyUrl)}.`,
  });

  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(fileBytes);
  } catch {
    return NextResponse.json(
      { error: "PDF could not be parsed. It may be encrypted or malformed." },
      { status: 400 }
    );
  }
  const pages = pdfDoc.getPages();
  if (pages.length === 0) {
    return NextResponse.json(
      { error: "PDF has no pages" },
      { status: 400 }
    );
  }
  const stampImage = await pdfDoc.embedPng(stampPng);
  const aspect = stampImage.height / stampImage.width;
  const drawWidth = stampWidthPt;
  const drawHeight = drawWidth * aspect;

  // Resolve which pages to stamp. Accepted: "all", "first", "last", or a
  // 1-based page number. Anything else falls back to "last".
  const targetIndices = resolveTargetPages(pageSpec, pages.length);
  for (const idx of targetIndices) {
    const page = pages[idx]!;
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const { x, y } = positionForCorner(
      corner,
      pageWidth,
      pageHeight,
      drawWidth,
      drawHeight,
      marginPt
    );
    page.drawImage(stampImage, { x, y, width: drawWidth, height: drawHeight });
  }

  const out = await pdfDoc.save();

  await logAudit({
    action: "EMBED_PDF",
    entityType: "Archive",
    entityId: archive.id,
    userId: session.user.id,
    metadata: {
      signatureId: signature.id,
      page: pageSpec,
      corner,
      stampWidth: stampWidthPt,
      margin: marginPt,
      sourceBytes: fileBytes.byteLength,
    },
  });

  const downloadName = sanitizeFileName(
    `signed-${archive.number}-${signature.signatoryName}.pdf`
  );
  return new NextResponse(new Uint8Array(out), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(out.byteLength),
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Cache-Control": "no-store",
    },
  });
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

function resolveTargetPages(spec: string, total: number): number[] {
  if (spec === "all") return Array.from({ length: total }, (_, i) => i);
  if (spec === "first") return [0];
  if (spec === "last") return [total - 1];
  const n = Number.parseInt(spec, 10);
  if (Number.isFinite(n) && n >= 1 && n <= total) return [n - 1];
  return [total - 1];
}

function positionForCorner(
  corner: Corner,
  pageWidth: number,
  pageHeight: number,
  drawWidth: number,
  drawHeight: number,
  margin: number
): { x: number; y: number } {
  // pdf-lib uses bottom-left origin.
  switch (corner) {
    case "top-left":
      return { x: margin, y: pageHeight - drawHeight - margin };
    case "top-right":
      return {
        x: pageWidth - drawWidth - margin,
        y: pageHeight - drawHeight - margin,
      };
    case "bottom-left":
      return { x: margin, y: margin };
    case "bottom-right":
    default:
      return { x: pageWidth - drawWidth - margin, y: margin };
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 180);
}
