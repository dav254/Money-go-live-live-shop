'use client';

/**
 * The seven tool panels: Edit, Audio, Text, Effects, Overlay, Captions,
 * Filters. Every control here performs a real edit through the shared
 * reducer — there are no decorative widgets. Panels that need a target use
 * `contextClip` (the selected clip, else the clip under the playhead) and
 * say so plainly when nothing is available.
 */

import * as React from 'react';
import type { User } from 'firebase/auth';
import {
  X, Scissors, Copy, Trash2, RotateCw, RotateCcw, ChevronLeft, ChevronRight,
  Plus, Music, Type as TypeIcon, Wand2, ImagePlus, Captions, SlidersHorizontal,
  Mic, Upload, PlayCircle, Loader2, Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  clipDuration,
  cropForAspect,
  displayedAspect,
  layoutTimeline,
  zoomCrop,
} from '@/lib/editor/timeline';import {
  FILTER_PRESETS,
  resolveAdjust,
} from '@/lib/editor/filters';
import {
  dictationSupported,
  makeCue,
  parseSrt,
  requestTranscription,
} from '@/lib/editor/captions';
import {
  DEFAULT_TEXT_STYLE,
  FONT_CHOICES,
  uid,
  type EditorProject,
  type EffectType,
  type FilterAdjust,
  type OverlayLayer,
  type TextAnimation,
  type TransitionType,
  type VideoClip,
} from '@/lib/editor/types';
import type { EditorAction } from '@/lib/editor/reducer';
import { probeAudio } from '@/lib/editor/import';
import type { Selection, ToolId } from './shared';

export interface PanelContext {
  project: EditorProject;
  dispatch: React.Dispatch<EditorAction>;
  selection: Selection | null;
  setSelection: (selection: Selection | null) => void;
  contextClip: VideoClip | null;
  contextIndex: number;
  time: number;
  total: number;
  seek: (t: number) => void;
  user: User | null;
  setCompare: (on: boolean) => void;
}

/** What an individual panel needs (no `tool` — the dispatcher knows that). */
type PanelProps = PanelContext & { onClose: () => void };

interface Props extends PanelProps {
  tool: ToolId;
}

/* ------------------------------------------------------------------ atoms */

function PanelHeader({ title, onClose, icon }: { title: string; onClose: () => void; icon?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-4 py-2 backdrop-blur">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
        {icon}
        {title}
      </span>
      <button type="button" aria-label="Close panel" onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-800">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function SliderRow({
  label, value, min, max, step, onChange, display,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (value: number) => void; display?: string;
}) {
  return (
    <label className="block px-4 py-1.5">
      <span className="flex items-center justify-between text-[11px] text-zinc-400">
        <span>{label}</span>
        <span className="tabular-nums text-zinc-200">{display ?? value}</span>
      </span>
      <input
        type="range"
        className="mt-1 w-full accent-emerald-500"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Chip({
  active, onClick, children, title,
}: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
        active
          ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
          : 'border-zinc-700 text-zinc-300 hover:border-zinc-500',
      )}
    >
      {children}
    </button>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-4 text-[11px] leading-relaxed text-zinc-500">{children}</p>;
}

function SelectRow({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex items-center justify-between gap-3 px-4 py-2">
      <span className="text-[11px] text-zinc-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[60%] rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function DangerButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-red-900/70 bg-red-950/40 px-3 py-1.5 text-[11px] text-red-300 hover:bg-red-900/40"
    >
      {children}
    </button>
  );
}

const fmtSec = (v: number) => `${v.toFixed(1)}s`;

/* ------------------------------------------------------------------ EDIT */

