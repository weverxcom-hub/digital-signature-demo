import QRCode from "qrcode";
import sharp from "sharp";

/**
 * Render a QR code PNG with an optional centered logo.
 *
 * QR codes self-correct: at error-correction level "H" they tolerate
 * ~30% of modules being unreadable. Overlaying a small logo in the
 * center is therefore safe as long as the logo covers no more than
 * about 20–25% of the QR width.
 *
 * If `logo` is omitted (or the logo composite fails), this returns a
 * plain QR PNG so the callers always get a scannable code.
 */
export async function renderQrPng(opts: {
  url: string;
  /** Output PNG width in px. Height equals width (square). */
  size: number;
  /** Module quiet zone in QR units. 1 is the smallest valid value. */
  margin?: number;
  logo?: {
    bytes: Buffer | Uint8Array;
    /** MIME type, used to short-circuit obviously unsupported formats. */
    mimeType: string | null;
  } | null;
}): Promise<Buffer> {
  const margin = opts.margin ?? 1;
  // Level "H" tolerates ~30% obscured modules, giving us headroom for
  // the centered logo overlay.
  const qrPng = await QRCode.toBuffer(opts.url, {
    width: opts.size,
    margin,
    errorCorrectionLevel: "H",
  });

  if (!opts.logo || !opts.logo.bytes || opts.logo.bytes.byteLength === 0) {
    return qrPng;
  }

  try {
    // Logo footprint: ~22% of QR width with a white frame so the QR
    // detector sees clean edges around the logo. Square crop keeps the
    // composite predictable regardless of logo aspect ratio.
    const logoSize = Math.round(opts.size * 0.22);
    const frameSize = Math.round(logoSize * 1.18);

    const logoBuf = Buffer.from(opts.logo.bytes);
    const resizedLogo = await sharp(logoBuf, { failOn: "none" })
      .resize(logoSize, logoSize, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();

    const frame = await sharp({
      create: {
        width: frameSize,
        height: frameSize,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([
        {
          input: resizedLogo,
          left: Math.round((frameSize - logoSize) / 2),
          top: Math.round((frameSize - logoSize) / 2),
        },
      ])
      .png()
      .toBuffer();

    return await sharp(qrPng)
      .composite([
        {
          input: frame,
          left: Math.round((opts.size - frameSize) / 2),
          top: Math.round((opts.size - frameSize) / 2),
        },
      ])
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch {
    // Any logo-compositing failure (bad image, sharp decode error, etc.)
    // must NOT break the QR code itself — fall back to the plain code.
    return qrPng;
  }
}
