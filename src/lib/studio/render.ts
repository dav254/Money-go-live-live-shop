/**
 * STUDIO RENDER — the one place a design becomes pixels.
 *
 * Both the on-screen preview canvas and the off-screen export canvas call
 * `renderStudio()`. There is deliberately no second "preview-only" draw path:
 * the guarantee in spec A2 ("controls must update the actual image and final
 * exported file") holds precisely because the preview the seller arranges and
 * the bitmap that gets encoded are produced by this same function.
 *
 * The composition order is fixed and intentional:
 *
 *   1. the source photo (crop → rotate → flip), tone-adjusted via `ctx.filter`
 *   2. design overlays (shapes, then text/price/badges), which are NOT
 *      tone-adjusted — a crisp white price badge must stay white, not pick up
 *      the photo's warmth.
 *
 * Everything is drawn in CANVAS pixel space (the export resolution). The
 * preview simply scales the canvas with CSS, so what is arranged is exactly
 * what is exported.
 */

import {
  type Adjustments,
  type CropRect,
  type FlipState,
  type Overlay,
  type RotateQuarter,
  clampCrop,
  clampOverlayPosition,
  presetById,
} from './types';
import { applyAdjustmentsToContext } from './filters';

export interface StudioComposition {
  /** The loaded source photo. */
  image: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  /** Canvas preset id (square/portrait/story) — decides output resolution. */
  presetId: string;
  adjustments: Partial<Adjustments> | null;
  /** Crop in SOURCE pixel coords (pre-rotation). */
  crop: CropRect;
  rotate: RotateQuarter;
  flip: FlipState;
  overlays: Overlay[];
}

/** Font stack that renders reliably across the platforms Vidnov serves. */
const STUDIO_FONT =
  '800 %SPX "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
const STUDIO_FONT_BODY =
  '600 %SPX "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

/**
 * Draw the full composition into a 2D context sized to the preset. Used by
 * both the preview (device-pixel-ratio aware) and the export (1:1 pixels).
 */
export function renderStudio(ctx: CanvasRenderingContext2D, comp: StudioComposition): void {
  const preset = presetById(comp.presetId);
  const W = preset.width;
  const H = preset.height;

  ctx.save();
  ctx.clearRect(0, 0, W, H);

  // The crop is expressed in source pixels, but rotation swaps the axes, so we
  // compute the source-space crop once and let the transform handle orientation.
  const crop = clampCrop(comp.crop, comp.sourceWidth, comp.sourceHeight);

  // Move the origin to the canvas centre so rotate/flip are symmetric.
  ctx.translate(W / 2, H / 2);
  ctx.rotate((comp.rotate * Math.PI) / 180);
  ctx.scale(comp.flip.horizontal ? -1 : 1, comp.flip.vertical ? -1 : 1);

  // After a 90°/270° rotation the cropped photo's on-canvas footprint is
  // transposed; use the rotated crop dimensions to fit it inside the canvas
  // while preserving aspect ratio (letterbox-free "contain").
  const rotated = comp.rotate === 90 || comp.rotate === 270;
  const cropW = crop.width;
  const cropH = crop.height;
  const fitW = rotated ? cropH : cropW;
  const fitH = rotated ? cropW : cropH;
  const scale = Math.min(W / fitW, H / fitH);
  const drawW = cropW * scale;
  const drawH = cropH * scale;

  // Tone-adjust the photo only. Overlays drawn after restore() are unaffected.
  applyAdjustmentsToContext(ctx, comp.image, {
    sx: crop.x,
    sy: crop.y,
    sw: crop.width,
    sh: crop.height,
    dx: -drawW / 2,
    dy: -drawH / 2,
    dw: drawW,
    dh: drawH,
    adjustments: comp.adjustments,
  });

  ctx.restore();

  // Overlays live in unrotated canvas space (a price tag should not spin with
  // the photo) — drawn after the transform is fully restored.
  for (const overlay of comp.overlays) {
    drawOverlay(ctx, overlay, W, H);
  }
}

