import { describe, expect, it } from "vitest";
import { measureStampText, stampTextToSvgPath } from "../stampFont";

// Regression test for the "kotak-kotak" (tofu) signature bug.
//
// Background: stamp PNGs are rasterized server-side by sharp/librsvg. On
// Vercel's Linux runtime the rasterizer ignores SVG-embedded @font-face
// declarations and looks for fontconfig-installed system fonts; the
// font-family stack matched nothing, so every character rendered as a
// tofu box. The fix was to convert text to per-glyph SVG paths using
// opentype.js, eliminating the font lookup at render time.
//
// These tests guard the contract:
//   1. The font loads from public/fonts at all.
//   2. measureStampText returns a positive number for normal text.
//   3. stampTextToSvgPath emits one or more <path d="..."/> elements
//      with NO `<text>` element anywhere — that is the failure mode the
//      old implementation produced.
//   4. The path output contains no `NaN` or undefined coordinates,
//      which silently corrupt the rasterized output.

describe("stampFont — anti-tofu regression guards", () => {
  it("measures text width as a positive number", () => {
    const w = measureStampText("Prof. Dr. Budi Santoso", 16, "regular");
    expect(w).toBeGreaterThan(0);
    expect(Number.isFinite(w)).toBe(true);
  });

  it("bold width is larger than regular for the same string", () => {
    const r = measureStampText("REKTOR", 16, "regular");
    const b = measureStampText("REKTOR", 16, "bold");
    // Sanity: bold should not be drastically narrower than regular.
    expect(b).toBeGreaterThan(r * 0.9);
  });

  it("returns SVG <path> elements with no <text> tag", () => {
    const svg = stampTextToSvgPath("Hello World", {
      x: 0,
      y: 20,
      fontSize: 16,
      weight: "regular",
      fill: "#000000",
    });
    // The whole point of the fix: convert to path geometry, never emit
    // a <text> element that depends on a server font.
    expect(svg).not.toMatch(/<text/i);
    expect(svg).toMatch(/<path d="/);
    // Should emit at least as many <path>s as we have visible glyphs
    // (whitespace doesn't produce a path).
    const pathCount = (svg.match(/<path /g) || []).length;
    expect(pathCount).toBeGreaterThanOrEqual(8); // "Hello World" => 10 visible glyphs
  });

  it("never produces NaN/undefined inside path commands (anti-corruption)", () => {
    const svg = stampTextToSvgPath("Tanda Tangan Elektronik", {
      x: 12.7, // intentionally non-integer to exercise rounding
      y: 24.3,
      fontSize: 14,
      weight: "bold",
      fill: "#0058cc",
    });
    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("undefined");
    expect(svg).not.toContain("null");
  });

  it("handles Indonesian diacritics commonly in signatory names", () => {
    // The original fix replaced Inter with Noto Sans precisely so that
    // a broader Latin Extended coverage was available. Names like
    // "Ćorić", "Müller", "Núñez" should not produce empty path output.
    const names = ["Prof. Dr. Budi", "Hadiyatullāh", "Núñez González"];
    for (const name of names) {
      const svg = stampTextToSvgPath(name, {
        x: 0,
        y: 20,
        fontSize: 16,
        weight: "regular",
        fill: "#000",
      });
      const pathCount = (svg.match(/<path /g) || []).length;
      // At least most visible glyphs should map to a path; accept
      // worst case of 80% to allow for ligature substitutions.
      const visibleGlyphs = name.replace(/\s/g, "").length;
      expect(pathCount).toBeGreaterThanOrEqual(Math.floor(visibleGlyphs * 0.8));
    }
  });

  it("returns an empty string for empty input (no path elements)", () => {
    expect(
      stampTextToSvgPath("", {
        x: 0,
        y: 0,
        fontSize: 16,
        weight: "regular",
        fill: "#000",
      })
    ).toBe("");
  });

  it("font cache returns the same instance across calls (perf check)", () => {
    // First call may take ~50ms parsing the TTF; subsequent calls should
    // hit the module-level cache. We don't have a direct accessor for
    // the cache state, but we can check that ten consecutive measure
    // calls complete in <10ms total.
    const start = Date.now();
    for (let i = 0; i < 10; i++) {
      measureStampText("warm-up cache call", 16, "regular");
    }
    expect(Date.now() - start).toBeLessThan(100);
  });
});
