import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";

/**
 * Load and cache the bundled Noto Sans fonts as parsed opentype.js Font objects.
 *
 * Why parse them at all?
 * The stamp PNG is rasterized server-side by sharp / librsvg. On Vercel's
 * serverless Linux runtime, librsvg ignores SVG-embedded `@font-face`
 * declarations and only looks at fontconfig-installed system fonts. Our
 * font stack ("Inter, system-ui, …") matches nothing on that minimal
 * image, so glyph lookups fail and every signatory name renders as tofu
 * (□□□) boxes.
 *
 * The robust fix is to skip SVG text rendering entirely: convert every
 * string to an SVG `<path>` at typesetting time using the parsed font
 * metrics, so the rasterizer only has geometry to draw. This works on
 * any host because no font lookup happens at render time.
 */

let cached: { regular: opentype.Font; bold: opentype.Font } | null = null;

function loadFonts(): { regular: opentype.Font; bold: opentype.Font } {
  if (cached) return cached;
  // process.cwd() points at the project root in both `next dev` and the
  // built serverless function. The font files are committed under
  // `public/fonts/` so they ship with the deployment without us having
  // to wire up a webpack/asset import.
  const fontsDir = path.join(process.cwd(), "public", "fonts");
  // Noto Sans is used instead of Inter because opentype.js fails to
  // parse recent Inter releases (`substitutionType : 62 lookupType: 6`
  // GSUB tables aren't supported). Noto Sans has the same Latin
  // Extended coverage we need for Indonesian names and parses cleanly.
  const regular = opentype.parse(
    fs
      .readFileSync(path.join(fontsDir, "NotoSans-Regular.ttf"))
      .buffer.slice(0)
  );
  const bold = opentype.parse(
    fs.readFileSync(path.join(fontsDir, "NotoSans-Bold.ttf")).buffer.slice(0)
  );
  cached = { regular, bold };
  return cached;
}

export type StampFontWeight = "regular" | "bold";

/**
 * Returns the bundled Noto Sans font for the requested weight.
 */
export function getStampFont(weight: StampFontWeight): opentype.Font {
  return loadFonts()[weight];
}

/**
 * Compute the on-screen width (px) of `text` at `fontSize` for the given
 * weight, using opentype.js advance-width metrics. Used for layout (text
 * wrapping, etc.) so we get the same numbers we use to typeset paths.
 */
export function measureStampText(
  text: string,
  fontSize: number,
  weight: StampFontWeight
): number {
  return getStampFont(weight).getAdvanceWidth(text, fontSize);
}

/**
 * Type-set `text` as one SVG `<path>` element per glyph using the
 * embedded font. The path coordinate system matches SVG defaults
 * (y increases downward), and `(x, y)` is the text baseline anchor of
 * the first glyph.
 *
 * Why one `<path>` per glyph instead of a single combined path?
 * librsvg (the rasterizer sharp uses) silently truncates very long
 * `d="…"` attributes — text strings longer than ~25 characters end up
 * clipped mid-word in the PNG output. Splitting per glyph keeps each
 * `d` attribute short and avoids that limit while still producing a
 * single rasterized image with no font dependency at render time.
 */
export function stampTextToSvgPath(
  text: string,
  options: {
    x: number;
    y: number;
    fontSize: number;
    weight: StampFontWeight;
    fill: string;
  }
): string {
  const font = getStampFont(options.weight);
  const parts: string[] = [];
  // We type-set each glyph at its own pen position so the resulting
  // `<path>` strings are short enough for librsvg to render in full.
  // Advance widths come from the same opentype.js font instance, so
  // metrics match `measureStampText`.
  font.forEachGlyph(
    text,
    options.x,
    options.y,
    options.fontSize,
    {},
    (glyph, gx, gy, fontSize) => {
      // opentype.js has a quirk where certain non-integer pen
      // positions (e.g. after kerned spaces) produce `NaN` in path
      // commands like `LNaN 26.49`, which silently breaks the glyph
      // render. Rounding the pen position to whole pixels avoids
      // that and incidentally improves sharpness when the SVG is
      // rasterized at 1× density.
      const path = glyph.getPath(Math.round(gx), Math.round(gy), fontSize);
      const d = path.toPathData(2);
      if (d) {
        parts.push(`<path d="${d}" fill="${options.fill}"/>`);
      }
    }
  );
  return parts.join("");
}