/** Resolve the export resolution for a preset id. */
export function presetResolution(presetId: string): { width: number; height: number } {
  const p = presetById(presetId);
  return { width: p.width, height: p.height };
}

/* ------------------------------------------------------------------ */
/* Overlay drawing                                                     */
/* ------------------------------------------------------------------ */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Draw one overlay, clamping its box inside the canvas so a design can never
 * lose an element off an edge (spec A3: "Keep text inside the canvas").
 */
export function drawOverlay(ctx: CanvasRenderingContext2D, overlay: Overlay, W: number, H: number): void {
  const { x, y } = clampOverlayPosition(overlay);
  const cx = x * W;
  const cy = y * H;
  const shortEdge = Math.min(W, H);
  const fontSize = Math.round((overlay.scale ?? 0.05) * H);
  const bold = overlay.bold !== false;

  if (overlay.kind === 'shape') {
    const w = shortEdge * 0.5;
    const h = shortEdge * 0.28;
    const left = clampX(cx - w / 2, w, W);
    const top = clampY(cy - h / 2, h, H);
    ctx.save();
    ctx.fillStyle = overlay.background || 'rgba(0,0,0,0.55)';
    if (overlay.shape === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(left + w / 2, top + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      roundRect(ctx, left, top, w, h, (overlay.radius ?? 0.25) * shortEdge);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  // Text / price / badge all render as a centred, optionally backgrounded label.
  const label = labelFor(overlay);
  ctx.save();
  ctx.font = (bold ? STUDIO_FONT : STUDIO_FONT_BODY).replace('%SPX', String(fontSize));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const paddingX = fontSize * 0.5;
  const paddingY = fontSize * 0.35;
  const metrics = ctx.measureText(label);
  const boxW = metrics.width + paddingX * 2;
  const boxH = fontSize + paddingY * 2;

  const left = clampX(cx - boxW / 2, boxW, W);
  const top = clampY(cy - boxH / 2, boxH, H);

  if (overlay.background) {
    ctx.fillStyle = overlay.background;
    roundRect(ctx, left, top, boxW, boxH, (overlay.radius ?? 0.3) * shortEdge);
    ctx.fill();
  }
  ctx.fillStyle = overlay.color || '#FFFFFF';
  ctx.fillText(label, left + boxW / 2, top + boxH / 2 + fontSize * 0.05);
  ctx.restore();
}

/** Compose the visible string for a text/price/badge overlay. */
function labelFor(overlay: Overlay): string {
  if (overlay.kind === 'price') {
    const symbol = overlay.currency || '';
    const main = `${symbol}${formatPrice(overlay.price)}`;
    if (overlay.wasPrice != null && overlay.wasPrice > (overlay.price ?? 0)) {
      return `${symbol}${formatPrice(overlay.wasPrice)}  ${main}`;
    }
    return main;
  }
  return overlay.text || '';
}

function formatPrice(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** Clamp a box's left edge so the box stays within [0, W]. */
function clampX(left: number, boxW: number, W: number): number {
  return Math.max(0, Math.min(left, W - boxW));
}

/** Clamp a box's top edge so the box stays within [0, H]. */
function clampY(top: number, boxH: number, H: number): number {
  return Math.max(0, Math.min(top, H - boxH));
}

/* ------------------------------------------------------------------ */
/* Export encoding                                                     */
/* ------------------------------------------------------------------ */

/**
 * Encode a canvas to a Blob. Resolves null if the browser cannot produce the
 * requested type (e.g. an old WebP encoder) so the caller can fall back to
 * JPEG rather than upload a zero-byte file.
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), format, quality);
  });
}

/** The file extension for a MIME type, for naming the downloaded/uploaded file. */
export function extensionFor(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
    default:
      return 'webp';
  }
}
