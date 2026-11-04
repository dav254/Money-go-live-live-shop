/**
 * Timeline math for the Vidnov editor — pure functions, no DOM.
 *
 * Everything the preview, the timeline strip and the exporter agree on lives
 * here: where each clip sits, what time a playhead maps to inside a source
 * file, and how edits (trim / split / speed / reorder) transform the track.
 */

import {
  NEUTRAL_ADJUST,
  uid,
  type AspectRatio,
  type EditorProject,
  type VideoClip,
} from './types';

export const MIN_CLIP_SECONDS = 0.1;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** One clip's duration on the timeline (speed-adjusted). */
export function clipDuration(clip: VideoClip): number {
  return Math.max(MIN_CLIP_SECONDS, (clip.outPoint - clip.inPoint) / clip.speed);
}

export interface PlacedClip {
  clip: VideoClip;
  index: number;
  start: number; // timeline seconds
  duration: number; // seconds on the timeline
  /** Crossfade window shared with the previous clip (transitionIn). */
  overlap: number;
}

export interface TimelineLayout {
  placed: PlacedClip[];
  total: number;
}

/**
 * Lay clips out end to end. A transition does not add duration — it
 * OVERLAPS the incoming clip's head with the outgoing clip's tail, which is
 * why `start` can move backwards relative to the running cursor.
 */
export function layoutTimeline(clips: VideoClip[]): TimelineLayout {
  const placed: PlacedClip[] = [];
  let cursor = 0;
  clips.forEach((clip, index) => {
    const duration = clipDuration(clip);
    let overlap = 0;
    if (index > 0) {
      const transition = clip.transitionIn;
      if (transition.type !== 'none' && transition.duration > 0) {
        const previousLength = placed[index - 1].duration;
        overlap = Math.min(transition.duration, previousLength / 2, duration / 2);
      }
    }
    const start = index === 0 ? 0 : cursor - overlap;
    placed.push({ clip, index, start, duration, overlap });
    cursor = start + duration;
  });
  return { placed, total: cursor };
}

export interface PlayheadLocation {
  /** Top clip at this time (the incoming clip during a transition). */
  primary: PlacedClip | null;
  /** Outgoing clip still visible under `primary` during a transition. */
  outgoing: PlacedClip | null;
  /** 0..1 — how much of `primary` shows (1 = fully primary). */
  blend: number;
  /** Seconds into `primary`'s timeline span. */
  local: number;
  /** Seconds into `primary`'s source file (trim + speed applied). */
  sourceTime: number;
}

export function locate(layout: TimelineLayout, time: number): PlayheadLocation {
  const empty: PlayheadLocation = {
    primary: null,
    outgoing: null,
    blend: 1,
    local: 0,
    sourceTime: 0,
  };
  if (layout.placed.length === 0) return empty;
  const t = clamp(time, 0, Math.max(0, layout.total - 0.0001));

  let primary = layout.placed[0];
  for (const placed of layout.placed) {
    if (t >= placed.start) primary = placed;
    else break;
  }

  const local = Math.max(0, t - primary.start);
  const sourceTime = primary.clip.inPoint + local * primary.clip.speed;

  if (primary.overlap > 0 && local < primary.overlap && primary.index > 0) {
    const outgoing = layout.placed[primary.index - 1];
    return {
      primary,
      outgoing,
      blend: clamp(local / primary.overlap, 0, 1),
      local,
      sourceTime,
    };
  }
  return { primary, outgoing: null, blend: 1, local, sourceTime };
}

/** Map a clip-relative timeline position to source seconds. */
export function sourceTimeAt(clip: VideoClip, local: number): number {
  return clamp(
    clip.inPoint + local * clip.speed,
    clip.inPoint,
    clip.outPoint,
  );
}

/**
 * Trim a clip by its source in/out points. Both ends are clamped so the
 * clip can never become shorter than MIN_CLIP_SECONDS.
 */
