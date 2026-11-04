/**
 * Filters and effects — ONE builder consumed by both the DOM preview (via
 * `style.filter`) and the canvas exporter (via `ctx.filter`). If a value
 * appears here it is genuinely rendered in both places; there is no
 * preview-only or export-only parameter.
 *
 * Known approximation: CSS/canvas filters have no unsharp mask, so
 * `sharpness` is expressed as a small contrast+saturation lift (documented
 * on the slider in the UI). It is real, identical in preview and export,
 * and cannot fake detail that was not in the source — which is exactly what
 * a sharpen control should not do anyway.
 */

import { clamp } from './timeline';
import {
  NEUTRAL_ADJUST,
  type EffectInstance,
  type FilterAdjust,
  type FilterPresetId,
  type VideoClip,
} from './types';

export interface FilterPreset {
  id: FilterPresetId;
  label: string;
  adjust: FilterAdjust;
}

const preset = (
  id: FilterPresetId,
  label: string,
  adjust: Partial<FilterAdjust>,
): FilterPreset => ({ id, label, adjust: { ...NEUTRAL_ADJUST, ...adjust } });

export const FILTER_PRESETS: FilterPreset[] = [
  preset('original', 'Original', {}),
  preset('vivid', 'Vivid', { brightness: 6, contrast: 14, saturation: 26 }),
  preset('warm', 'Warm', { temperature: 55, saturation: 8 }),
  preset('cool', 'Cool', { temperature: -50, saturation: -4 }),
  preset('mono', 'Mono', { saturation: -100, contrast: 10 }),
  preset('cinematic', 'Cinematic', { contrast: 18, saturation: -12, brightness: -4 }),
  preset('retro', 'Retro', { temperature: 35, saturation: -18, contrast: -6, brightness: 6 }),
];

export function presetAdjust(id: FilterPresetId): FilterAdjust {
  return FILTER_PRESETS.find((p) => p.id === id)?.adjust ?? { ...NEUTRAL_ADJUST };
}

/** Preset + user adjustments, summed and clamped (never runaway values). */
export function resolveAdjust(presetId: FilterPresetId, user: FilterAdjust): FilterAdjust {
  const base = presetAdjust(presetId);
  return {
    brightness: clamp(base.brightness + user.brightness, -100, 100),
    contrast: clamp(base.contrast + user.contrast, -100, 100),
    saturation: clamp(base.saturation + user.saturation, -100, 100),
    temperature: clamp(base.temperature + user.temperature, -100, 100),
    sharpness: clamp(user.sharpness, 0, 100),
  };
}

/** True when a clip renders differently from the raw source. */
export function hasVisibleAdjust(clip: VideoClip): boolean {
  const a = resolveAdjust(clip.preset, clip.adjust);
  return (
    a.brightness !== 0 ||
    a.contrast !== 0 ||
    a.saturation !== 0 ||
    a.temperature !== 0 ||
    a.sharpness > 0
  );
}

function cssParts(a: FilterAdjust): string[] {
  const parts: string[] = [];
  const brightness = clamp(1 + a.brightness / 100, 0, 4);
  const contrast = clamp(1 + a.contrast / 100, 0, 4);
  const sharp = clamp(a.sharpness, 0, 100) / 100;
  const saturation = Math.max(0, (1 + a.saturation / 100) * (1 + sharp * 0.06));

  parts.push(`brightness(${brightness.toFixed(3)})`);
  parts.push(`contrast(${(contrast * (1 + sharp * 0.08)).toFixed(3)})`);
  parts.push(`saturate(${saturation.toFixed(3)})`);

  const temp = a.temperature;
  if (temp > 0) {
    // Warmth ≈ a light sepia wash; strength scales with the slider.
    parts.push(`sepia(${((temp / 100) * 0.35).toFixed(3)})`);
  } else if (temp < 0) {
    const cool = -temp / 100;
    parts.push(`hue-rotate(${(-18 * cool).toFixed(1)}deg)`);
    parts.push(`saturate(${(1 + cool * 0.15).toFixed(3)})`);
    parts.push(`brightness(${(1 + cool * 0.04).toFixed(3)})`);
  }
  return parts;
}

/** Envelope 0..1 for an effect at a clip-relative time (20% ramps at both ends). */
export function effectEnvelope(effect: EffectInstance, local: number): number {
  const { start, duration, intensity } = effect;
  if (duration <= 0 || intensity <= 0) return 0;
  if (local < start || local >= start + duration) return 0;
  const progress = (local - start) / duration;
  const ramp = Math.min(0.2, 0.5 / Math.max(duration, 0.001));
  const inRamp = clamp(progress / Math.max(ramp, 0.0001), 0, 1);
  const outRamp = clamp((1 - progress) / Math.max(ramp, 0.0001), 0, 1);
  return (intensity / 100) * Math.min(inRamp, outRamp);
}

export function activeEffects(clip: VideoClip, local: number): EffectInstance[] {
  return clip.effects.filter((e) => effectEnvelope(e, local) > 0);
}

export interface EffectOverlays {
  vignette: number; // 0..1 strength
  grain: number; // 0..1 opacity
  fade: number; // 0..1 black overlay
}

export function effectOverlays(clip: VideoClip, local: number): EffectOverlays {
  const out: EffectOverlays = { vignette: 0, grain: 0, fade: 0 };
  for (const effect of clip.effects) {
    const env = effectEnvelope(effect, local);
    if (env <= 0) continue;
    if (effect.type === 'vignette') out.vignette = Math.max(out.vignette, env);
    else if (effect.type === 'grain') out.grain = Math.max(out.grain, env);
    else if (effect.type === 'fade') out.fade = Math.max(out.fade, env);
  }
  return out;
}

/**
 * The filter string for a clip at a clip-relative time: adjustments plus the
 * filter-shaped effects (blur / flash). Used verbatim by preview and export.
 */
export function clipFilterCss(clip: VideoClip, local: number): string {
  const parts = cssParts(resolveAdjust(clip.preset, clip.adjust));
  for (const effect of activeEffects(clip, local)) {
    const env = effectEnvelope(effect, local);
    if (effect.type === 'blur') {
      parts.push(`blur(${(env * 8).toFixed(2)}px)`);
    } else if (effect.type === 'flash') {
      parts.push(`brightness(${(1 + env * 0.9).toFixed(3)})`);
    }
  }
  return parts.join(' ');
}

/** Progress 0..1 of a text animation, or 1 when animation is off. */
export function animationProgress(
  animation: 'none' | 'fade' | 'slide-up' | 'typewriter',
  progress: number,
): { alpha: number; offset: number; chars: number | null } {
  const p = clamp(progress, 0, 1);
  switch (animation) {
    case 'none':
      return { alpha: 1, offset: 0, chars: null };
    case 'fade':
      return { alpha: Math.min(1, p * 3), offset: 0, chars: null };
    case 'slide-up':
      return { alpha: Math.min(1, p * 3), offset: (1 - Math.min(1, p * 3)) * 0.04, chars: null };
    case 'typewriter':
      return { alpha: 1, offset: 0, chars: Math.floor(p * 60) };
    default:
      return { alpha: 1, offset: 0, chars: null };
  }
}
