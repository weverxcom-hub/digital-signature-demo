import QRCode from "qrcode";
import sharp from "sharp";

export type StampOptions = {
  verifyUrl: string;
  signatoryName: string;
  signatoryPosition: string;
  signatoryUnit?: string | null;
  organizationName: string;
  footerLine1?: string;
  footerLine2?: string;
  /** Output width in pixels. Height is derived from layout. */
  width?: number;
};

const PALETTE = {
  bg: "#ffffff",
  ink: "#0f172a",
  muted: "#475569",
  rule: "#cbd5e1",
};

/**
 * Renders a BSrE-style electronic-signature visualization to a PNG buffer.
 * Layout: QR on the left, signatory text on the right, framed border, and
 * an optional italic footer line about the issuing authority.
 *
 * The image is built as SVG and rasterized with sharp so it is portable
 * across Node runtimes (Vercel serverless included) without needing a
 * native canvas binding.
 */
export async function renderSignatureStamp(opts: StampOptions): Promise<Buffer> {
  const width = opts.width ?? 720;
  const padding = 24;
  const qrSize = 180;
  const rowGap = 8;
  const fontStack =
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

  const qrDataUrl = await QRCode.toDataURL(opts.verifyUrl, {
    margin: 1,
    width: qrSize,
    errorCorrectionLevel: "M",
  });

  const textX = padding + qrSize + 24;
  const textWidth = width - textX - padding;

  // Wrap the long position string so very long titles (e.g. "Wakil Rektor
  // Bidang Akademik dan Kemahasiswaan") don't overflow the stamp.
  const positionLines = wrapText(opts.signatoryPosition.toUpperCase(), textWidth, 13);
  const unitLines = opts.signatoryUnit
    ? wrapText(opts.signatoryUnit, textWidth, 12)
    : [];

  // Compute right column height so the whole frame hugs the content.
  let yCursor = padding + 6;
  const lineHeight = 18;
  yCursor += lineHeight; // "Ditandatangani secara elektronik oleh:"
  yCursor += rowGap;
  yCursor += lineHeight * positionLines.length;
  yCursor += rowGap;
  yCursor += lineHeight * unitLines.length;
  yCursor += unitLines.length ? rowGap : 0;
  yCursor += lineHeight; // signatory name
  const textBlockBottom = yCursor;

  // Total frame height = whichever is taller, QR or text.
  const contentBottom = Math.max(padding + qrSize, textBlockBottom);
  const hasFooter = !!(opts.footerLine1 || opts.footerLine2);
  const footerHeight = hasFooter ? 56 : 0;
  const totalHeight = contentBottom + padding + footerHeight;

  const lines: string[] = [];
  // Frame
  lines.push(
    `<rect x="2" y="2" width="${width - 4}" height="${
      contentBottom + padding - 2
    }" rx="6" fill="${PALETTE.bg}" stroke="${PALETTE.rule}" stroke-width="1.5"/>`
  );
  // QR image
  lines.push(
    `<image x="${padding}" y="${padding}" width="${qrSize}" height="${qrSize}" preserveAspectRatio="xMidYMid meet" href="${qrDataUrl}"/>`
  );
  // Text block — start typesetting
  let ty = padding + 16;
  lines.push(
    `<text x="${textX}" y="${ty}" font-family="${fontStack}" font-size="12" fill="${PALETTE.muted}">Ditandatangani secara elektronik oleh:</text>`
  );
  ty += lineHeight + rowGap;
  for (const ln of positionLines) {
    lines.push(
      `<text x="${textX}" y="${ty}" font-family="${fontStack}" font-size="13" font-weight="700" fill="${PALETTE.ink}">${escapeXml(ln)}</text>`
    );
    ty += lineHeight;
  }
  ty += rowGap;
  for (const ln of unitLines) {
    lines.push(
      `<text x="${textX}" y="${ty}" font-family="${fontStack}" font-size="12" fill="${PALETTE.muted}">${escapeXml(ln)}</text>`
    );
    ty += lineHeight;
  }
  if (unitLines.length) ty += rowGap;
  lines.push(
    `<text x="${textX}" y="${ty}" font-family="${fontStack}" font-size="14" font-weight="700" fill="${PALETTE.ink}">${escapeXml(opts.signatoryName)}</text>`
  );

  // Footer (italic disclaimer line)
  if (hasFooter) {
    const fy = contentBottom + padding + 18;
    if (opts.footerLine1) {
      lines.push(
        `<text x="${padding}" y="${fy}" font-family="${fontStack}" font-size="10" font-style="italic" fill="${PALETTE.muted}">${escapeXml(
          opts.footerLine1
        )}</text>`
      );
    }
    if (opts.footerLine2) {
      lines.push(
        `<text x="${padding}" y="${fy + 14}" font-family="${fontStack}" font-size="10" font-style="italic" fill="${PALETTE.muted}">${escapeXml(
          opts.footerLine2
        )}</text>`
      );
    }
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  ${lines.join("\n  ")}
</svg>`;

  return await sharp(Buffer.from(svg, "utf-8"), { density: 192 })
    .resize({ width: width * 2 })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Very small text-wrapping helper that breaks on whitespace using an
 * approximate character width. Good enough for short stamp labels.
 */
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const avgCharWidth = fontSize * 0.62;
  const maxChars = Math.max(8, Math.floor(maxWidth / avgCharWidth));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