export function trimClip(
  clip: VideoClip,
  inPoint?: number,
  outPoint?: number,
): VideoClip {
  const nextIn = clamp(
    inPoint ?? clip.inPoint,
    0,
    Math.max(0, clip.outPoint - MIN_CLIP_SECONDS),
  );
  const nextOut = clamp(
    outPoint ?? clip.outPoint,
    nextIn + MIN_CLIP_SECONDS,
    clip.sourceDuration || nextIn + MIN_CLIP_SECONDS,
  );
  return { ...clip, inPoint: nextIn, outPoint: nextOut };
}

/**
 * Split a clip at a clip-relative timeline position (seconds from the clip's
 * own start, i.e. after trim, before speed). Returns null when the cut lands
 * outside the trimmed range — nothing is ever silently shortened.
 */
export function splitClip(
  clip: VideoClip,
  local: number,
): [VideoClip, VideoClip] | null {
  const cut = clip.inPoint + local * clip.speed;
  if (cut <= clip.inPoint + MIN_CLIP_SECONDS / 2) return null;
  if (cut >= clip.outPoint - MIN_CLIP_SECONDS / 2) return null;
  const left: VideoClip = { ...clip, id: uid('clip'), outPoint: cut };
  const right: VideoClip = {
    ...clip,
    id: uid('clip'),
    inPoint: cut,
    // The second half gets its own clean head — the transition it inherited
    // belonged to the original clip's start.
    transitionIn: { type: 'none', duration: 0 },
    effects: clip.effects.map((e) => ({
      ...e,
      start: Math.max(0, e.start - local),
    })),
  };
  return [left, right];
}

/** Reorder a clip to a new index (the timeline's drag/arrow move). */
export function moveClip(clips: VideoClip[], id: string, toIndex: number): VideoClip[] {
  const from = clips.findIndex((c) => c.id === id);
  if (from === -1) return clips;
  const target = clamp(toIndex, 0, clips.length - 1);
  if (target === from) return clips;
  const next = clips.slice();
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}

export function duplicateClip(clips: VideoClip[], id: string): VideoClip[] {
  const index = clips.findIndex((c) => c.id === id);
  if (index === -1) return clips;
  const source = clips[index];
  const copy: VideoClip = {
    ...source,
    id: uid('clip'),
    name: `${source.name} copy`,
    effects: source.effects.map((e) => ({ ...e, id: uid('fx') })),
    transitionIn: { type: 'none', duration: 0 },
  };
  const next = clips.slice();
  next.splice(index + 1, 0, copy);
  return next;
}

/** End time of timed layer items (audio/text/overlay). */
export function layerEnd(items: Array<{ start: number; duration: number }>): number {
  return items.reduce((max, item) => Math.max(max, item.start + item.duration), 0);
}

export function captionEnd(cues: Array<{ start: number; end: number }>): number {
  return cues.reduce((max, cue) => Math.max(max, cue.end), 0);
}

/** Full project duration: video track or the longest layer, whichever is later. */
export function totalDuration(project: EditorProject): number {
  const layout = layoutTimeline(project.clips);
  return Math.max(
    layout.total,
    layerEnd(project.audio),
    layerEnd(project.texts),
    layerEnd(project.overlays),
    captionEnd(project.captions),
  );
}

/** Which timed layers are visible/audible at time `t`. */
export function itemsAt<T extends { start: number; duration: number }>(
  items: T[],
  t: number,
): T[] {
  return items.filter((item) => t >= item.start && t < item.start + item.duration);
}

/**
 * Effective gain of an audio-layer clip at timeline time `t`, including
 * fade-in/fade-out envelopes. Shared by preview and export so the mix sounds
 * identical in both.
 */
