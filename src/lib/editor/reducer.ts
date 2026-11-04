/**
 * Editor reducer with undo/redo history.
 *
 * Every mutation in the studio goes through here — one code path, one
 * history stack, so Ctrl-Z/toolbar-undo can never miss an operation. The
 * project is plain data, so snapshots are shallow copies of the tree at
 * each committed action (cheap for a phone-sized timeline).
 */

import {
  clipDuration,
  duplicateClip,
  moveClip,
  splitClip,
  trimClip,
  MIN_CLIP_SECONDS,
} from './timeline';
import {
  uid,
  type AspectRatio,
  type AudioClip,
  type CaptionCue,
  type EditorProject,
  type OverlayLayer,
  type TextLayer,
  type VideoClip,
} from './types';

export interface EditorHistory {
  past: EditorProject[];
  present: EditorProject;
  future: EditorProject[];
}

export const MAX_HISTORY = 60;

export type EditorAction =
  | { type: 'load'; project: EditorProject }
  | { type: 'rename'; name: string }
  | { type: 'add-clips'; clips: VideoClip[] }
  | { type: 'delete-clip'; id: string }
  | { type: 'duplicate-clip'; id: string }
  | { type: 'move-clip'; id: string; to: number }
  | { type: 'trim'; id: string; inPoint?: number; outPoint?: number }
  | { type: 'split'; id: string; local: number }
  | { type: 'clip-props'; id: string; patch: Partial<VideoClip> }
  | { type: 'add-audio'; clip: AudioClip }
  | { type: 'audio-props'; id: string; patch: Partial<AudioClip> }
  | { type: 'remove-audio'; id: string }
  | { type: 'add-text'; layer: TextLayer }
  | { type: 'text-props'; id: string; patch: Partial<TextLayer> }
  | { type: 'remove-text'; id: string }
  | { type: 'add-overlay'; layer: OverlayLayer }
  | { type: 'overlay-props'; id: string; patch: Partial<OverlayLayer> }
  | { type: 'remove-overlay'; id: string }
  | { type: 'add-caption'; cue: CaptionCue }
  | { type: 'caption-props'; id: string; patch: Partial<CaptionCue> }
  | { type: 'remove-caption'; id: string }
  | { type: 'set-captions'; cues: CaptionCue[] }
  | { type: 'set-aspect'; aspect: AspectRatio; locked: boolean }
  | { type: 'undo' }
  | { type: 'redo' };

