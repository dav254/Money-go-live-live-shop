/**
 * Canvas frame renderer — draws exactly one frame of the project at time `t`.
 *
 * The DOM preview mirrors these numbers (same fit rects, same crop insets,
 * same `clipFilterCss()` strings, same layer positions), so what the phone
 * shows while editing is what the exporter records. All geometry is derived
 * from `fitRect()` / `cropRectPx()` — never re-computed ad hoc in the UI.
 */

import {
  animationProgress,
  clipFilterCss,
  effectOverlays,
} from './filters';
import { captionsAt, itemsAt, layoutTimeline, locate, type TimelineLayout } from './timeline';
import type { EditorProject, OverlayLayer, TextLayer, VideoClip } from './types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Contain-fit `source` (already rotation-adjusted) inside `frame`, centred.
 * Rotation swaps which dimensions are compared, so callers pass the rotated
 * source size and receive the box the picture occupies on screen.
 */
export function fitRect(
  frame: { w: number; h: number },
  source: { w: number; h: number },
): Rect {
  const sw = Math.max(1, source.w);
  const sh = Math.max(1, source.h);
  const scale = Math.min(frame.w / sw, frame.h / sh);
  const w = sw * scale;
  const h = sh * scale;
  return { x: (frame.w - w) / 2, y: (frame.h - h) / 2, w, h };
}

/** Rotated source size (90/270 swap). */
export function rotatedSize(
  width: number,
  height: number,
  rotation: number,
): { w: number; h: number } {
  return rotation % 180 === 0 ? { w: width, h: height } : { w: height, h: width };
}

/**
 * Crop rectangle in FRAME-SPACE fractions of the fitted picture (0..1 of the
 * rotated, fitted box). `null` crop = whole picture.
 */
export function cropRectPx(box: Rect, crop: VideoClip['crop']): Rect {
  if (!crop) return box;
  return {
    x: box.x + crop.x * box.w,
    y: box.y + crop.y * box.h,
    w: crop.w * box.w,
    h: crop.h * box.h,
  };
}

/** CSS clip-path for the same crop (preview side of the contract). */
export function cropClipPath(crop: VideoClip['crop']): string | undefined {
  if (!crop) return undefined;
  const right = Math.max(0, 1 - (crop.x + crop.w));
  const bottom = Math.max(0, 1 - (crop.y + crop.h));
  return `inset(${(crop.y * 100).toFixed(3)}% ${(right * 100).toFixed(3)}% ${(bottom * 100).toFixed(3)}% ${(crop.x * 100).toFixed(3)}%)`;
}

export interface LayerImages {
  /** Loaded image bitmap for an overlay src (null while loading). */
  (src: string): CanvasImageSource | null;
}

export interface DrawFrameInput {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  project: EditorProject;
  layout?: TimelineLayout;
  t: number;
  /** The video element currently decoding this clip (export rig / preview). */
  videoFor(clip: VideoClip): HTMLVideoElement | null;
  imageFor: LayerImages;
  /** ctx.filter support — false on older Safari: filters are skipped honestly. */
  supportFilter: boolean;
}

const GRAIN_TILE = 96;

/** Deterministic noise tile reused every frame (preview uses an SVG equivalent). */
let grainPattern: CanvasPattern | null = null;
function getGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (grainPattern) return grainPattern;
  const tile = document.createElement('canvas');
  tile.width = GRAIN_TILE;
  tile.height = GRAIN_TILE;
  const tctx = tile.getContext('2d');
  if (!tctx) return null;
  const image = tctx.createImageData(GRAIN_TILE, GRAIN_TILE);
  let seed = 1337;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const v = seed % 255;
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  tctx.putImageData(image, 0, 0);
  grainPattern = ctx.createPattern(tile, 'repeat');
  return grainPattern;
}

