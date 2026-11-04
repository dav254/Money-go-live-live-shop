'use client';

/**
 * CapCut-style mobile video editing studio for Vidnov.
 *
 * The preview is a DOM mirror of the canvas exporter: both consume the same
 * fit rects (fitRect), crop insets (cropClipPath / cropRectPx) and filter
 * strings (clipFilterCss), so what the phone shows while editing is what the
 * export records. Playback runs one rAF engine that keeps video elements,
 * music tracks and the playhead synchronised; every edit goes through the
 * shared reducer so undo/redo always matches what the user saw.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  X, Search, Undo2, Redo2, Sparkles, Share2, Play, Pause,
  SkipBack, SkipForward, Maximize2, Minimize2, Plus,
  Scissors, Music, Type, Wand2, Layers3, Captions, SlidersHorizontal, Film,
} from 'lucide-react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { get as idbGet } from '@/lib/idb';
import {
  audioGainAt,
  clamp,
  captionsAt,
  itemsAt,
  layoutTimeline,
  locate,
  totalDuration,
} from '@/lib/editor/timeline';
import {
  animationProgress,
  clipFilterCss,
  effectOverlays,
} from '@/lib/editor/filters';
import {
  cropClipPath,
  fitRect,
  rotatedSize,
} from '@/lib/editor/render';
import { editorReducer, initialHistory } from '@/lib/editor/reducer';
import { clipFromFile, clipFromUrl } from '@/lib/editor/import';
import type { OverlayLayer, TextLayer, VideoClip } from '@/lib/editor/types';
import { EditorTimeline } from './timeline';
import { EditorPanels } from './panels';
import { ExportStudio } from './export-studio';
import { AiWorkspace } from './ai-workspace';
import { MediaPicker, type LibraryItem } from './media-picker';
import { TOOL_LABELS, type Selection, type ToolId } from './shared';

/* --------------------------------------------------------------- preview */

