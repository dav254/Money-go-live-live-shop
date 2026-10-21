/**
 * VIDNOV STUDIO — shared types.
 *
 * Two features share this module:
 *
 *   • Classic Studio  — a real, canvas-backed photo editor + promotional
 *     design tool. Everything here is a pure description of an edit: the
 *     adjustments, the crop, and the design overlays that get baked into the
 *     exported file. Nothing in this file touches the DOM, so the maths is
 *     unit-testable in Node and the React canvas component is a thin renderer
 *     over it.
 *
 *   • Living Pictures  — a still photo published with OPTIONAL licensed music.
 *     The photo is an ordinary studio export; the music is a reference to a
 *     catalogue track (see `music-catalog.ts`). A Living Picture with no music
 *     is a perfectly valid document — music is never required and never forced
 *     onto an ordinary photo.
 *
 * DESIGN RULE: an edit is a small, serialisable description. The original
 * upload is never mutated — the seller's source photo is preserved byte-for-
 * byte and the studio renders + exports a SEPARATE derived image. That is what
 * A4 ("preserve the original image") means in practice.
 */

/* ------------------------------------------------------------------ */
/* Canvas presets                                                      */
/* ------------------------------------------------------------------ */

/**
 * Output canvas shapes. Sizes are the EXPORT pixel dimensions — the number of
 * pixels actually written to the exported file, not the on-screen preview
 * size (which is scaled to fit the device).
 */
export interface CanvasPreset {
  id: string;
  label: string;
  /** Export width in px. */
  width: number;
  /** Export height in px. */
  height: number;
  /** Short hint shown under the preset chip. */
  hint: string;
}

/**
 * The three shapes the brief asks for — square (catalogue/feed), portrait
 * (product), story (9:16, full-bleed). Chosen so the long edge never exceeds
 * the media pipeline's 2048px cap (`MEDIA_CONFIG.IMAGE_MAX_DIMENSION`), which
 * keeps a studio export from being re-downscaled on upload.
 */
export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: 'square', label: 'Square', width: 1080, height: 1080, hint: 'Feed & catalogue' },
  { id: 'portrait', label: 'Portrait', width: 1080, height: 1350, hint: 'Product listing' },
  { id: 'story', label: 'Story', width: 1080, height: 1920, hint: 'Full-screen' },
];

export function presetById(id: string): CanvasPreset {
  return CANVAS_PRESETS.find((p) => p.id === id) ?? CANVAS_PRESETS[0];
}

/* ------------------------------------------------------------------ */
/* Adjustments                                                         */
/* ------------------------------------------------------------------ */

/**
 * Tonal + colour adjustments. Every field is a NORMALISED delta in a symmetric
 * range so the UI slider and the maths stay honest:
 *
 *   • [-1, 1] for brightness / contrast / saturation / warmth.
 *   • 0 always means "no change" — the identity value.
 *
 * These map onto CSS/canvas `filter` primitives. The mapping is deliberately
 * linear and bounded: a value outside [-1, 1] is clamped, so a malformed
 * document can never produce an invalid filter string that silently renders a
 * blank canvas.
 */
export interface Adjustments {
  /** -1..1 → brightness(). 0 = unchanged. */
  brightness: number;
  /** -1..1 → contrast(). 0 = unchanged. */
  contrast: number;
  /** -1..1 → saturate(). 0 = unchanged. */
  saturation: number;
  /** -1..1 → warmth (a warm/cool tint baked as a hue-rotate + sepia blend). */
  warmth: number;
}

export const IDENTITY_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
};

/** True when an edit is the identity (no visible change). */
export function isIdentityAdjustments(a: Partial<Adjustments> | null | undefined): boolean {
  if (!a) return true;
  return (
    clampUnit(a.brightness ?? 0) === 0 &&
    clampUnit(a.contrast ?? 0) === 0 &&
    clampUnit(a.saturation ?? 0) === 0 &&
    clampUnit(a.warmth ?? 0) === 0
  );
}