function EditPanel({ project, dispatch, contextClip, contextIndex, time, onClose }: PanelProps) {
  if (!contextClip) {
    return (
      <>
        <PanelHeader title="Edit" onClose={onClose} icon={<Scissors className="h-3.5 w-3.5" />} />
        <Hint>No clip selected. Tap a clip on the timeline (or add one with +) to trim, split, crop and rearrange it.</Hint>
      </>
    );
  }
  const clip = contextClip;
  const placed = layoutTimeline(project.clips).placed.find((p) => p.clip.id === clip.id);
  const local = placed ? time - placed.start : -1;
  const canSplit = local > 0.05 && local < clipDuration(clip) - 0.05;
  const zoom = clip.crop ? 1 / Math.min(clip.crop.w, clip.crop.h) : 1;

  return (
    <>
      <PanelHeader title={`Edit · ${clip.name}`} onClose={onClose} icon={<Scissors className="h-3.5 w-3.5" />} />

      {/* Arrange */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-[11px] text-zinc-400">Position {contextIndex + 1} of {project.clips.length}</span>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Move clip earlier"
            disabled={contextIndex === 0}
            className="rounded-md border border-zinc-700 p-1.5 disabled:opacity-30"
            onClick={() => dispatch({ type: 'move-clip', id: clip.id, to: contextIndex - 1 })}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Move clip later"
            disabled={contextIndex >= project.clips.length - 1}
            className="rounded-md border border-zinc-700 p-1.5 disabled:opacity-30"
            onClick={() => dispatch({ type: 'move-clip', id: clip.id, to: contextIndex + 1 })}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Trim */}
      <div className="border-t border-zinc-900 px-4 py-2">
        <p className="text-[11px] font-semibold text-zinc-300">Trim</p>
        <SliderRow
          label="Start"
          value={clip.inPoint}
          min={0}
          max={Math.max(0.1, clip.outPoint - 0.1)}
          step={0.05}
          onChange={(v) => dispatch({ type: 'trim', id: clip.id, inPoint: v })}
          display={fmtSec(clip.inPoint)}
        />
        <SliderRow
          label="End"
          value={clip.outPoint}
          min={Math.min(clip.sourceDuration, clip.inPoint + 0.1)}
          max={clip.sourceDuration}
          step={0.05}
          onChange={(v) => dispatch({ type: 'trim', id: clip.id, outPoint: v })}
          display={`${fmtSec(clip.outPoint)} · keeps ${fmtSec(clipDuration(clip))} @ ${clip.speed}×`}
        />
        <div className="flex items-center gap-2 px-4 pb-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 flex-1 text-xs"
            disabled={!canSplit}
            onClick={() => {
              if (!placed) return;
              dispatch({ type: 'split', id: clip.id, local: time - placed.start });
            }}
          >
            <Scissors className="mr-1 h-3.5 w-3.5" />
            Split at playhead
          </Button>
          {!canSplit && (
            <span className="text-[10px] text-zinc-500">move playhead into clip</span>
          )}
        </div>
      </div>

      {/* Crop + resize + rotate */}
      <div className="border-t border-zinc-900 px-4 py-2">
        <p className="text-[11px] font-semibold text-zinc-300">Crop &amp; resize</p>
        <div className="flex flex-wrap gap-1.5 px-0 py-1.5">
          {([
            { label: 'Original', target: null },
            { label: '1:1', target: 1 },
            { label: '4:5', target: 4 / 5 },
            { label: '9:16', target: 9 / 16 },
            { label: '16:9', target: 16 / 9 },
            { label: '3:4', target: 3 / 4 },
          ] as const).map((option) => (
            <Chip
              key={option.label}
              active={option.target === null ? clip.crop === null : false}
              onClick={() => dispatch({ type: 'clip-props', id: clip.id, patch: { crop: cropForAspect(clip, option.target) } })}
            >
              {option.label}
            </Chip>
          ))}
        </div>
        <SliderRow
          label="Zoom"
          value={zoom}
          min={1}
          max={4}
          step={0.05}
          onChange={(z) => dispatch({ type: 'clip-props', id: clip.id, patch: { crop: zoomCrop(clip, z) } })}
          display={`${zoom.toFixed(2)}×`}
        />
        <div className="flex items-center gap-1.5 px-0 pb-1">
          <Chip onClick={() => dispatch({ type: 'clip-props', id: clip.id, patch: { rotation: ((clip.rotation + 270) % 360) as VideoClip['rotation'] } })}>
            <RotateCcw className="inline h-3 w-3" /> 90°
          </Chip>
          <Chip onClick={() => dispatch({ type: 'clip-props', id: clip.id, patch: { rotation: ((clip.rotation + 90) % 360) as VideoClip['rotation'] } })}>
            <RotateCw className="inline h-3 w-3" /> 90°
          </Chip>
          <Chip onClick={() => dispatch({ type: 'clip-props', id: clip.id, patch: { rotation: 0, crop: null } })}>Reset</Chip>
        </div>
      </div>

      {/* Speed */}
      <div className="border-t border-zinc-900">
        <SliderRow
          label="Speed"
          value={clip.speed}
          min={0.25}
          max={4}
          step={0.05}
          onChange={(v) => dispatch({ type: 'clip-props', id: clip.id, patch: { speed: v } })}
          display={`${clip.speed.toFixed(2)}× · ${fmtSec(clipDuration(clip))}`}
        />
        <div className="flex gap-1.5 px-4 pb-2">
          {[0.5, 1, 1.5, 2].map((speed) => (
            <Chip key={speed} active={Math.abs(clip.speed - speed) < 0.01} onClick={() => dispatch({ type: 'clip-props', id: clip.id, patch: { speed } })}>
              {speed}×
            </Chip>
          ))}
        </div>
      </div>

      {/* Volume */}
      <div className="border-t border-zinc-900">
        <SliderRow
          label="Clip volume"
          value={Math.round(clip.volume * 100)}
          min={0}
          max={100}
          step={1}
          onChange={(v) => dispatch({ type: 'clip-props', id: clip.id, patch: { volume: v / 100, muted: false } })}
          display={clip.muted ? 'muted' : `${Math.round(clip.volume * 100)}%`}
        />
        <div className="flex gap-1.5 px-4 pb-2">
          <Chip active={clip.muted} onClick={() => dispatch({ type: 'clip-props', id: clip.id, patch: { muted: !clip.muted } })}>
            {clip.muted ? 'Unmute' : 'Mute'}
          </Chip>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-zinc-900 px-4 py-3">
        <Button size="sm" variant="secondary" className="h-8 flex-1 text-xs" onClick={() => dispatch({ type: 'duplicate-clip', id: clip.id })}>
          <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
        </Button>
        <DangerButton onClick={() => dispatch({ type: 'delete-clip', id: clip.id })}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </DangerButton>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- AUDIO */

function AudioPanel({ project, dispatch, selection, setSelection, time, total, seek, onClose }: PanelProps) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [kind, setKind] = React.useState<'music' | 'sfx' | 'voice'>('music');
  const [busy, setBusy] = React.useState(false);
  const { toast } = useToast();
  const selected = selection?.kind === 'audio'
    ? project.audio.find((a) => a.id === selection.id) ?? null
    : null;

  const importAudio = async (file: File) => {
    setBusy(true);
    try {
      const src = URL.createObjectURL(file);
      const duration = await probeAudio(src);
      const id = uid('aud');
      dispatch({
        type: 'add-audio',
        clip: {
          id,
          name: file.name.replace(/\.[^.]+$/, ''),
          src,
          kind,
          start: Math.min(time, Math.max(0, total - 0.5)),
          duration,
          offset: 0,
          volume: 0.8,
          fadeIn: 0.3,
          fadeOut: 0.5,
        },
      });
      setSelection({ kind: 'audio', id });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not import audio', description: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PanelHeader title="Audio" onClose={onClose} icon={<Music className="h-3.5 w-3.5" />} />

      <div className="flex items-center gap-2 px-4 py-2">
        {(['music', 'sfx', 'voice'] as const).map((k) => (
          <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
            {k === 'music' ? 'Music' : k === 'sfx' ? 'Sound FX' : 'Voice'}
          </Chip>
        ))}
        <Button size="sm" variant="secondary" className="ml-auto h-8 text-xs" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
          Import audio
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importAudio(file);
            event.target.value = '';
          }}
        />
      </div>

      {project.audio.length === 0 ? (
        <Hint>
          No audio yet. Import a music, sound-effect or voice file from this device — it lands on the audio
          track at the playhead and plays in sync with the video. Files stay on your device until you export.
        </Hint>
      ) : (
        <div className="space-y-1 px-4 pb-2">
          {project.audio.map((audio) => (
            <button
              key={audio.id}
              type="button"
              onClick={() => {
                setSelection({ kind: 'audio', id: audio.id });
                seek(audio.start);
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left text-[11px]',
                selected?.id === audio.id ? 'border-emerald-400 bg-emerald-500/10' : 'border-zinc-800',
              )}
            >
              <span className="truncate">{audio.name}</span>
              <span className="ml-2 shrink-0 text-zinc-500">{audio.kind} · {fmtSec(audio.start)}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="border-t border-zinc-900">
          <SliderRow label="Start (sync with video)" value={selected.start} min={0} max={Math.max(1, total)} step={0.1}
            onChange={(v) => dispatch({ type: 'audio-props', id: selected.id, patch: { start: v } })} display={fmtSec(selected.start)} />
          <div className="px-4 pb-1">
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => dispatch({ type: 'audio-props', id: selected.id, patch: { start: time } })}>
              <PlayCircle className="mr-1 h-3 w-3" /> Align to playhead
            </Button>
          </div>
          <SliderRow label="Volume" value={Math.round(selected.volume * 100)} min={0} max={100} step={1}
            onChange={(v) => dispatch({ type: 'audio-props', id: selected.id, patch: { volume: v / 100 } })} display={`${Math.round(selected.volume * 100)}%`} />
          <SliderRow label="Fade in" value={selected.fadeIn} min={0} max={5} step={0.1}
            onChange={(v) => dispatch({ type: 'audio-props', id: selected.id, patch: { fadeIn: v } })} display={fmtSec(selected.fadeIn)} />
          <SliderRow label="Fade out" value={selected.fadeOut} min={0} max={5} step={0.1}
            onChange={(v) => dispatch({ type: 'audio-props', id: selected.id, patch: { fadeOut: v } })} display={fmtSec(selected.fadeOut)} />
          <div className="px-4 pb-3">
            <DangerButton onClick={() => { dispatch({ type: 'remove-audio', id: selected.id }); setSelection(null); }}>
              <Trash2 className="h-3.5 w-3.5" /> Remove from timeline
            </DangerButton>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ TEXT */

const TEXT_PRESETS = [
  { id: 'title', label: 'Title', style: { fontSize: 0.1, bold: true, color: '#ffffff', background: null as string | null, shadow: true, align: 'center' as const, fontFamily: FONT_CHOICES[0], italic: false }, y: 0.24 },
  { id: 'subtitle', label: 'Subtitle', style: { fontSize: 0.05, bold: false, color: '#ffffff', background: 'rgba(0,0,0,0.55)', shadow: false, align: 'center' as const, fontFamily: FONT_CHOICES[0], italic: false }, y: 0.76 },
  { id: 'caption', label: 'Caption bar', style: { fontSize: 0.055, bold: true, color: '#052e16', background: '#a7f3d0', shadow: false, align: 'center' as const, fontFamily: FONT_CHOICES[0], italic: false }, y: 0.9 },
];

function TextPanel({ project, dispatch, selection, setSelection, time, total, onClose }: PanelProps) {
  const selected = selection?.kind === 'text'
    ? project.texts.find((t) => t.id === selection.id) ?? null
    : null;

  const addText = () => {
    const id = uid('text');
    dispatch({
      type: 'add-text',
      layer: {
        id,
        text: 'Your text',
        start: Math.min(time, Math.max(0, total - 0.5)),
        duration: Math.min(3, Math.max(1, (total || 3) - time)),
        x: 0.5,
        y: 0.5,
        style: { ...DEFAULT_TEXT_STYLE },
        animation: 'none',
      },
    });
    setSelection({ kind: 'text', id });
  };

  return (
    <>
      <PanelHeader title="Text" onClose={onClose} icon={<TypeIcon className="h-3.5 w-3.5" />} />
      <div className="px-4 py-2">
        <Button size="sm" variant="secondary" className="h-8 w-full text-xs" onClick={addText}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add text at playhead
        </Button>
      </div>

      {project.texts.length > 0 && !selected && (
        <div className="space-y-1 px-4 pb-2">
          {project.texts.map((text) => (
            <button
              key={text.id}
              type="button"
              onClick={() => { setSelection({ kind: 'text', id: text.id }); }}
              className="block w-full truncate rounded-md border border-zinc-800 px-2.5 py-2 text-left text-[11px]"
            >
              {text.text || '(empty)'}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="border-t border-zinc-900 space-y-1">
          <textarea
            value={selected.text}
            onChange={(event) => dispatch({ type: 'text-props', id: selected.id, patch: { text: event.target.value } })}
            rows={2}
            className="mx-4 mt-2 w-[calc(100%-2rem)] resize-none rounded-md border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-100"
            placeholder="Type something…"
          />

          <div className="flex flex-wrap gap-1.5 px-4 py-1">
            {TEXT_PRESETS.map((preset) => (
              <Chip
                key={preset.id}
                onClick={() => dispatch({
                  type: 'text-props',
                  id: selected.id,
                  patch: { style: { ...preset.style }, y: preset.y, x: 0.5 },
                })}
              >
                {preset.label}
              </Chip>
            ))}
          </div>

          <SelectRow
            label="Font"
            value={selected.style.fontFamily}
            onChange={(v) => dispatch({ type: 'text-props', id: selected.id, patch: { style: { ...selected.style, fontFamily: v } } })}
            options={FONT_CHOICES.map((font) => ({ value: font, label: font.split(',')[0] }))}
          />

          <SliderRow label="Size" value={selected.style.fontSize} min={0.02} max={0.16} step={0.005}
            display={`${Math.round(selected.style.fontSize * 100)}%`}
            onChange={(v) => dispatch({ type: 'text-props', id: selected.id, patch: { style: { ...selected.style, fontSize: v } } })} />

          <div className="flex items-center justify-between gap-2 px-4 py-1.5">
            <span className="text-[11px] text-zinc-400">Colour</span>
            <input
              type="color"
              value={selected.style.color}
              onChange={(event) => dispatch({ type: 'text-props', id: selected.id, patch: { style: { ...selected.style, color: event.target.value } } })}
              className="h-7 w-14 rounded border border-zinc-700 bg-zinc-900"
            />
          </div>

          <div className="flex items-center justify-between gap-2 px-4 py-1.5">
            <span className="text-[11px] text-zinc-400">Background</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={selected.style.background ?? '#000000'}
                onChange={(event) => dispatch({ type: 'text-props', id: selected.id, patch: { style: { ...selected.style, background: event.target.value } } })}
                className="h-7 w-14 rounded border border-zinc-700 bg-zinc-900"
              />
              <Chip active={selected.style.background === null}
                onClick={() => dispatch({ type: 'text-props', id: selected.id, patch: { style: { ...selected.style, background: selected.style.background === null ? '#000000' : null } } })}>
                {selected.style.background === null ? 'Off' : 'On'}
              </Chip>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 px-4 py-1.5">
            <span className="text-[11px] text-zinc-400">Align</span>
            <div className="flex gap-1.5">
              {(['left', 'center', 'right'] as const).map((align) => (
                <Chip key={align} active={selected.style.align === align}
                  onClick={() => dispatch({ type: 'text-props', id: selected.id, patch: { style: { ...selected.style, align } } })}>
                  {align}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 px-4 py-1.5">
            <span className="text-[11px] text-zinc-400">Style</span>
            <div className="flex gap-1.5">
              <Chip active={selected.style.bold} onClick={() => dispatch({ type: 'text-props', id: selected.id, patch: { style: { ...selected.style, bold: !selected.style.bold } } })}>
                <b>B</b>
              </Chip>
              <Chip active={selected.style.italic} onClick={() => dispatch({ type: 'text-props', id: selected.id, patch: { style: { ...selected.style, italic: !selected.style.italic } } })}>
                <i>I</i>
              </Chip>
              <Chip active={selected.style.shadow} onClick={() => dispatch({ type: 'text-props', id: selected.id, patch: { style: { ...selected.style, shadow: !selected.style.shadow } } })}>
                Shadow
              </Chip>
            </div>
          </div>

          <SelectRow
            label="Animation"
            value={selected.animation}
            onChange={(v) => dispatch({ type: 'text-props', id: selected.id, patch: { animation: v as TextAnimation } })}
            options={[
              { value: 'none', label: 'None' },
              { value: 'fade', label: 'Fade in' },
              { value: 'slide-up', label: 'Slide up' },
              { value: 'typewriter', label: 'Typewriter' },
            ]}
          />

          <SliderRow label="Duration" value={selected.duration} min={0.5} max={Math.max(2, total)} step={0.1}
            display={fmtSec(selected.duration)}
            onChange={(v) => dispatch({ type: 'text-props', id: selected.id, patch: { duration: v } })} />

          <div className="flex items-center justify-between px-4 py-1.5">
            <span className="text-[11px] text-zinc-400">Starts {fmtSec(selected.start)}</span>
            <Button size="sm" variant="outline" className="h-7 text-[11px]"
              onClick={() => dispatch({ type: 'text-props', id: selected.id, patch: { start: time } })}>
              Set to playhead
            </Button>
          </div>

          <p className="px-4 pb-1 text-[10px] text-zinc-500">Drag the text on the preview to reposition it.</p>

          <div className="px-4 pb-3">
            <DangerButton onClick={() => { dispatch({ type: 'remove-text', id: selected.id }); setSelection(null); }}>
              <Trash2 className="h-3.5 w-3.5" /> Delete text
            </DangerButton>
          </div>
        </div>
      )}
    </>
  );
}

/* --------------------------------------------------------------- EFFECTS */

const EFFECT_LABELS: Record<EffectType, string> = {
  blur: 'Blur',
  vignette: 'Vignette',
  grain: 'Film grain',
  flash: 'Flash pulse',
  fade: 'Fade to black',
};

function EffectsPanel({ project, dispatch, contextClip, onClose }: PanelProps) {
  if (!contextClip) {
    return (
      <>
        <PanelHeader title="Effects" onClose={onClose} icon={<Wand2 className="h-3.5 w-3.5" />} />
        <Hint>Select a clip to apply effects, or add a transition between clips.</Hint>
      </>
    );
  }
  const clip = contextClip;
  const duration = clipDuration(clip);

  return (
    <>
      <PanelHeader title={`Effects · ${clip.name}`} onClose={onClose} icon={<Wand2 className="h-3.5 w-3.5" />} />

      <div className="border-b border-zinc-900 px-4 py-2">
        <p className="text-[11px] font-semibold text-zinc-300">Transition into this clip</p>
        <div className="flex flex-wrap gap-1.5 py-1.5">
          {(['none', 'fade', 'slide', 'zoom'] as TransitionType[]).map((type) => (
            <Chip
              key={type}
              active={clip.transitionIn.type === type}
              onClick={() => {
                dispatch({
                  type: 'clip-props',
                  id: clip.id,
                  patch: {
                    transitionIn: {
                      type,
                      duration: type === 'none' ? 0 : clip.transitionIn.duration || 0.6,
                    },
                  },
                });
              }}
            >
              {type}
            </Chip>
          ))}
        </div>
        {clip.transitionIn.type !== 'none' && (
          <SliderRow
            label="Transition duration"
            value={clip.transitionIn.duration}
            min={0.2}
            max={Math.max(0.4, Math.min(1.5, duration / 2))}
            step={0.05}
            display={fmtSec(clip.transitionIn.duration)}
            onChange={(v) => dispatch({ type: 'clip-props', id: clip.id, patch: { transitionIn: { type: clip.transitionIn.type, duration: v } } })}
          />
        )}
        <p className="text-[10px] text-zinc-500">
          {clip.transitionIn.type === 'none' ? 'No transition — hard cut from the previous clip.' : 'Crossfades with the previous clip; drag the duration slider.'}
        </p>
      </div>

      <div className="border-b border-zinc-900 px-4 py-2">
        <p className="text-[11px] font-semibold text-zinc-300">Add an effect</p>
        <div className="grid grid-cols-3 gap-1.5 py-1.5">
          {(Object.keys(EFFECT_LABELS) as EffectType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => dispatch({
                type: 'clip-props',
                id: clip.id,
                patch: {
                  effects: [
                    ...clip.effects,
                    { id: uid('fx'), type, intensity: type === 'flash' ? 60 : 50, start: 0, duration: Math.min(duration, 2) },
                  ],
                },
              })}
              className="rounded-md border border-zinc-700 px-2 py-2 text-[11px] text-zinc-200 hover:border-emerald-500 hover:text-emerald-300"
            >
              + {EFFECT_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {clip.effects.length === 0 ? (
        <Hint>No effects on this clip yet. Tap one above — it appears on the timeline clip and renders in both preview and export.</Hint>
      ) : (
        <div className="divide-y divide-zinc-900 pb-3">
          {clip.effects.map((effect) => (
            <div key={effect.id} className="px-4 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-300">{EFFECT_LABELS[effect.type]}</span>
                <button
                  type="button"
                  aria-label="Remove effect"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => dispatch({ type: 'clip-props', id: clip.id, patch: { effects: clip.effects.filter((e) => e.id !== effect.id) } })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <SliderRow label="Intensity" value={effect.intensity} min={0} max={100} step={1} display={`${effect.intensity}%`}
                onChange={(v) => dispatch({ type: 'clip-props', id: clip.id, patch: { effects: clip.effects.map((e) => e.id === effect.id ? { ...e, intensity: v } : e) } })} />
              <SliderRow label="Starts at" value={effect.start} min={0} max={Math.max(0.1, duration - 0.2)} step={0.05} display={fmtSec(effect.start)}
                onChange={(v) => dispatch({ type: 'clip-props', id: clip.id, patch: { effects: clip.effects.map((e) => e.id === effect.id ? { ...e, start: v } : e) } })} />
              <SliderRow label="Duration" value={effect.duration} min={0.2} max={Math.max(0.4, duration - effect.start)} step={0.05} display={fmtSec(effect.duration)}
                onChange={(v) => dispatch({ type: 'clip-props', id: clip.id, patch: { effects: clip.effects.map((e) => e.id === effect.id ? { ...e, duration: v } : e) } })} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* --------------------------------------------------------------- OVERLAY */

const STICKERS = ['🔥', '⭐', '💯', '🎉', '👍', '❤️', '😂', '🛒', '✨', '📌', '⚡', '🎁'];

function OverlayPanel({ project, dispatch, selection, setSelection, time, total, onClose }: PanelProps) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const selected = selection?.kind === 'overlay'
    ? project.overlays.find((o) => o.id === selection.id) ?? null
    : null;

  const addOverlay = (layer: Partial<OverlayLayer> & { src?: string }) => {
    const id = uid('ovl');
    dispatch({
      type: 'add-overlay',
      layer: {
        id,
        kind: 'image',
        src: '',
        name: 'Overlay',
        start: Math.min(time, Math.max(0, total - 0.5)),
        duration: Math.max(1, Math.min(5, (total || 5) - time)),
        x: 0.5,
        y: 0.5,
        width: 0.3,
        opacity: 1,
        rotation: 0,
        ...layer,
      },
    });
    setSelection({ kind: 'overlay', id });
  };

  return (
    <>
      <PanelHeader title="Overlay" onClose={onClose} icon={<ImagePlus className="h-3.5 w-3.5" />} />

      <div className="flex items-center gap-2 px-4 py-2">
        <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => fileRef.current?.click()}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Image
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) addOverlay({ kind: 'image', src: URL.createObjectURL(file), name: file.name.replace(/\.[^.]+$/, ''), width: 0.35 });
            event.target.value = '';
          }}
        />
        <span className="text-[10px] text-zinc-500">logos, stickers, images</span>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pb-2">
        {STICKERS.map((sticker) => (
          <button
            key={sticker}
            type="button"
            onClick={() => addOverlay({ kind: 'sticker', src: sticker, name: `Sticker ${sticker}`, width: 0.22 })}
            className="rounded-md border border-zinc-700 px-2 py-1 text-lg leading-none hover:border-emerald-500"
          >
            {sticker}
          </button>
        ))}
      </div>

      {project.overlays.length > 0 && !selected && (
        <div className="space-y-1 px-4 pb-2">
          {project.overlays.map((overlay) => (
            <button
              key={overlay.id}
              type="button"
              onClick={() => setSelection({ kind: 'overlay', id: overlay.id })}
              className="block w-full truncate rounded-md border border-zinc-800 px-2.5 py-2 text-left text-[11px]"
            >
              {overlay.name}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="border-t border-zinc-900">
          <SliderRow label="Size" value={selected.width} min={0.05} max={1.2} step={0.01}
            display={`${Math.round(selected.width * 100)}%`}
            onChange={(v) => dispatch({ type: 'overlay-props', id: selected.id, patch: { width: v } })} />
          <SliderRow label="Opacity" value={Math.round(selected.opacity * 100)} min={10} max={100} step={1}
            display={`${Math.round(selected.opacity * 100)}%`}
            onChange={(v) => dispatch({ type: 'overlay-props', id: selected.id, patch: { opacity: v / 100 } })} />
          <SliderRow label="Rotation" value={selected.rotation} min={-180} max={180} step={1}
            display={`${selected.rotation}°`}
            onChange={(v) => dispatch({ type: 'overlay-props', id: selected.id, patch: { rotation: v } })} />
          <SliderRow label="Duration" value={selected.duration} min={0.5} max={Math.max(2, total)} step={0.1}
            display={fmtSec(selected.duration)}
            onChange={(v) => dispatch({ type: 'overlay-props', id: selected.id, patch: { duration: v } })} />
          <div className="flex items-center justify-between px-4 py-1.5">
            <span className="text-[11px] text-zinc-400">Starts {fmtSec(selected.start)}</span>
            <Button size="sm" variant="outline" className="h-7 text-[11px]"
              onClick={() => dispatch({ type: 'overlay-props', id: selected.id, patch: { start: time } })}>
              Set to playhead
            </Button>
          </div>
          <p className="px-4 pb-1 text-[10px] text-zinc-500">Drag it on the preview to reposition.</p>
          <div className="px-4 pb-3">
            <DangerButton onClick={() => { dispatch({ type: 'remove-overlay', id: selected.id }); setSelection(null); }}>
              <Trash2 className="h-3.5 w-3.5" /> Delete overlay
            </DangerButton>
          </div>
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------- CAPTIONS */

function CaptionsPanel(props: PanelProps) {
  const { project, dispatch, selection, setSelection, time, total, onClose, user, contextClip } = props;
  const { toast } = useToast();
  const srtRef = React.useRef<HTMLInputElement>(null);
  const [generating, setGenerating] = React.useState(false);
  const [genError, setGenError] = React.useState<string | null>(null);
  const [dictating, setDictating] = React.useState(false);

  const selected = selection?.kind === 'caption'
    ? project.captions.find((c) => c.id === selection.id) ?? null
    : null;

  const addManual = () => {
    const id = uid('cue');
    const cue = makeCue('New caption', time, 2);
    dispatch({ type: 'add-caption', cue: { ...cue, id } });
    setSelection({ kind: 'caption', id });
  };

  const generate = async () => {
    if (!contextClip || !user) {
      toast({ variant: 'destructive', title: 'Nothing to transcribe', description: 'Add a video clip first.' });
      return;
    }
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(contextClip.src);
      if (!res.ok) throw new Error('Could not read the video file.');
      const blob = await res.blob();
      if (blob.size > 9 * 1024 * 1024) {
        throw new Error(
          `This clip is ${(blob.size / 1048576).toFixed(1)}MB; server transcription accepts up to 9MB. Split or shorten the clip, or type captions manually.`,
        );
      }
      const token = await user.getIdToken();
      const result = await requestTranscription(blob, token, contextClip.sourceDuration);
      if (!result.ok || !result.cues) {
        const message = result.code === 'no-provider'
          ? 'No speech-to-text provider is connected on the server yet — type or dictate captions meanwhile.'
          : result.error ?? 'Transcription failed.';
        setGenError(message);
        return;
      }
      const placed = layoutTimeline(project.clips).placed.find((p) => p.clip.id === contextClip.id);
      const offset = placed ? placed.start : 0;
      const shifted = result.cues.map((cue) => ({ ...cue, start: cue.start + offset, end: cue.end + offset }));
      dispatch({ type: 'set-captions', cues: shifted });
      setGenError(null);
      toast({ title: 'Captions generated', description: `${shifted.length} cues added — review the timing on the timeline.` });
      if (shifted[0]) props.seek(shifted[0].start);
    } catch (error) {
      setGenError(error instanceof Error ? error.message : 'Transcription failed.');
    } finally {
      setGenerating(false);
    }
  };

  const dictate = () => {
    const W = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) return;
    const recognition = new Ctor();
    setDictating(true);
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript ?? '';
      if (text.trim()) {
        const cue = makeCue(text, time, 2.5);
        dispatch({ type: 'add-caption', cue });
        setSelection({ kind: 'caption', id: cue.id });
      }
    };
    recognition.onerror = () => setDictating(false);
    recognition.onend = () => setDictating(false);
    recognition.start();
  };

  return (
    <>
      <PanelHeader title="Captions" onClose={onClose} icon={<Captions className="h-3.5 w-3.5" />} />

      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={addManual}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add at playhead
        </Button>
        <Button size="sm" variant="secondary" className="h-8 text-xs" disabled={generating} onClick={() => void generate()}>
          {generating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
          {generating ? 'Transcribing…' : 'Generate'}
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => srtRef.current?.click()}>
          <Upload className="mr-1 h-3.5 w-3.5" /> SRT
        </Button>
        <input
          ref={srtRef}
          type="file"
          accept=".srt,text/plain"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void file.text().then((text) => {
              const cues = parseSrt(text);
              if (cues.length === 0) {
                toast({ variant: 'destructive', title: 'No cues found', description: 'That file does not look like an SRT subtitle file.' });
                return;
              }
              dispatch({ type: 'set-captions', cues });
              toast({ title: 'Captions imported', description: `${cues.length} cues from ${file.name}.` });
            });
            event.target.value = '';
          }}
        />
        {dictationSupported() && (
          <Button size="sm" variant={dictating ? 'default' : 'outline'} className="h-8 text-xs" onClick={dictate}>
            <Mic className="mr-1 h-3.5 w-3.5" /> {dictating ? 'Listening…' : 'Dictate'}
          </Button>
        )}
      </div>

      <p className="px-4 pb-2 text-[10px] leading-relaxed text-zinc-500">
        <b>Generate</b> sends the clip at the playhead to the server&apos;s speech-to-text provider (speech only,
        ~9MB per clip). <b>Dictate</b> uses this device&apos;s microphone. Manual and SRT always work.
      </p>

      {genError && (
        <p className="mx-4 mb-2 rounded-md border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-[11px] text-amber-200">
          {genError}
        </p>
      )}

      {project.captions.length === 0 ? (
        <Hint>No captions yet. Add one manually, import an .srt file, dictate, or generate from speech.</Hint>
      ) : (
        <div className="space-y-1 px-4 pb-2">
          {project.captions.map((cue) => (
            <button
              key={cue.id}
              type="button"
              onClick={() => { setSelection({ kind: 'caption', id: cue.id }); props.seek(cue.start); }}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-[11px]',
                selected?.id === cue.id ? 'border-emerald-400 bg-emerald-500/10' : 'border-zinc-800',
              )}
            >
              <span className="truncate">{cue.text}</span>
              <span className="shrink-0 tabular-nums text-zinc-500">{cue.start.toFixed(1)}–{cue.end.toFixed(1)}s</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="border-t border-zinc-900">
          <textarea
            value={selected.text}
            rows={2}
            onChange={(event) => dispatch({ type: 'caption-props', id: selected.id, patch: { text: event.target.value } })}
            className="mx-4 mt-2 w-[calc(100%-2rem)] resize-none rounded-md border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-100"
          />
          <SliderRow label="Start" value={selected.start} min={0} max={Math.max(1, total)} step={0.1}
            display={fmtSec(selected.start)}
            onChange={(v) => dispatch({ type: 'caption-props', id: selected.id, patch: { start: v } })} />
          <SliderRow label="End" value={selected.end} min={selected.start + 0.3} max={Math.max(1.5, total)} step={0.1}
            display={fmtSec(selected.end)}
            onChange={(v) => dispatch({ type: 'caption-props', id: selected.id, patch: { end: v } })} />
          <div className="px-4 pb-3">
            <DangerButton onClick={() => { dispatch({ type: 'remove-caption', id: selected.id }); setSelection(null); }}>
              <Trash2 className="h-3.5 w-3.5" /> Delete cue
            </DangerButton>
          </div>
        </div>
      )}
    </>
  );
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
}

/* --------------------------------------------------------------- FILTERS */

function FiltersPanel({ project, dispatch, contextClip, setCompare, onClose }: PanelProps) {
  if (!contextClip) {
    return (
      <>
        <PanelHeader title="Filters" onClose={onClose} icon={<SlidersHorizontal className="h-3.5 w-3.5" />} />
        <Hint>Add or select a clip to try colour filters and adjustments — they preview live as you drag.</Hint>
      </>
    );
  }
  const clip = contextClip;
  const resolved = resolveAdjust(clip.preset, clip.adjust);

  const setAdjust = (patch: Partial<FilterAdjust>) =>
    dispatch({ type: 'clip-props', id: clip.id, patch: { adjust: { ...clip.adjust, ...patch } } });

  return (
    <>
      <PanelHeader title={`Filters · ${clip.name}`} onClose={onClose} icon={<SlidersHorizontal className="h-3.5 w-3.5" />} />

      <div className="grid grid-cols-4 gap-1.5 px-4 py-2">
        {FILTER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => dispatch({ type: 'clip-props', id: clip.id, patch: { preset: preset.id } })}
            className={cn(
              'rounded-md border px-1 py-2 text-[10px] transition-colors',
              clip.preset === preset.id ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 text-zinc-300',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="border-t border-zinc-900">
        <SliderRow label="Brightness" value={clip.adjust.brightness} min={-100} max={100} step={1}
          display={`${clip.adjust.brightness > 0 ? '+' : ''}${clip.adjust.brightness}`}
          onChange={(v) => setAdjust({ brightness: v })} />
        <SliderRow label="Contrast" value={clip.adjust.contrast} min={-100} max={100} step={1}
          display={`${clip.adjust.contrast > 0 ? '+' : ''}${clip.adjust.contrast}`}
          onChange={(v) => setAdjust({ contrast: v })} />
        <SliderRow label="Saturation" value={clip.adjust.saturation} min={-100} max={100} step={1}
          display={`${clip.adjust.saturation > 0 ? '+' : ''}${clip.adjust.saturation}`}
          onChange={(v) => setAdjust({ saturation: v })} />
        <SliderRow label="Temperature" value={clip.adjust.temperature} min={-100} max={100} step={1}
          display={clip.adjust.temperature > 10 ? `warm +${clip.adjust.temperature}` : clip.adjust.temperature < -10 ? `cool ${clip.adjust.temperature}` : 'neutral'}
          onChange={(v) => setAdjust({ temperature: v })} />
        <SliderRow label="Sharpness" value={clip.adjust.sharpness} min={0} max={100} step={1}
          display={`${clip.adjust.sharpness}%`}
          onChange={(v) => setAdjust({ sharpness: v })} />
      </div>

      <p className="px-4 pb-2 text-[10px] leading-relaxed text-zinc-500">
        Sharpness is a contrast/saturation micro-boost (browsers have no unsharp mask) — identical in preview and
        export. {resolved.brightness !== 0 || resolved.contrast !== 0 ? 'Values shown include the preset.' : ''}
      </p>

      <div className="flex items-center gap-2 px-4 pb-3">
        <Button
          size="sm"
          variant="outline"
          className="h-8 flex-1 text-xs"
          onPointerDown={() => setCompare(true)}
          onPointerUp={() => setCompare(false)}
          onPointerLeave={() => setCompare(false)}
        >
          Hold to compare original
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 text-xs"
          onClick={() => dispatch({ type: 'clip-props', id: clip.id, patch: { preset: 'original', adjust: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, sharpness: 0 } } })}
        >
          Reset
        </Button>
      </div>

      <p className="px-4 pb-3 text-[10px] text-zinc-500">
        The display aspect is {displayedAspect(clip).toFixed(2)}:1 after rotation.
      </p>
    </>
  );
}

/* -------------------------------------------------------------- dispatcher */

export function EditorPanels({ tool, onClose, ...ctx }: Props) {
  const shared: PanelProps = { ...ctx, onClose };
  switch (tool) {
    case 'edit':
      return <EditPanel {...shared} />;
    case 'audio':
      return <AudioPanel {...shared} />;
    case 'text':
      return <TextPanel {...shared} />;
    case 'effects':
      return <EffectsPanel {...shared} />;
    case 'overlay':
      return <OverlayPanel {...shared} />;
    case 'captions':
      return <CaptionsPanel {...shared} />;
    case 'filters':
      return <FiltersPanel {...shared} />;
    default:
      return null;
  }
}