export function audioGainAt(
  clip: { start: number; duration: number; offset: number; volume: number; fadeIn: number; fadeOut: number },
  t: number,
): number {
  if (t < clip.start) return 0;
  const end = clip.start + Math.max(0, clip.duration - clip.offset);
  if (t >= end) return 0;
  let gain = clamp(clip.volume, 0, 1);
  const sinceStart = t - clip.start;
  if (clip.fadeIn > 0) gain *= clamp(sinceStart / clip.fadeIn, 0, 1);
  const untilEnd = end - t;
  if (clip.fadeOut > 0) gain *= clamp(untilEnd / clip.fadeOut, 0, 1);
  return gain;
}

export function captionsAt<T extends { start: number; end: number }>(
  cues: T[],
  t: number,
): T[] {
  return cues.filter((cue) => t >= cue.start && t < cue.end);
}

export interface ImportSpec {
  src: string;
  name: string;
  duration: number;
  width: number;
  height: number;
  mediaId?: string;
  thumbnail?: string;
}

/** Build a clip with every default filled in from an imported source. */
export function makeClip(spec: ImportSpec): VideoClip {
  const duration = Math.max(MIN_CLIP_SECONDS, spec.duration || 1);
  return {
    id: uid('clip'),
    name: spec.name,
    src: spec.src,
    mediaId: spec.mediaId,
    sourceWidth: spec.width || 1280,
    sourceHeight: spec.height || 720,
    sourceDuration: duration,
    inPoint: 0,
    outPoint: duration,
    speed: 1,
    volume: 1,
    muted: false,
    rotation: 0,
    crop: null,
    preset: 'original',
    adjust: { ...NEUTRAL_ADJUST },
    effects: [],
    transitionIn: { type: 'none', duration: 0 },
    thumbnail: spec.thumbnail,
  };
}

/** Displayed (rotation-applied) aspect of a clip's source frame. */
export function displayedAspect(clip: VideoClip): number {
  const size = rotatedSizeNum(clip.sourceWidth, clip.sourceHeight, clip.rotation);
  return size.w / size.h;
}

function rotatedSizeNum(w: number, h: number, rotation: number): { w: number; h: number } {
  return rotation % 180 === 0 ? { w, h } : { w: h, h: w };
}

/**
 * Center-crop the clip's displayed frame to `target` aspect (frame-space
 * fractions, matching render.cropRectPx). `null` target = full frame.
 */
export function cropForAspect(clip: VideoClip, target: number | null): VideoClip['crop'] {
  if (target === null) return null;
  const disp = rotatedSizeNum(clip.sourceWidth, clip.sourceHeight, clip.rotation);
  const current = disp.w / disp.h;
  if (Math.abs(current - target) < 0.005) return null;
  // Normalized window ratio so the window's real-world aspect equals target.
  const r = target * (disp.h / disp.w);
  let w: number;
  let h: number;
  if (r <= 1) {
    w = r;
    h = 1;
  } else {
    w = 1;
    h = 1 / r;
  }
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

/**
 * Uniform centre zoom (1..4): keeps the current window's aspect (original
 * unless a crop exists) while shrinking the visible area by `zoom`.
 */
export function zoomCrop(clip: VideoClip, zoom: number): VideoClip['crop'] {
  const disp = rotatedSizeNum(clip.sourceWidth, clip.sourceHeight, clip.rotation);
  let aspect = disp.w / disp.h;
  if (clip.crop) {
    aspect = (clip.crop.w * disp.w) / (clip.crop.h * disp.h);
  }
  const r = aspect * (disp.h / disp.w);
  let w: number;
  let h: number;
  if (r <= 1) {
    w = r;
    h = 1;
  } else {
    w = 1;
    h = 1 / r;
  }
  const s = clamp(zoom, 1, 6);
  w = clamp(w / s, 0.05, 1);
  h = clamp(h / s, 0.05, 1);
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

export function emptyProject(name = 'Untitled', aspect: AspectRatio = { w: 9, h: 16 }): EditorProject {
  return {
    name,
    aspect,
    aspectLocked: true,
    clips: [],
    audio: [],
    texts: [],
    overlays: [],
    captions: [],
  };
}