/** Clamp to the [-1, 1] adjustment range; non-finite → 0. */
export function clampUnit(value: number | undefined | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  if (value < -1) return -1;
  if (value > 1) return 1;
  return value;
}

/**
 * A named, reusable look. A filter is just a set of adjustments plus an
 * optional fixed `sepia`/`hue-rotate` the preset pins (e.g. a warm film look).
 * Keeping looks as data means the seller's saved presets survive a reload and
 * the exported file is rendered from the SAME values the preview showed.
 */
export interface LookPreset {
  id: string;
  label: string;
  adjustments: Adjustments;
}

export const LOOK_PRESETS: LookPreset[] = [
  { id: 'original', label: 'Original', adjustments: { ...IDENTITY_ADJUSTMENTS } },
  { id: 'vivid', label: 'Vivid', adjustments: { brightness: 0.04, contrast: 0.18, saturation: 0.35, warmth: 0.05 } },
  { id: 'warm', label: 'Warm', adjustments: { brightness: 0.03, contrast: 0.06, saturation: 0.08, warmth: 0.55 } },
  { id: 'cool', label: 'Cool', adjustments: { brightness: 0.02, contrast: 0.08, saturation: -0.05, warmth: -0.5 } },
  { id: 'mono', label: 'Mono', adjustments: { brightness: 0.02, contrast: 0.22, saturation: -1, warmth: 0 } },
  { id: 'soft', label: 'Soft', adjustments: { brightness: 0.08, contrast: -0.12, saturation: -0.08, warmth: 0.12 } },
];

/* ------------------------------------------------------------------ */
/* Geometry: rotate / flip / crop                                      */
/* ------------------------------------------------------------------ */

/** Rotation in degrees, constrained to the four upright quadrants. */
export type RotateQuarter = 0 | 90 | 180 | 270;

export interface FlipState {
  horizontal: boolean;
  vertical: boolean;
}

export const IDENTITY_FLIP: FlipState = { horizontal: false, vertical: false };

/**
 * A crop rectangle in SOURCE-image pixel coordinates (not percentages), so the
 * exported crop is resolution-independent: the same crop applied to a 4000px
 * original and a 1080px preview selects the same region.
 */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Clamp a crop to lie fully inside a source of the given size, never smaller
 * than 1px, never negative. Guards a hand-edited or desynced crop from
 * producing a zero-area draw that would export a blank file.
 */
export function clampCrop(crop: CropRect, sourceWidth: number, sourceHeight: number): CropRect {
  const w = Math.max(1, Math.min(Math.round(crop.width), sourceWidth));
  const h = Math.max(1, Math.min(Math.round(crop.height), sourceHeight));
  const x = Math.max(0, Math.min(Math.round(crop.x), sourceWidth - w));
  const y = Math.max(0, Math.min(Math.round(crop.y), sourceHeight - h));
  return { x, y, width: w, height: h };
}

/** True when a crop equals the whole source (i.e. no-op). */
export function isFullCrop(crop: CropRect, sourceWidth: number, sourceHeight: number): boolean {
  const c = clampCrop(crop, sourceWidth, sourceHeight);
  return c.x === 0 && c.y === 0 && c.width === sourceWidth && c.height === sourceHeight;
}

/* ------------------------------------------------------------------ */
/* Design overlays                                                     */
/* ------------------------------------------------------------------ */

export type OverlayKind = 'text' | 'price' | 'badge' | 'shape';

/**
 * An overlay positioned in NORMALISED canvas coordinates (0..1), anchored by
 * its centre. Normalised coords mean a design laid out on a 1080 square maps
 * exactly onto a 1080×1920 story without rescaling maths in the renderer, and
 * moving an element is a matter of updating two fractions.
 */