/** Actions that change the project (everything except undo/redo/load). */
function applyEdit(project: EditorProject, action: EditorAction): EditorProject {
  switch (action.type) {
    case 'rename':
      return { ...project, name: action.name.slice(0, 80) };

    case 'add-clips': {
      const clips = [...project.clips, ...action.clips];
      const aspect =
        project.aspectLocked && project.clips.length === 0 && action.clips[0]
          ? {
              w: action.clips[0].sourceWidth || 16,
              h: action.clips[0].sourceHeight || 9,
            }
          : project.aspect;
      return { ...project, clips, aspect };
    }

    case 'delete-clip':
      return { ...project, clips: project.clips.filter((c) => c.id !== action.id) };

    case 'duplicate-clip':
      return { ...project, clips: duplicateClip(project.clips, action.id) };

    case 'move-clip':
      return { ...project, clips: moveClip(project.clips, action.id, action.to) };

    case 'trim':
      return {
        ...project,
        clips: project.clips.map((c) =>
          c.id === action.id
            ? trimClip(c, action.inPoint, action.outPoint)
            : c,
        ),
      };

    case 'split': {
      const index = project.clips.findIndex((c) => c.id === action.id);
      if (index === -1) return project;
      const parts = splitClip(project.clips[index], action.local);
      if (!parts) return project;
      const clips = project.clips.slice();
      clips.splice(index, 1, parts[0], parts[1]);
      return { ...project, clips };
    }

    case 'clip-props':
      return {
        ...project,
        clips: project.clips.map((c) => {
          if (c.id !== action.id) return c;
          const next = { ...c, ...action.patch };
          // Speed/trim edits must stay inside the source bounds.
          next.inPoint = Math.max(0, Math.min(next.inPoint, next.sourceDuration - MIN_CLIP_SECONDS));
          next.outPoint = Math.max(
            next.inPoint + MIN_CLIP_SECONDS,
            Math.min(next.outPoint, next.sourceDuration),
          );
          next.speed = Math.min(4, Math.max(0.25, next.speed));
          return next;
        }),
      };

    case 'add-audio':
      return { ...project, audio: [...project.audio, action.clip] };
    case 'audio-props':
      return {
        ...project,
        audio: project.audio.map((a) => {
          if (a.id !== action.id) return a;
          const next = { ...a, ...action.patch };
          next.offset = Math.max(0, Math.min(next.offset, Math.max(0, next.duration - MIN_CLIP_SECONDS)));
          next.start = Math.max(0, next.start);
          next.volume = Math.min(1, Math.max(0, next.volume));
          next.fadeIn = Math.max(0, Math.min(next.fadeIn, clipDurationAudio(next)));
          next.fadeOut = Math.max(0, Math.min(next.fadeOut, clipDurationAudio(next)));
          return next;
        }),
      };
    case 'remove-audio':
      return { ...project, audio: project.audio.filter((a) => a.id !== action.id) };

    case 'add-text':
      return { ...project, texts: [...project.texts, action.layer] };
    case 'text-props':
      return {
        ...project,
        texts: project.texts.map((t) =>
          t.id === action.id
            ? { ...t, ...action.patch, duration: Math.max(0.2, action.patch.duration ?? t.duration) }
            : t,
        ),
      };
    case 'remove-text':
      return { ...project, texts: project.texts.filter((t) => t.id !== action.id) };

    case 'add-overlay':
      return { ...project, overlays: [...project.overlays, action.layer] };
    case 'overlay-props':
      return {
        ...project,
        overlays: project.overlays.map((o) =>
          o.id === action.id
            ? { ...o, ...action.patch, duration: Math.max(0.2, action.patch.duration ?? o.duration) }
            : o,
        ),
      };
    case 'remove-overlay':
      return { ...project, overlays: project.overlays.filter((o) => o.id !== action.id) };

    case 'add-caption':
      return { ...project, captions: [...project.captions, action.cue].sort((a, b) => a.start - b.start) };
    case 'caption-props':
      return {
        ...project,
        captions: project.captions
          .map((c) => {
            if (c.id !== action.id) return c;
            const next = { ...c, ...action.patch };
            if (next.end < next.start + 0.2) next.end = next.start + 0.2;
            return next;
          })
          .sort((a, b) => a.start - b.start),
      };
    case 'remove-caption':
      return { ...project, captions: project.captions.filter((c) => c.id !== action.id) };
    case 'set-captions':
      return { ...project, captions: [...action.cues].sort((a, b) => a.start - b.start) };

    case 'set-aspect':
      return { ...project, aspect: action.aspect, aspectLocked: action.locked };

    default:
      return project;
  }
}

function clipDurationAudio(clip: AudioClip): number {
  return Math.max(MIN_CLIP_SECONDS, clip.duration - clip.offset);
}

const HISTORICAL: EditorAction['type'][] = [
  'rename',
  'add-clips',
  'delete-clip',
  'duplicate-clip',
  'move-clip',
  'trim',
  'split',
  'clip-props',
  'add-audio',
  'audio-props',
  'remove-audio',
  'add-text',
  'text-props',
  'remove-text',
  'add-overlay',
  'overlay-props',
  'remove-overlay',
  'add-caption',
  'caption-props',
  'remove-caption',
  'set-captions',
  'set-aspect',
];

export function editorReducer(
  state: EditorHistory,
  action: EditorAction,
): EditorHistory {
  switch (action.type) {
    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future].slice(0, MAX_HISTORY),
      };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present].slice(-MAX_HISTORY),
        present: next,
        future: state.future.slice(1),
      };
    }
    case 'load':
      return { past: [], present: action.project, future: [] };
    default:
      break;
  }

  if (!HISTORICAL.includes(action.type)) return state;
  const present = applyEdit(state.present, action);
  if (present === state.present) return state;
  return {
    past: [...state.past, state.present].slice(-MAX_HISTORY),
    present,
    future: [],
  };
}

export function initialHistory(project: EditorProject): EditorHistory {
  return { past: [], present: project, future: [] };
}
