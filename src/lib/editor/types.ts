/**
 * Vidnov mobile editor — project data model.
 *
 * Pure serialisable data: no DOM nodes, no object URLs created here, no
 * classes. Every transform the preview shows and every transform the exporter
 * draws is derived from this structure, so the two can never disagree — the
 * single rule the timeline/preview/export triangle is built on.
 */

export type AspectRatio = { w: number; h: number };

/** User adjustments, −100..100 (sharpness 0..100). 0 / 0 = neutral. */
export interface FilterAdjust {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number; // −100 cool … +100 warm
  sharpness: number; // 0..100
}

export type FilterPresetId =
  | 'original'
  | 'vivid'
  | 'warm'
  | 'cool'
  | 'mono'
  | 'cinematic'
  | 'retro';

/**
 * Effects are only listed here if they can be rendered by BOTH the DOM
 * preview and the canvas exporter with the same parameters — a fake effect
 * that only exists in the UI is worse than no effect at all.
 */
export type EffectType = 'blur' | 'vignette' | 'grain' | 'flash' | 'fade';

export interface EffectInstance {
  id: string;
  type: EffectType;
  intensity: number; // 0..100
  start: number; // seconds, clip-relative (0 = clip start)
  duration: number; // seconds inside the clip
}

export type TransitionType = 'none' | 'fade' | 'slide' | 'zoom';

export interface CropRect {
  x: number; // 0..1 of source frame
  y: number;
  w: number;
  h: number;
}

export interface VideoClip {
  id: string;
  name: string;
  /** Same-origin media URL (Vidnov /api/media/serve) or a device object URL. */
  src: string;
  /** Set when the clip came from the seller's Vidnov media library. */
  mediaId?: string;
  /** Natural size of the source file (drives aspect + letterboxing). */
  sourceWidth: number;
  sourceHeight: number;
  sourceDuration: number; // seconds
  inPoint: number; // trim start in source seconds
  outPoint: number; // trim end in source seconds
  speed: number; // 0.25..4
  volume: number; // 0..1 (clip's own audio)
  muted: boolean;
  rotation: 0 | 90 | 180 | 270;
  crop: CropRect | null; // null = full frame
  preset: FilterPresetId;
  adjust: FilterAdjust;
  effects: EffectInstance[];
  /** Transition INTO this clip (crossfade with the previous clip's tail). */
  transitionIn: { type: TransitionType; duration: number };
  /** Cached timeline thumbnail (dataURL), captured on import. */
  thumbnail?: string;
}

export interface AudioClip {
  id: string;
  name: string;
  src: string;
  kind: 'music' | 'sfx' | 'voice';
  start: number; // timeline seconds where playback begins
  duration: number; // seconds available from the source
  offset: number; // seconds into the source file to start from
  volume: number; // 0..1
  fadeIn: number; // seconds
  fadeOut: number; // seconds
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number; // fraction of frame height, 0.02..0.16
  color: string;
  background: string | null; // css colour or null = no background box
  align: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
  shadow: boolean;
}

export type TextAnimation = 'none' | 'fade' | 'slide-up' | 'typewriter';

export interface TextLayer {
  id: string;
  text: string;
  start: number; // timeline seconds
  duration: number;
  x: number; // 0..1 centre anchor
  y: number;
  style: TextStyle;
  animation: TextAnimation;
}

export interface OverlayLayer {
  id: string;
  kind: 'image' | 'sticker'; // sticker = unicode emoji rendered as text
  src: string; // image url/emoji glyph
  name: string;
  start: number;
  duration: number;
  x: number; // 0..1 centre
  y: number;
  width: number; // fraction of frame width (0.05..1.5)
  opacity: number; // 0..1
  rotation: number; // degrees
}

export interface CaptionCue {
  id: string;
  text: string;
  start: number;
  end: number;
}

export interface EditorProject {
  name: string;
  aspect: AspectRatio; // output frame aspect
  aspectLocked: boolean; // true = keep the first clip's aspect (default)
  clips: VideoClip[]; // main video track, ordered
  audio: AudioClip[];
  texts: TextLayer[];
  overlays: OverlayLayer[];
  captions: CaptionCue[];
}

let uidCounter = 0;

/** Short unique id — no crypto dependency so it works in node tests too. */
export function uid(prefix = 'id'): string {
  uidCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${uidCounter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export const NEUTRAL_ADJUST: FilterAdjust = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  sharpness: 0,
};

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 0.07,
  color: '#ffffff',
  background: null,
  align: 'center',
  bold: true,
  italic: false,
  shadow: true,
};

export const FONT_CHOICES = [
  'Inter, system-ui, sans-serif',
  'Georgia, serif',
  'Impact, system-ui, sans-serif',
  'Courier New, monospace',
  'Verdana, system-ui, sans-serif',
  'Times New Roman, serif',
] as const;