export interface Overlay {
  id: string;
  kind: OverlayKind;
  /** Centre X in 0..1 of canvas width. */
  x: number;
  /** Centre Y in 0..1 of canvas height. */
  y: number;
  /** Text body (text/badge) or label (price). Empty for pure shapes. */
  text?: string;
  /** Sale price shown large; `wasPrice` renders struck-through above it. */
  price?: number;
  wasPrice?: number;
  /** Currency symbol for a price overlay. */
  currency?: string;
  /** Font size as a fraction of canvas height (0.02 = 2% of height). */
  scale?: number;
  color?: string;
  background?: string;
  /** Shape fill for kind='shape'. */
  shape?: 'rect' | 'ellipse';
  /** Corner radius as a fraction of the shorter canvas edge. */
  radius?: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
}

/**
 * Keep an overlay's centre inside the canvas. Overlays are anchored by centre,
 * so the centre may range over the full 0..1 on both axes — the renderer then
 * clamps the drawn box itself. This only sanitises the stored value so a
 * malformed design can't drift an element off-canvas and lose it.
 */
export function clampOverlayPosition(overlay: Pick<Overlay, 'x' | 'y'>): { x: number; y: number } {
  const unit = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5);
  return { x: unit(overlay.x), y: unit(overlay.y) };
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export type ExportFormat = 'image/webp' | 'image/jpeg' | 'image/png';

export interface ExportOptions {
  format: ExportFormat;
  /** 0..1 quality for lossy formats. Ignored for PNG. */
  quality: number;
  /** Longest-edge cap; the export is downscaled to fit, never upscaled. */
  maxDimension: number;
}

/**
 * The export default is WebP at high quality — the same format the media
 * pipeline stores, so a studio export is not re-encoded a second time on
 * upload. Quality is deliberately high (0.92): the whole complaint this
 * feature exists to fix is "compression killed my photo", so the studio must
 * not repeat it.
 */
export const DEFAULT_EXPORT: ExportOptions = {
  format: 'image/webp',
  quality: 0.92,
  maxDimension: 2048,
};

/**
 * Clamp export options into a safe, valid range. A quality of 0 or a max
 * dimension of 1 would produce an unusable file, so both are floored; a format
 * outside the allowed set falls back to WebP.
 */
export function normalizeExport(options: Partial<ExportOptions> | null | undefined): ExportOptions {
  const format: ExportFormat =
    options?.format === 'image/jpeg' || options?.format === 'image/png' || options?.format === 'image/webp'
      ? options.format
      : DEFAULT_EXPORT.format;
  const quality = Number.isFinite(options?.quality)
    ? Math.max(0.5, Math.min(1, options!.quality as number))
    : DEFAULT_EXPORT.quality;
  const maxDimension = Number.isFinite(options?.maxDimension)
    ? Math.max(256, Math.min(4096, Math.round(options!.maxDimension as number)))
    : DEFAULT_EXPORT.maxDimension;
  return { format, quality, maxDimension };
}

/**
 * Compute the on-screen preview scale for a source that must fit inside a
 * box while preserving aspect ratio. Returns a multiplier ≤ 1 unless
 * `allowUpscale` is set. Guards against a zero box (which would divide by
 * zero and yield Infinity).
 */
export function fitScale(
  sourceWidth: number,
  sourceHeight: number,
  boxWidth: number,
  boxHeight: number,
  allowUpscale = false,
): number {
  if (sourceWidth <= 0 || sourceHeight <= 0) return 1;
  if (boxWidth <= 0 || boxHeight <= 0) return 1;
  const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  return allowUpscale ? scale : Math.min(1, scale);
}

/**
 * File-size validation the studio runs BEFORE handing bytes to the upload
 * pipeline, mirroring the server's own cap so the seller gets an instant
 * message instead of a round-trip rejection. Returns true when the blob is
 * within the byte budget.
 */
export function withinExportBudget(bytes: number, maxBytes: number): boolean {
  if (!Number.isFinite(bytes) || bytes < 0) return false;
  return bytes <= maxBytes;
}
