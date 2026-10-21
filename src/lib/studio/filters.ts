/**
 * STUDIO FILTERS — turn normalised adjustments into a real canvas/CSS filter
 * string.
 *
 * This is the piece that makes the editing controls honest. The same string
 * built here is applied BOTH to the on-screen preview (`ctx.filter` / CSS
 * `filter`) and to the off-screen export canvas, so what the seller sees is
 * what gets written to the file. Nothing here is a preview-only CSS trick —
 * the export path calls this very same function, so a control that moves the
 * preview necessarily changes the exported pixels.
 *
 * Why not a "real" pixel pipeline? The brief says prefer browser-native Canvas
 * APIs and avoid GPU-dependent processing. `ctx.filter` is the browser's own
 * colour pipeline: it is applied by the compositor on the CPU fallback path
 * too, it round-trips through `drawImage` (so the exported bitmap carries the
 * adjustment), and it needs no dependency. The maths below simply maps the
 * normalised [-1, 1] deltas onto the CSS filter primitives' own ranges.
 */

import { type Adjustments, clampUnit, isIdentityAdjustments } from './types';

/**
 * Map a normalised adjustment to a CSS filter primitive value.
 *
 * The CSS primitives are asymmetric and have no defined "negative" form for
 * brightness/saturation, so we map the symmetric [-1, 1] delta onto each
 * primitive's positive range around its neutral point:
 *
 *   brightness: neutral 1 (0 → 1.0, +1 → 1.6, -1 → 0.5)
 *   contrast:   neutral 1 (0 → 1.0, +1 → 1.6, -1 → 0.6)
 *   saturate:   neutral 1 (0 → 1.0, +1 → 1.9, -1 → 0.0 → full grey)
 *
 * Warmth has no direct primitive, so it is expressed as a hue-rotate toward
 * orange (warm) or blue (cool). It is deliberately gentle — a strong hue
 * rotation reads as a broken filter, not a look.
 */
function brightnessOf(delta: number): number {
  return delta >= 0 ? 1 + delta * 0.6 : 1 + delta * 0.5;
}

function contrastOf(delta: number): number {
  return delta >= 0 ? 1 + delta * 0.6 : 1 + delta * 0.4;
}

function saturateOf(delta: number): number {
  // Negative deltas are linear so the bottom of the range reaches TRUE grey
  // (saturate 0) — a Mono look must fully desaturate, not stop just short.
  // Positive deltas are gently compressed to avoid an over-cooked result.
  return Math.max(0, delta >= 0 ? 1 + delta * 0.9 : 1 + delta);
}

/** Degrees of hue rotation for a warmth delta (-1 cool … +1 warm). */
function warmthRotation(delta: number): number {
  // Warm pushes toward orange (~+20°), cool toward blue (~-20°).
  return delta * 20;
}

/**
 * Build the CSS/canvas `filter` string for a set of adjustments.
 *
 * Returns the empty string for the identity (no change), which is both the
 * correct CSS value for "no filter" and lets the export path skip an
 * unnecessary filter application entirely — a no-op edit exports a pixel-
 * identical bitmap rather than one that has round-tripped through the colour
 * pipeline for nothing.
 */
export function buildFilterString(adjustments: Partial<Adjustments> | null | undefined): string {
  if (isIdentityAdjustments(adjustments)) return '';

  const brightness = clampUnit(adjustments?.brightness ?? 0);
  const contrast = clampUnit(adjustments?.contrast ?? 0);
  const saturation = clampUnit(adjustments?.saturation ?? 0);
  const warmth = clampUnit(adjustments?.warmth ?? 0);

  const parts: string[] = [];
  parts.push(`brightness(${brightnessOf(brightness).toFixed(3)})`);
  parts.push(`contrast(${contrastOf(contrast).toFixed(3)})`);
  parts.push(`saturate(${saturateOf(saturation).toFixed(3)})`);
  if (warmth !== 0) {
    parts.push(`hue-rotate(${warmthRotation(warmth).toFixed(1)}deg)`);
  }
  return parts.join(' ');
}

/**
 * Apply adjustments to a source canvas into a destination context at a given
 * scale. This is the single draw primitive both the preview and the export
 * use: it sets `ctx.filter`, draws the source, then resets the filter so
 * overlays drawn afterwards are NOT tone-mapped by the photo's adjustments
 * (a price badge should stay crisp white, not pick up the warmth tint).
 *
 * Kept here (rather than in the component) so the "does the export really
 * apply the filter?" question has one answer that tests can import.
 */
export function applyAdjustmentsToContext(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  options: {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    dx: number;
    dy: number;
    dw: number;
    dh: number;
    adjustments: Partial<Adjustments> | null | undefined;
  },
): void {
  const filter = buildFilterString(options.adjustments);
  // Save/restore so a consumer's clip or transform survives the call.
  ctx.save();
  ctx.filter = filter || 'none';
  ctx.drawImage(
    source,
    options.sx,
    options.sy,
    options.sw,
    options.sh,
    options.dx,
    options.dy,
    options.dw,
    options.dh,
  );
  ctx.restore();
}