interface SlotProps {
  clip: VideoClip | null;
  frame: { w: number; h: number };
  local: number;
  alpha: number;
  dx: number;
  dy: number;
  scale: number;
  filterCss: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

/**
 * One video slot. Geometry mirrors render.drawClip exactly: frame-space
 * wrapper (transition transform) → fitted box (crop clip-path + filter) →
 * inner video rotated about the box centre.
 */
function PreviewSlot({ clip, frame, local, alpha, dx, dy, scale, filterCss, videoRef }: SlotProps) {
  if (!clip || frame.w <= 0 || frame.h <= 0) return null;
  const rotated = rotatedSize(clip.sourceWidth, clip.sourceHeight, clip.rotation);
  const box = fitRect(frame, rotated);
  const swap = clip.rotation % 180 !== 0;
  return (
    <div
      className="absolute inset-0"
      style={{
        transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scale.toFixed(4)})`,
        transformOrigin: 'center',
        opacity: alpha,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: box.x,
          top: box.y,
          width: box.w,
          height: box.h,
          overflow: 'hidden',
          clipPath: cropClipPath(clip.crop),
          filter: filterCss,
        }}
      >
        <video
          ref={videoRef}
          playsInline
          preload="auto"
          poster={clip.thumbnail}
          className="absolute left-1/2 top-1/2"
          style={{
            width: swap ? box.h : box.w,
            height: swap ? box.w : box.h,
            transform: `translate(-50%,-50%) rotate(${clip.rotation}deg)`,
            objectFit: 'fill',
          }}
        />
      </div>
    </div>
  );
}

const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.9'/%3E%3C/svg%3E\")";

/* ----------------------------------------------------------------- shell */

interface DragState {
  kind: 'text' | 'overlay';
  id: string;
  pointerX: number;
  pointerY: number;
  startClientX: number;
  startClientY: number;
  x: number;
  y: number;
}

export function VideoEditorStudio() {
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();

  const [history, dispatch] = React.useReducer(
    editorReducer,
    null as unknown as ReturnType<typeof initialHistory>,
    () =>
      initialHistory({
        name: 'Untitled edit',
        aspect: { w: 9, h: 16 },
        aspectLocked: true,
        clips: [],
        audio: [],
        texts: [],
        overlays: [],
        captions: [],
      }),
  );
  const project = history.present;

  const [time, setTime] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [tool, setTool] = React.useState<ToolId | null>(null);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showExport, setShowExport] = React.useState(false);
  const [showAi, setShowAi] = React.useState(false);
  const [showPicker, setShowPicker] = React.useState(false);
  const [compare, setCompare] = React.useState(false);
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const [area, setArea] = React.useState({ w: 0, h: 0 });
  const [fullscreen, setFullscreen] = React.useState(false);

  const layout = React.useMemo(() => layoutTimeline(project.clips), [project.clips]);
  const total = React.useMemo(() => totalDuration(project), [project]);
  const location = locate(layout, time);

  // Latest-value refs for the playback engine (rAF must not restart on edits).
  const stateRef = React.useRef({ project, layout, total });
  stateRef.current = { project, layout, total };

  const timeRef = React.useRef(0);
  const playingRef = React.useRef(false);
  const startRef = React.useRef({ atWall: 0, atTime: 0 });
  const slotARef = React.useRef<HTMLVideoElement | null>(null);
  const slotBRef = React.useRef<HTMLVideoElement | null>(null);
  const slotAIdRef = React.useRef<string | null>(null);
  const slotBIdRef = React.useRef<string | null>(null);
  const audioRefs = React.useRef(new Map<string, HTMLAudioElement>());
  const areaRef = React.useRef<HTMLDivElement>(null);
  const frameRef = React.useRef<HTMLDivElement>(null);
  const bootedRef = React.useRef(false);

  const frame = React.useMemo(() => fitRect(area, project.aspect), [area, project.aspect]);

  /* ---------------------------------------------------- load last recording */

  React.useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    (async () => {
      try {
        const blob = await idbGet<Blob>('videoStudioDB', 'videoClips', 'latestVideo');
        if (!blob || blob.size === 0) return;
        const file = new File([blob], 'Latest recording', { type: blob.type || 'video/webm' });
        const { clip, warnings } = await clipFromFile(file);
        dispatch({ type: 'add-clips', clips: [clip] });
        if (warnings.length > 0) {
          toast({ title: 'Loaded with notes', description: warnings.join(' ') });
        }
      } catch {
        // No recording or unreadable — the editor simply starts empty.
      }
    })();
  }, [toast]);

  /* -------------------------------------------------------- area measuring */

  React.useEffect(() => {
    const el = areaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setArea({ w: rect.width, h: rect.height });
    });
    observer.observe(el);
    setArea({ w: el.clientWidth, h: el.clientHeight });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  /* ---------------------------------------------------------- media syncing */

  const syncMedia = React.useCallback(() => {
    const t = timeRef.current;
    const isPlaying = playingRef.current;
    const state = stateRef.current;
    const loc = locate(state.layout, t);

    const syncVideo = (
      el: HTMLVideoElement | null,
      boundId: string | null,
      clip: VideoClip | null | undefined,
      local: number,
    ) => {
      if (!el || !clip || boundId !== clip.id) return;
      const target = clamp(clip.inPoint + local * clip.speed, clip.inPoint, clip.outPoint);
      if (el.readyState >= 1 && Math.abs(el.currentTime - target) > (isPlaying ? 0.35 : 0.04)) {
        try {
          el.currentTime = target;
        } catch {
          /* seek before metadata — the next tick retries */
        }
      }
      if (el.playbackRate !== clip.speed) {
        try {
          el.playbackRate = clip.speed;
        } catch {
          /* rate out of range for this decoder */
        }
      }
      const volume = clip.muted ? 0 : clamp(clip.volume, 0, 1);
      if (el.volume !== volume) el.volume = volume;
      if (isPlaying) {
        if (el.paused) void el.play().catch(() => undefined);
      } else if (!el.paused) {
        el.pause();
      }
    };

    syncVideo(slotARef.current, slotAIdRef.current, loc.primary?.clip, loc.local);
    if (loc.outgoing) {
      syncVideo(
        slotBRef.current,
        slotBIdRef.current,
        loc.outgoing.clip,
        t - loc.outgoing.start,
      );
    }

    for (const clip of state.project.audio) {
      const el = audioRefs.current.get(clip.id);
      if (!el) continue;
      const active = t >= clip.start && t < clip.start + clip.duration;
      if (!active) {
        if (!el.paused) el.pause();
        continue;
      }
      const target = clip.offset + (t - clip.start);
      if (el.readyState >= 1 && Math.abs(el.currentTime - target) > (isPlaying ? 0.35 : 0.05)) {
        try {
          el.currentTime = Math.min(target, Math.max(0, clip.duration - 0.05));
        } catch {
          /* ignore */
        }
      }
      const gain = clamp(audioGainAt(clip, t), 0, 1);
      if (el.volume !== gain) el.volume = gain;
      if (isPlaying) {
        if (el.paused) void el.play().catch(() => undefined);
      } else if (!el.paused) {
        el.pause();
      }
    }
  }, []);

  React.useEffect(() => {
    syncMedia();
    // Refresh element positions after any project edit (trim/split/reorder).
  }, [project, syncMedia]);

  React.useEffect(() => {
    if (!playing) {
      syncMedia();
      return;
    }
    let raf = 0;
    let lastPaint = 0;
    const tick = (now: number) => {
      const state = stateRef.current;
      if (playingRef.current) {
        let t = startRef.current.atTime + (now - startRef.current.atWall) / 1000;
        if (t >= state.total) {
          t = state.total;
          playingRef.current = false;
          setPlaying(false);
        }
        timeRef.current = t;
        if (now - lastPaint >= 33) {
          lastPaint = now;
          setTime(t);
        }
      }
      syncMedia();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, syncMedia]);

  // Bind slot element → clip identity (which clip each <video> currently holds).
  React.useEffect(() => {
    slotAIdRef.current = location.primary?.clip.id ?? null;
    syncMedia();
  }, [location.primary?.clip.id, syncMedia]);
  React.useEffect(() => {
    slotBIdRef.current = location.outgoing?.clip.id ?? null;
  }, [location.outgoing?.clip.id]);

  const seek = React.useCallback(
    (t: number) => {
      const { total: dur } = stateRef.current;
      const clamped = clamp(t, 0, Math.max(0, dur));
      timeRef.current = clamped;
      setTime(clamped);
      if (playingRef.current) {
        startRef.current = { atWall: performance.now(), atTime: clamped };
      } else {
        syncMedia();
      }
    },
    [syncMedia],
  );

  const togglePlay = React.useCallback(() => {
    const { total: dur } = stateRef.current;
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      return;
    }
    if (timeRef.current >= dur - 0.02) {
      timeRef.current = 0;
      setTime(0);
    }
    startRef.current = { atWall: performance.now(), atTime: timeRef.current };
    playingRef.current = true;
    setPlaying(true);
  }, []);

  const stepClip = (dir: 1 | -1) => {
    const current = locate(stateRef.current.layout, timeRef.current).primary;
    const nextIndex = clamp((current?.index ?? 0) + dir, 0, stateRef.current.layout.placed.length - 1);
    const target = stateRef.current.layout.placed[nextIndex];
    if (target) seek(target.start + 0.01);
  };

  /* ------------------------------------------------------------ drag layer */

  const startDrag = (
    kind: 'text' | 'overlay',
    layer: TextLayer | OverlayLayer,
    event: React.PointerEvent,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    setSelection({ kind, id: layer.id });
    if (frame.w <= 0) return;
    setDrag({
      kind,
      id: layer.id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startClientX: event.clientX,
      startClientY: event.clientY,
      x: layer.x,
      y: layer.y,
    });
  };

  const onDragMove = (event: React.PointerEvent) => {
    if (!drag || frame.w <= 0 || frame.h <= 0) return;
    const dx = (event.clientX - drag.pointerX) / frame.w;
    const dy = (event.clientY - drag.pointerY) / frame.h;
    setDrag({
      ...drag,
      x: clamp(drag.x + dx, 0.02, 0.98),
      y: clamp(drag.y + dy, 0.02, 0.98),
      pointerX: event.clientX,
      pointerY: event.clientY,
    });
  };

  const endDrag = () => {
    if (!drag) return;
    if (drag.kind === 'text') {
      dispatch({ type: 'text-props', id: drag.id, patch: { x: drag.x, y: drag.y } });
    } else {
      dispatch({ type: 'overlay-props', id: drag.id, patch: { x: drag.x, y: drag.y } });
    }
    setDrag(null);
  };

  /* ----------------------------------------------------------- import clips */

  const importFromFile = async (file: File) => {
    try {
      const { clip, warnings } = await clipFromFile(file);
      dispatch({ type: 'add-clips', clips: [clip] });
      setSelection({ kind: 'clip', id: clip.id });
      if (warnings.length > 0) toast({ title: 'Imported with notes', description: warnings.join(' ') });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not import video',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const importFromUrl = async (item: LibraryItem) => {
    if (!item.url) return;
    try {
      const { clip, warnings } = await clipFromUrl(item.url, item.originalName || 'Library clip', item.mediaId);
      dispatch({ type: 'add-clips', clips: [clip] });
      setSelection({ kind: 'clip', id: clip.id });
      if (warnings.length > 0) toast({ title: 'Imported with notes', description: warnings.join(' ') });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not load that clip',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /* -------------------------------------------------------------- keyboard */

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
      } else if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        dispatch({ type: 'redo' });
      } else if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      } else if (event.key === 'ArrowLeft') {
        seek(timeRef.current - (event.shiftKey ? 1 : 0.1));
      } else if (event.key === 'ArrowRight') {
        seek(timeRef.current + (event.shiftKey ? 1 : 0.1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [seek, togglePlay]);

  /* ----------------------------------------------------------- close / leave */

  const closeEditor = () => {
    if (history.past.length > 0) {
      const leave = window.confirm(
        'Leave the editor? Your edits have not been exported — anything unsaved will be lost.',
      );
      if (!leave) return;
    }
    if (window.history.length > 1) router.back();
    // Cold start inside the installed application must not jump to a website
    // route — the app shell never links out of its own section.
    else if (window.location.pathname.startsWith('/app')) router.push('/app/seller');
    else router.push('/seller/studio/record');
  };

  /* ------------------------------------------------------------ search index */

  interface SearchHit {
    key: string;
    kind: Selection['kind'];
    id: string;
    label: string;
    at: number;
    where: string;
  }

  const searchHits: SearchHit[] = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const hits: SearchHit[] = [];
    layout.placed.forEach((placed) => {
      if (placed.clip.name.toLowerCase().includes(q)) {
        hits.push({ key: `c${placed.clip.id}`, kind: 'clip', id: placed.clip.id, label: placed.clip.name, at: placed.start, where: 'video' });
      }
    });
    project.audio.forEach((a) => {
      if (a.name.toLowerCase().includes(q)) {
        hits.push({ key: `a${a.id}`, kind: 'audio', id: a.id, label: a.name, at: a.start, where: `audio · ${a.kind}` });
      }
    });
    project.texts.forEach((t) => {
      if (t.text.toLowerCase().includes(q)) {
        hits.push({ key: `t${t.id}`, kind: 'text', id: t.id, label: t.text, at: t.start, where: 'text' });
      }
    });
    project.overlays.forEach((o) => {
      if (o.name.toLowerCase().includes(q)) {
        hits.push({ key: `o${o.id}`, kind: 'overlay', id: o.id, label: o.name, at: o.start, where: 'overlay' });
      }
    });
    project.captions.forEach((c) => {
      if (c.text.toLowerCase().includes(q)) {
        hits.push({ key: `k${c.id}`, kind: 'caption', id: c.id, label: c.text, at: c.start, where: 'captions' });
      }
    });
    return hits.slice(0, 8);
  }, [searchQuery, project, layout]);

  /* ---------------------------------------------------------------- context */

  const contextClip: VideoClip | null =
    selection?.kind === 'clip'
      ? project.clips.find((c) => c.id === selection.id) ?? null
      : location.primary?.clip ?? project.clips[0] ?? null;
  const contextIndex = contextClip ? project.clips.findIndex((c) => c.id === contextClip.id) : -1;

  const visibleTexts = itemsAt(project.texts, time);
  const visibleOverlays = itemsAt(project.overlays, time);
  const visibleCue = captionsAt(project.captions, time)[0] ?? null;
  const fx = location.primary ? effectOverlays(location.primary.clip, location.local) : null;
  const primaryFilter = compare
    ? 'none'
    : location.primary
      ? clipFilterCss(location.primary.clip, location.local)
      : 'none';
  const outgoingFilter = compare
    ? 'none'
    : location.outgoing
      ? clipFilterCss(location.outgoing.clip, time - location.outgoing.start)
      : 'none';

  const tools: ToolId[] = ['edit', 'audio', 'text', 'effects', 'overlay', 'captions', 'filters'];
  const primaryAlpha = location.outgoing
    ? location.primary?.clip.transitionIn.type === 'slide'
      ? 1
      : location.blend
    : 1;
  const toolIcon: Record<ToolId, React.ReactNode> = {
    edit: <Scissors className="h-4 w-4" />,
    audio: <Music className="h-4 w-4" />,
    text: <Type className="h-4 w-4" />,
    effects: <Wand2 className="h-4 w-4" />,
    overlay: <Layers3 className="h-4 w-4" />,
    captions: <Captions className="h-4 w-4" />,
    filters: <SlidersHorizontal className="h-4 w-4" />,
  };

  const toggleFullscreen = () => {
    const el = frameRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void el.requestFullscreen?.().catch(() => undefined);
  };

  /* ------------------------------------------------------------------- UI */

  return (
    <div className="flex h-full flex-col bg-black text-white">
      {/* Top toolbar */}
      <header className="flex shrink-0 items-center gap-1 border-b border-zinc-900 bg-zinc-950 px-1.5 py-1.5">
        <button
          type="button"
          aria-label="Close editor"
          onClick={closeEditor}
          className="rounded-md p-1.5 text-zinc-300 hover:bg-zinc-800"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="min-w-0 flex-1 truncate px-1 text-[12px] font-medium text-zinc-300">
          {project.name}
          <span className="ml-1.5 tabular-nums text-zinc-600">{project.clips.length} clips</span>
        </span>
        <button
          type="button"
          aria-label="Search project"
          onClick={() => setSearchOpen((v) => !v)}
          className={cn('rounded-md p-1.5 hover:bg-zinc-800', searchOpen ? 'text-emerald-400' : 'text-zinc-300')}
        >
          <Search className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Undo"
          disabled={history.past.length === 0}
          onClick={() => dispatch({ type: 'undo' })}
          className="rounded-md p-1.5 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
        >
          <Undo2 className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Redo"
          disabled={history.future.length === 0}
          onClick={() => dispatch({ type: 'redo' })}
          className="rounded-md p-1.5 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
        >
          <Redo2 className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setShowAi(true)}
          className="flex items-center gap-1 rounded-md border border-emerald-700/60 bg-emerald-950/40 px-2 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-900/40"
        >
          <Sparkles className="h-3.5 w-3.5" /> AI UHD
        </button>
        <button
          type="button"
          onClick={() => setShowExport(true)}
          className="flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1.5 text-[11px] font-semibold text-black hover:bg-emerald-400"
        >
          <Share2 className="h-3.5 w-3.5" /> Export
        </button>
      </header>

      {/* Search dropdown */}
      {searchOpen && (
        <div className="shrink-0 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
          <input
            autoFocus
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search clips, text, audio, captions…"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-emerald-600"
          />
          {searchQuery.trim() !== '' && (
            <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
              {searchHits.length === 0 && (
                <p className="py-1 text-[11px] text-zinc-500">Nothing matches “{searchQuery}”.</p>
              )}
              {searchHits.map((hit) => (
                <button
                  key={hit.key}
                  type="button"
                  onClick={() => {
                    setSelection({ kind: hit.kind, id: hit.id });
                    seek(hit.at);
                    setSearchOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-zinc-800 px-2.5 py-1.5 text-left text-[11px] hover:border-emerald-700"
                >
                  <span className="truncate text-zinc-200">{hit.label}</span>
                  <span className="shrink-0 tabular-nums text-zinc-500">{hit.where} · {hit.at.toFixed(1)}s</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview area */}
      <div
        ref={areaRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) setSelection(null);
        }}
      >
        <div
          ref={frameRef}
          className="absolute overflow-hidden bg-black"
          style={{
            width: frame.w,
            height: frame.h,
            left: area.w / 2 - frame.w / 2,
            top: area.h / 2 - frame.h / 2,
          }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setSelection(null);
          }}
        >
          {/* Outgoing clip sits under the incoming one during a transition. */}
          {location.outgoing && (
            <PreviewSlot
              clip={location.outgoing.clip}
              frame={frame}
              local={time - location.outgoing.start}
              alpha={
                (location.primary?.clip.transitionIn.type ?? 'fade') === 'fade'
                  ? 1
                  : 1 - location.blend * 0.4
              }
              dx={
                location.primary?.clip.transitionIn.type === 'slide'
                  ? -location.blend * frame.w * 0.25
                  : 0
              }
              dy={0}
              scale={location.primary?.clip.transitionIn.type === 'zoom' ? 1 - 0.08 * location.blend : 1}
              filterCss={outgoingFilter}
              videoRef={slotBRef}
            />
          )}
          {location.primary && (
            <PreviewSlot
              clip={location.primary.clip}
              frame={frame}
              local={location.local}
              alpha={primaryAlpha}
              dx={
                location.outgoing && location.primary.clip.transitionIn.type === 'slide'
                  ? (1 - location.blend) * frame.w
                  : 0
              }
              dy={0}
              scale={
                location.outgoing && location.primary.clip.transitionIn.type === 'zoom'
                  ? 1 + 0.12 * (1 - location.blend)
                  : 1
              }
              filterCss={primaryFilter}
              videoRef={slotARef}
            />
          )}

          {/* Frame-space effects ride on the mostly-visible clip. */}
          {location.primary && primaryAlpha > 0.5 && fx && (
            <>
              {fx.vignette > 0 && (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${(0.85 * fx.vignette).toFixed(3)}) 100%)`,
                  }}
                />
              )}
              {fx.grain > 0 && (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    opacity: fx.grain * 0.35,
                    mixBlendMode: 'overlay',
                    backgroundImage: GRAIN_SVG,
                  }}
                />
              )}
              {fx.fade > 0 && (
                <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: fx.fade }} />
              )}
            </>
          )}

          {/* Overlays */}
          {visibleOverlays.map((overlay) => {
            const isDragging = drag?.kind === 'overlay' && drag.id === overlay.id;
            const pos = isDragging && drag ? { x: drag.x, y: drag.y } : { x: overlay.x, y: overlay.y };
            const width = overlay.width * frame.w;
            const selected = selection?.kind === 'overlay' && selection.id === overlay.id;
            return (
              <div
                key={overlay.id}
                onPointerDown={(event) => startDrag('overlay', overlay, event)}
                onPointerMove={onDragMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className={cn(
                  'absolute cursor-move touch-none select-none',
                  selected && 'outline outline-1 outline-dashed outline-emerald-400/80',
                )}
                style={{
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  transform: `translate(-50%,-50%) rotate(${overlay.rotation}deg)`,
                  opacity: overlay.opacity,
                  width: overlay.kind === 'sticker' ? undefined : width,
                  fontSize: overlay.kind === 'sticker' ? width : undefined,
                  lineHeight: 1,
                }}
              >
                {overlay.kind === 'sticker' ? (
                  <span>{overlay.src}</span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={overlay.src} alt="" draggable={false} className="block w-full" />
                )}
              </div>
            );
          })}

          {/* Text layers */}
          {visibleTexts.map((layer) => {
            const isDragging = drag?.kind === 'text' && drag.id === layer.id;
            const pos = isDragging && drag ? { x: drag.x, y: drag.y } : { x: layer.x, y: layer.y };
            const progress = (time - layer.start) / Math.max(0.2, layer.duration);
            const anim = animationProgress(layer.animation, progress);
            if (anim.alpha <= 0) return null;
            let text = layer.text;
            if (anim.chars !== null) {
              text = layer.text.slice(0, Math.round(clamp(progress, 0, 1) * layer.text.length));
            }
            const size = layer.style.fontSize * frame.h;
            const selected = selection?.kind === 'text' && selection.id === layer.id;
            const translateX =
              layer.style.align === 'left' ? '0%' : layer.style.align === 'right' ? '-100%' : '-50%';
            return (
              <div
                key={layer.id}
                onPointerDown={(event) => startDrag('text', layer, event)}
                onPointerMove={onDragMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className={cn(
                  'absolute cursor-move touch-none select-none',
                  selected && 'outline outline-1 outline-dashed outline-emerald-400/80',
                )}
                style={{
                  left: `${pos.x * 100}%`,
                  top: `${(pos.y + anim.offset) * 100}%`,
                  transform: `translate(${translateX}, -50%)`,
                  width: frame.w * 0.88,
                  maxWidth: frame.w * 0.88,
                  fontFamily: layer.style.fontFamily,
                  fontSize: size,
                  fontWeight: layer.style.bold ? 700 : 400,
                  fontStyle: layer.style.italic ? 'italic' : 'normal',
                  color: layer.style.color,
                  textAlign: layer.style.align,
                  lineHeight: 1.25,
                  whiteSpace: 'pre-wrap',
                  opacity: anim.alpha,
                  textShadow: layer.style.shadow
                    ? `0 ${Math.max(1, size * 0.05)}px ${Math.max(2, size * 0.12)}px rgba(0,0,0,0.65)`
                    : undefined,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    background: layer.style.background ?? undefined,
                    borderRadius: size * 0.2,
                    padding: layer.style.background ? `${size * 0.25}px ${size * 0.35}px` : undefined,
                  }}
                >
                  {text}
                </span>
              </div>
            );
          })}

          {/* Caption at the playhead */}
          {visibleCue && (
            <div
              className="pointer-events-none absolute text-center font-bold"
              style={{
                left: '50%',
                top: '86%',
                transform: 'translate(-50%,-50%)',
                width: frame.w * 0.86,
                fontSize: 0.055 * frame.h,
                lineHeight: 1.25,
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              <span
                style={{
                  color: '#ffffff',
                  background: 'rgba(0,0,0,0.6)',
                  borderRadius: 0.055 * frame.h * 0.24,
                  padding: `${0.055 * frame.h * 0.08}px ${0.055 * frame.h * 0.3}px`,
                  boxDecorationBreak: 'clone',
                  WebkitBoxDecorationBreak: 'clone',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                }}
              >
                {visibleCue.text}
              </span>
            </div>
          )}

          {/* Empty state */}
          {project.clips.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <Film className="h-9 w-9 text-zinc-700" />
              <p className="text-[12px] leading-relaxed text-zinc-500">
                Start with a video clip — record one in the studio, import from this device,
                or pull a file from your Vidnov media library.
              </p>
              <Button size="sm" variant="secondary" className="text-xs" onClick={() => setShowPicker(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add video
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Transport */}
      <div className="flex shrink-0 items-center gap-2 border-t border-zinc-900 bg-zinc-950 px-3 py-1.5">
        <button type="button" aria-label="Previous clip" onClick={() => stepClip(-1)} className="rounded p-1 text-zinc-300 hover:bg-zinc-800">
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={togglePlay}
          disabled={project.clips.length === 0}
          className="rounded-full bg-emerald-500 p-2 text-black hover:bg-emerald-400 disabled:opacity-40"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button type="button" aria-label="Next clip" onClick={() => stepClip(1)} className="rounded p-1 text-zinc-300 hover:bg-zinc-800">
          <SkipForward className="h-4 w-4" />
        </button>
        <span className="ml-1 flex-1 truncate text-[11px] tabular-nums text-zinc-400">
          {time.toFixed(1)}s <span className="text-zinc-600">/ {total.toFixed(1)}s</span>
          {location.primary && (
            <span className="ml-1.5 text-zinc-600">· {location.primary.clip.name}</span>
          )}
        </span>
        <button
          type="button"
          aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen preview'}
          onClick={toggleFullscreen}
          className="rounded p-1 text-zinc-300 hover:bg-zinc-800"
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Timeline */}
      <div className="shrink-0">
        <EditorTimeline
          project={project}
          time={time}
          total={total}
          selection={selection}
          onSeek={seek}
          onSelect={setSelection}
          onAddVideo={() => setShowPicker(true)}
        />
      </div>

      {/* Tool panel */}
      {tool && (
        <div className="max-h-[42vh] shrink-0 overflow-y-auto border-t border-zinc-800 bg-zinc-950">
          <EditorPanels
            tool={tool}
            project={project}
            dispatch={dispatch}
            selection={selection}
            setSelection={setSelection}
            contextClip={contextClip}
            contextIndex={contextIndex}
            time={time}
            total={total}
            seek={seek}
            user={user}
            setCompare={setCompare}
            onClose={() => setTool(null)}
          />
        </div>
      )}

      {/* Bottom toolbar */}
      <nav className="grid shrink-0 grid-cols-7 border-t border-zinc-900 bg-zinc-950 pb-[env(safe-area-inset-bottom)]">
        {tools.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTool((current) => (current === id ? null : id))}
            className={cn(
              'flex flex-col items-center gap-1 py-2 text-[9px] font-medium transition-colors',
              tool === id ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            {toolIcon[id]}
            {TOOL_LABELS[id]}
          </button>
        ))}
      </nav>

      {/* Hidden audio elements for music/sfx tracks (real playback + sync). */}
      <div className="hidden">
        {project.audio.map((clip) => (
          <audio
            key={clip.id}
            src={clip.src}
            preload="auto"
            ref={(el) => {
              if (el) audioRefs.current.set(clip.id, el);
              else audioRefs.current.delete(clip.id);
            }}
          />
        ))}
      </div>

      {/* Modals */}
      {showPicker && (
        <MediaPicker
          kind="video"
          user={user}
          onClose={() => setShowPicker(false)}
          onPickFile={(file) => void importFromFile(file)}
          onPickUrl={(item) => void importFromUrl(item)}
        />
      )}
      {showAi && (
        <AiWorkspace
          user={user}
          contextMediaId={contextClip?.mediaId}
          contextClipName={contextClip?.name}
          onClose={() => setShowAi(false)}
          onAddToTimeline={(item) => {
            void clipFromUrl(item.url, item.name, item.mediaId)
              .then(({ clip }) => {
                dispatch({ type: 'add-clips', clips: [clip] });
                setSelection({ kind: 'clip', id: clip.id });
              })
              .catch(() =>
                toast({
                  variant: 'destructive',
                  title: 'Could not add the enhanced clip',
                  description: 'It is saved in your media library — import it from there.',
                }),
              );
          }}
        />
      )}
      {showExport && (
        <ExportStudio project={project} user={user} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
