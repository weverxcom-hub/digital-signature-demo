import sharp from "sharp";
import { renderQrPng } from "./qr";
import {
  measureStampText,
  stampTextToSvgPath,
  type StampFontWeight,
} from "./stampFont";

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
  /** Optional logo to embed in the center of the QR code. */
  qrLogo?: {
    bytes: Buffer | Uint8Array;
    mimeType: string | null;
  } | null;
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
 * an optional footer line about the issuing authority.
 *
 * Text is type-set into SVG `<path>` elements using the bundled Noto
 * Sans font (see `stampFont.ts`). We avoid `<text>` + `font-family`
 * because librsvg on Vercel's serverless image ignores `@font-face`
 * declarations and falls back to a font that lacks the glyphs we need,
 * producing tofu (□) boxes for every character. Converting to paths
 * sidesteps the rasterizer's font lookup entirely.
 */
export async function renderSignatureStamp(opts: StampOptions): Promise<Buffer> {
  const width = opts.width ?? 720;
  const padding = 24;
  const qrSize = 180;
  const rowGap = 8;

  // Render the QR PNG separately (with optional logo overlay) and embed
  // it into the SVG as a base64 data URL.
  const qrPng = await renderQrPng({
    url: opts.verifyUrl,
    size: qrSize * 4, // render 4x and let SVG downscale for crispness
    margin: 1,
    logo: opts.qrLogo ?? null,
  });
  const qrDataUrl = `data:image/png;base64,${qrPng.toString("base64")}`;

  const textX = padding + qrSize + 24;
  const textWidth = width - textX - padding;

  // Wrap long position strings so titles like "Wakil Rektor Bidang
  // Akademik dan Kemahasiswaan" don't overflow the stamp. We measure
  // with opentype.js so the wrapping uses the same metrics we'll
  // typeset paths with.
  const positionLines = wrapText(
    opts.signatoryPosition.toUpperCase(),
    textWidth,
    13,
    "bold"
  );
  const unitLines = opts.signatoryUnit
    ? wrapText(opts.signatoryUnit, textWidth, 12, "regular")
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
    stampTextToSvgPath("Ditandatangani secara elektronik oleh:", {
      x: textX,
      y: ty,
      fontSize: 12,
      weight: "regular",
      fill: PALETTE.muted,
    })
  );
  ty += lineHeight + rowGap;
  for (const ln of positionLines) {
    lines.push(
      stampTextToSvgPath(ln, {
        x: textX,
        y: ty,
        fontSize: 13,
        weight: "bold",
        fill: PALETTE.ink,
      })
    );
    ty += lineHeight;
  }
  ty += rowGap;
  for (const ln of unitLines) {
    lines.push(
      stampTextToSvgPath(ln, {
        x: textX,
        y: ty,
        fontSize: 12,
        weight: "regular",
        fill: PALETTE.muted,
      })
    );
    ty += lineHeight;
  }
  if (unitLines.length) ty += rowGap;
  lines.push(
    stampTextToSvgPath(opts.signatoryName, {
      x: textX,
      y: ty,
      fontSize: 14,
      weight: "bold",
      fill: PALETTE.ink,
    })
  );

  // Footer disclaimer (rendered in regular weight; no italic because we
  // don't bundle an italic font and a CSS-style skew would distort
  // diacritics in Indonesian names).
  if (hasFooter) {
    const fy = contentBottom + padding + 18;
    if (opts.footerLine1) {
      lines.push(
        stampTextToSvgPath(opts.footerLine1, {
          x: padding,
          y: fy,
          fontSize: 10,
          weight: "regular",
          fill: PALETTE.muted,
        })
      );
    }
    if (opts.footerLine2) {
      lines.push(
        stampTextToSvgPath(opts.footerLine2, {
          x: padding,
          y: fy + 14,
          fontSize: 10,
          weight: "regular",
          fill: PALETTE.muted,
        })
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
 * Word-wrap helper that uses the same opentype.js metrics as the renderer
 * so wrapped lines match the actual painted width.
 */
function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  weight: StampFontWeight
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const candidateWidth = measureStampText(candidate, fontSize, weight);
    if (candidateWidth <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}
