'use client';

/**
 * Multi-track timeline: video thumbnails, audio, text, overlay and caption
 * tracks under one shared playhead. Tap or drag anywhere on the tracks to
 * scrub; tap a block to select that item. Zoom is +/- because pinch is not
 * reliable across mobile browsers.
 */

import * as React from 'react';
import { Music, Type, Layers, Captions as CaptionsIcon, Film, ZoomIn, ZoomOut, Plus } from 'lucide-react';
import { clamp, layoutTimeline, type TimelineLayout } from '@/lib/editor/timeline';
import type { EditorProject } from '@/lib/editor/types';
import { cn } from '@/lib/utils';
import type { Selection } from './shared';

const MIN_PX_PER_SEC = 24;
const MAX_PX_PER_SEC = 360;

export interface EditorTimelineProps {
  project: EditorProject;
  time: number;
  total: number;
  selection: Selection | null;
  onSeek: (t: number) => void;
  onSelect: (selection: Selection | null) => void;
  /** Opens the media picker to append another clip (header + button). */
  onAddVideo?: () => void;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, '0')}`;
}

interface Block {
  key: string;
  start: number;
  end: number;
  label: string;
  selection: Selection;
}

interface RowProps {
  label: string;
  icon: React.ReactNode;
  blocks: Block[];
  className?: string;
  selection: Selection | null;
  pxPerSec: number;
  renderLabel?: (block: Block) => React.ReactNode;
  onSelect: (selection: Selection) => void;
  onBlockSeek: (t: number) => void;
}

/**
 * One track row. Hoisted (and memoised) OUTSIDE the page component: the
 * playhead re-renders the timeline ~30×/s while playing, and an inline
 * component definition would remount every row on every frame.
 */
const TrackRow = React.memo(function TrackRow({
  label,
  icon,
  blocks,
  className,
  selection,
  pxPerSec,
  renderLabel,
  onSelect,
  onBlockSeek,
}: RowProps) {
  return (
    <div className="flex items-stretch border-t border-zinc-900">
      <div className="flex w-8 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-zinc-900 bg-zinc-950 text-zinc-500">
        {icon}
        <span className="text-[7px] uppercase tracking-wide">{label}</span>
      </div>
      <div className="relative flex-1">
        {blocks.map((block) => {
          const left = block.start * pxPerSec;
          const blockWidth = Math.max(30, (block.end - block.start) * pxPerSec);
          const isSelected =
            selection?.kind === block.selection.kind && selection?.id === block.selection.id;
          return (
            <button
              key={block.key}
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelect(block.selection);
                onBlockSeek(Math.max(0, block.start));
              }}
              className={cn(
                'absolute top-0.5 bottom-0.5 overflow-hidden rounded-md border text-left transition-colors',
                className,
                isSelected ? 'border-emerald-400 ring-1 ring-emerald-400/70' : 'border-zinc-700/70',
              )}
              style={{ left, width: blockWidth }}
              title={block.label}
            >
              <span className="block truncate px-1.5 py-1 text-[10px] leading-tight">
                {renderLabel ? renderLabel(block) : block.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

export function EditorTimeline({
  project,
  time,
  total,
  selection,
  onSeek,
  onSelect,
  onAddVideo,
}: EditorTimelineProps) {
  const [pxPerSec, setPxPerSec] = React.useState(90);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const draggingRef = React.useRef(false);

  const layout: TimelineLayout = React.useMemo(
    () => layoutTimeline(project.clips),
    [project.clips],
  );
  const width = Math.max(320, (total + 1) * pxPerSec);

  const videoBlocks: Block[] = layout.placed.map((placed) => ({
    key: placed.clip.id,
    start: placed.start,
    end: placed.start + placed.duration,
    label: placed.clip.name,
    selection: { kind: 'clip', id: placed.clip.id },
  }));
  const audioBlocks: Block[] = project.audio.map((a) => ({
    key: a.id,
    start: a.start,
    end: a.start + Math.max(0, a.duration - a.offset),
    label: a.name,
    selection: { kind: 'audio', id: a.id },
  }));
  const textBlocks: Block[] = project.texts.map((t) => ({
    key: t.id,
    start: t.start,
    end: t.start + t.duration,
    label: t.text,
    selection: { kind: 'text', id: t.id },
  }));
  const overlayBlocks: Block[] = project.overlays.map((o) => ({
    key: o.id,
    start: o.start,
    end: o.start + o.duration,
    label: o.name,
    selection: { kind: 'overlay', id: o.id },
  }));
  const captionBlocks: Block[] = project.captions.map((c) => ({
    key: c.id,
    start: c.start,
    end: c.end,
    label: c.text,
    selection: { kind: 'caption', id: c.id },
  }));

  const timeFromEvent = (clientX: number): number => {
    const el = scrollRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + el.scrollLeft;
    return clamp(x / pxPerSec, 0, Math.max(0.01, total));
  };

  const selectAt = (t: number) => {
    const all = [
      ...captionBlocks,
      ...overlayBlocks,
      ...textBlocks,
      ...audioBlocks,
      ...videoBlocks,
    ];
    const hit = all.find((b) => t >= b.start && t < b.end);
    onSelect(hit ? hit.selection : null);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    draggingRef.current = true;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    const t = timeFromEvent(event.clientX);
    onSeek(t);
    selectAt(t);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const t = timeFromEvent(event.clientX);
    onSeek(t);
  };
  const endDrag = () => {
    draggingRef.current = false;
  };

  // Keep the playhead visible while playing.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const x = time * pxPerSec;
    const viewStart = el.scrollLeft;
    const viewEnd = viewStart + el.clientWidth;
    if (x < viewStart + 24 || x > viewEnd - 64) {
      el.scrollLeft = Math.max(0, x - el.clientWidth * 0.4);
    }
  }, [time, pxPerSec]);

  const ticks: React.ReactNode[] = [];
  const tickStep = pxPerSec > 140 ? 1 : pxPerSec > 60 ? 2 : 5;
  for (let t = 0; t <= total + 1; t += tickStep) {
    ticks.push(
      <div
        key={t}
        className="absolute top-0 flex h-full flex-col items-start"
        style={{ left: t * pxPerSec }}
      >
        <span className="pl-1 text-[9px] tabular-nums text-zinc-500">{t}s</span>
      </div>,
    );
  }


  return (
    <div className="relative border-t border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[11px] font-semibold tabular-nums text-emerald-400">
          {formatTime(time)}
          <span className="text-zinc-500"> / {formatTime(total)}</span>
        </span>
        <div className="flex items-center gap-1">
          {onAddVideo && (
            <button
              type="button"
              aria-label="Add video clip"
              title="Add video clip"
              className="rounded-md border border-emerald-700/60 bg-emerald-950/40 p-1 text-emerald-400 hover:bg-emerald-900/40"
              onClick={onAddVideo}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            aria-label="Zoom out timeline"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800"
            onClick={() => setPxPerSec((v) => clamp(Math.round(v / 1.5), MIN_PX_PER_SEC, MAX_PX_PER_SEC))}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Zoom in timeline"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800"
            onClick={() => setPxPerSec((v) => clamp(Math.round(v * 1.5), MIN_PX_PER_SEC, MAX_PX_PER_SEC))}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-auto overscroll-x-contain select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="relative" style={{ width }}>
          <div className="relative h-4 border-b border-zinc-900">{ticks}</div>

          <TrackRow
            label="Video"
            icon={<Film className="h-3 w-3" />}
            blocks={videoBlocks}
            className="bg-zinc-900/80"
            selection={selection}
            pxPerSec={pxPerSec}
            onSelect={onSelect}
            onBlockSeek={(t) => onSeek(clamp(t, 0, total))}
            renderLabel={(block) => {
              const clip = project.clips.find((c) => c.id === block.selection.id);
              if (clip?.thumbnail) {
                return (
                  <span
                    className="flex h-full items-center bg-cover bg-center px-1.5 text-[9px] text-white/90 [text-shadow:0_1px_2px_black]"
                    style={{ backgroundImage: `url(${clip.thumbnail})` }}
                  >
                    {clip.name}
                    {clip.speed !== 1 ? ` · ${clip.speed}×` : ''}
                  </span>
                );
              }
              return clip?.speed !== 1 ? `${block.label} · ${clip?.speed}×` : block.label;
            }}
          />
          <TrackRow label="Audio" icon={<Music className="h-3 w-3" />} blocks={audioBlocks} className="bg-emerald-900/70" selection={selection} pxPerSec={pxPerSec} onSelect={onSelect} onBlockSeek={(t) => onSeek(clamp(t, 0, total))} />
          <TrackRow label="Text" icon={<Type className="h-3 w-3" />} blocks={textBlocks} className="bg-sky-900/70" selection={selection} pxPerSec={pxPerSec} onSelect={onSelect} onBlockSeek={(t) => onSeek(clamp(t, 0, total))} />
          <TrackRow label="Over" icon={<Layers className="h-3 w-3" />} blocks={overlayBlocks} className="bg-amber-900/70" selection={selection} pxPerSec={pxPerSec} onSelect={onSelect} onBlockSeek={(t) => onSeek(clamp(t, 0, total))} />
          <TrackRow label="Subs" icon={<CaptionsIcon className="h-3 w-3" />} blocks={captionBlocks} className="bg-violet-900/70" selection={selection} pxPerSec={pxPerSec} onSelect={onSelect} onBlockSeek={(t) => onSeek(clamp(t, 0, total))} />

          {/* Playhead spans every track */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-red-500"
            style={{ left: time * pxPerSec }}
          >
            <div className="-ml-[5px] -mt-1 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-red-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