function drawClip(
  ctx: CanvasRenderingContext2D,
  frame: { w: number; h: number },
  clip: VideoClip,
  local: number,
  alpha: number,
  transform: { dx: number; dy: number; scale: number },
  video: HTMLVideoElement | null,
  supportFilter: boolean,
): boolean {
  if (!video || video.readyState < 2) return false;
  const nw = video.videoWidth || clip.sourceWidth || 16;
  const nh = video.videoHeight || clip.sourceHeight || 9;
  const rotated = rotatedSize(nw, nh, clip.rotation);
  const box = fitRect(frame, rotated);

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  // Transition transform around the frame centre.
  if (transform.dx !== 0 || transform.dy !== 0 || transform.scale !== 1) {
    ctx.translate(frame.w / 2, frame.h / 2);
    ctx.scale(transform.scale, transform.scale);
    ctx.translate(-frame.w / 2 + transform.dx, -frame.h / 2 + transform.dy);
  }

  // Crop clip in frame space (matches the preview's clip-path insets).
  const cropBox = cropRectPx(box, clip.crop);
  ctx.beginPath();
  ctx.rect(cropBox.x, cropBox.y, cropBox.w, cropBox.h);
  ctx.clip();

  if (supportFilter) {
    ctx.filter = clipFilterCss(clip, local);
  }

  // Draw the picture rotated inside its fitted box.
  ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
  ctx.rotate((clip.rotation * Math.PI) / 180);
  const swap = clip.rotation % 180 !== 0;
  const dw = swap ? box.h : box.w;
  const dh = swap ? box.w : box.h;
  ctx.drawImage(video, -dw / 2, -dh / 2, dw, dh);

  ctx.restore();
  return true;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      out.push('');
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = '';
    for (const word of words) {
      const probe = line ? `${line} ${word}` : word;
      if (ctx.measureText(probe).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = probe;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  frame: { w: number; h: number },
  layer: TextLayer,
  t: number,
): void {
  const progress = Math.max(0.001, Math.min(1, (t - layer.start) / Math.max(0.2, layer.duration)));
  const anim = animationProgress(layer.animation, progress);
  if (anim.alpha <= 0) return;

  const size = Math.round(layer.style.fontSize * frame.h);
  ctx.save();
  ctx.globalAlpha = anim.alpha;
  ctx.font = [
    layer.style.italic ? 'italic' : '',
    layer.style.bold ? '700' : '400',
    `${size}px`,
    layer.style.fontFamily,
  ]
    .filter(Boolean)
    .join(' ');
  ctx.textAlign = layer.style.align;
  ctx.textBaseline = 'middle';

  let text = layer.text;
  if (anim.chars !== null) {
    // Typewriter: reveal whole characters, never a half glyph.
    text = text.slice(0, Math.min(text.length, anim.chars * Math.max(1, Math.ceil(text.length / 60))));
    text = layer.text.slice(
      0,
      Math.round(progress * layer.text.length),
    );
  }

  const maxWidth = frame.w * 0.88;
  const lines = wrapLines(ctx, text, maxWidth);
  const lineHeight = size * 1.25;
  const cx = layer.x * frame.w;
  const cy = layer.y * frame.h + anim.offset * frame.h;

  // Background box behind the whole block.
  if (layer.style.background) {
    let widest = 0;
    for (const line of lines) widest = Math.max(widest, ctx.measureText(line).width);
    const padX = size * 0.35;
    const padY = size * 0.25;
    const blockH = lines.length * lineHeight;
    let bx = cx - widest / 2;
    if (layer.style.align === 'left') bx = cx;
    if (layer.style.align === 'right') bx = cx - widest;
    ctx.fillStyle = layer.style.background;
    roundRectPath(
      ctx,
      bx - padX,
      cy - blockH / 2 - padY,
      widest + padX * 2,
      blockH + padY * 2,
      size * 0.2,
    );
    ctx.fill();
  }

  ctx.fillStyle = layer.style.color;
  if (layer.style.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = Math.max(2, size * 0.12);
    ctx.shadowOffsetY = Math.max(1, size * 0.05);
  }

  lines.forEach((line, i) => {
    const y = cy - ((lines.length - 1) * lineHeight) / 2 + i * lineHeight;
    ctx.fillText(line, cx, y, maxWidth);
  });
  ctx.restore();
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  frame: { w: number; h: number },
  overlay: OverlayLayer,
  t: number,
  imageFor: LayerImages,
): void {
  if (t < overlay.start || t >= overlay.start + overlay.duration) return;
  const cx = overlay.x * frame.w;
  const cy = overlay.y * frame.h;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, overlay.opacity));
  ctx.translate(cx, cy);
  ctx.rotate((overlay.rotation * Math.PI) / 180);

  if (overlay.kind === 'sticker') {
    const size = overlay.width * frame.w;
    ctx.font = `${Math.round(size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(overlay.src, 0, 0);
  } else {
    const img = imageFor(overlay.src);
    if (img) {
      const iw = 'naturalWidth' in img ? (img as HTMLImageElement).naturalWidth : 1;
      const ih = 'naturalHeight' in img ? (img as HTMLImageElement).naturalHeight : 1;
      const w = overlay.width * frame.w;
      const h = (w * ih) / Math.max(1, iw);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    }
  }
  ctx.restore();
}

function drawVignette(
  ctx: CanvasRenderingContext2D,
  frame: { w: number; h: number },
  strength: number,
): void {
  const radius = Math.hypot(frame.w, frame.h) / 2;
  const gradient = ctx.createRadialGradient(
    frame.w / 2,
    frame.h / 2,
    radius * 0.45,
    frame.w / 2,
    frame.h / 2,
    radius,
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${(0.85 * strength).toFixed(3)})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, frame.w, frame.h);
}

/**
 * Draw the whole frame at time `t`. Returns false only when nothing visual
 * was available yet (video still decoding) — callers keep the last frame.
 */
export function drawFrame(input: DrawFrameInput): boolean {
  const { ctx, width, height, project, t } = input;
  const layout = input.layout ?? layoutTimeline(project.clips);
  const frame = { w: width, h: height };

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  if (layout.placed.length === 0) return false;
  const location = locate(layout, t);
  let drewSomething = false;

  // Outgoing clip first (it sits underneath during a transition).
  if (location.outgoing) {
    const out = location.outgoing;
    const outLocal = t - out.start;
    const blend = location.blend;
    const type = location.primary?.clip.transitionIn.type ?? 'fade';
    let transform = { dx: 0, dy: 0, scale: 1 };
    if (type === 'slide') transform = { dx: -blend * width * 0.25, dy: 0, scale: 1 };
    else if (type === 'zoom') transform = { dx: 0, dy: 0, scale: 1 - 0.08 * blend };
    const video = input.videoFor(out.clip);
    drewSomething =
      drawClip(
        ctx,
        frame,
        out.clip,
        outLocal,
        type === 'fade' ? 1 : 1 - blend * 0.4,
        transform,
        video,
        input.supportFilter,
      ) || drewSomething;
  }

  if (location.primary) {
    const placed = location.primary;
    const blend = location.blend;
    const hasOutgoing = location.outgoing !== null;
    const type = placed.clip.transitionIn.type;
    let transform = { dx: 0, dy: 0, scale: 1 };
    let alpha = 1;
    if (hasOutgoing) {
      if (type === 'fade') alpha = blend;
      else if (type === 'slide') transform = { dx: (1 - blend) * width, dy: 0, scale: 1 };
      else if (type === 'zoom') {
        transform = { dx: 0, dy: 0, scale: 1 + 0.12 * (1 - blend) };
        alpha = blend;
      } else {
        alpha = blend; // 'none' still needs a hard visual hand-off
      }
    }
    const video = input.videoFor(placed.clip);
    drewSomething =
      drawClip(
        ctx,
        frame,
        placed.clip,
        location.local,
        alpha,
        transform,
        video,
        input.supportFilter,
      ) || drewSomething;

    // Clip-scoped overlay effects (vignette / grain / fade) in frame space.
    const overlaysFx = effectOverlays(placed.clip, location.local);
    if (alpha > 0.5) {
      // Frame-space effects ride on whichever clip is mostly visible.
      if (overlaysFx.vignette > 0) drawVignette(ctx, frame, overlaysFx.vignette);
      if (overlaysFx.grain > 0) {
        const pattern = getGrainPattern(ctx);
        if (pattern) {
          ctx.save();
          ctx.globalAlpha = overlaysFx.grain * 0.35;
          ctx.globalCompositeOperation = 'overlay';
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }
      }
      if (overlaysFx.fade > 0) {
        ctx.save();
        ctx.globalAlpha = overlaysFx.fade;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    }
  }

  // Overlays, texts and captions live in frame space, above the video.
  for (const overlay of project.overlays) {
    drawOverlay(ctx, frame, overlay, t, input.imageFor);
  }
  for (const text of itemsAt(project.texts, t)) {
    drawTextLayer(ctx, frame, text, t);
  }
  drawCaptions(ctx, frame, project, t);

  return drewSomething;
}

const CAPTION_FONT_SCALE = 0.055;

function drawCaptions(
  ctx: CanvasRenderingContext2D,
  frame: { w: number; h: number },
  project: EditorProject,
  t: number,
): void {
  const cues = captionsAt(project.captions, t);
  if (cues.length === 0) return;
  const cue = cues[0];
  const size = Math.round(CAPTION_FONT_SCALE * frame.h);
  ctx.save();
  ctx.font = `700 ${size}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const maxWidth = frame.w * 0.86;
  const lines = wrapLines(ctx, cue.text, maxWidth);
  const lineHeight = size * 1.25;
  const cx = frame.w / 2;
  const cy = frame.h * 0.86 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, i) => {
    const y = cy + i * lineHeight;
    const w = ctx.measureText(line).width;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRectPath(ctx, cx - w / 2 - size * 0.3, y - size * 0.68, w + size * 0.6, size * 1.36, size * 0.24);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 2;
    ctx.fillText(line, cx, y, maxWidth);
  });
  ctx.restore();
}

