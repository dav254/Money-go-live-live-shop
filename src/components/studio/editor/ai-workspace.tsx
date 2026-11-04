'use client';

/**
 * AI UHD / Enhance workspace.
 *
 * Contract with the user: this screen NEVER pretends to work. On mount it
 * asks the server (GET /api/ai/enhance) what is actually connected, and:
 *   - no provider  → the workspace renders disabled with the server's own
 *                    reason, and nothing runs;
 *   - provider     → enhancement is a REAL fal.ai upscale of an OWNED media
 *                    file (never a fabricated before/after), the result lands
 *                    in the user's Vidnov library, and can be pulled straight
 *                    into the timeline.
 *
 * The target is always a library asset (or a device file uploaded first),
 * because the provider needs a file the server can send it.
 */

import * as React from 'react';
import type { User } from 'firebase/auth';
import { X, Sparkles, Loader2, AlertTriangle, CheckCircle2, Film, ImageIcon, Link2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { uploadMedia } from '@/lib/media/upload-client';
import { MediaPicker, type LibraryItem } from './media-picker';

export interface AiWorkspaceProps {
  user: User | null;
  /** The clip at the playhead when it came from the media library. */
  contextMediaId?: string;
  contextClipName?: string;
  onClose: () => void;
  /** Pull the enhanced result into the timeline as a new clip. */
  onAddToTimeline: (item: { mediaId: string; url: string; name: string }) => void;
}

interface Status {
  available: boolean;
  image: boolean;
  video: boolean;
  engines: string | null;
}

type JobState =
  | { phase: 'idle' }
  | { phase: 'uploading'; percent: number }
  | { phase: 'running'; kind: 'image' | 'video'; since: number }
  | { phase: 'done'; mediaId: string; url: string; thumbnailUrl?: string }
  | { phase: 'failed'; error: string };

export function AiWorkspace({ user, contextMediaId, contextClipName, onClose, onAddToTimeline }: AiWorkspaceProps) {
  const { toast } = useToast();
  const [status, setStatus] = React.useState<Status | null>(null);
  const [target, setTarget] = React.useState<{ mediaId: string; kind: 'image' | 'video'; label: string } | null>(null);
  const [picker, setPicker] = React.useState<'video' | 'image' | null>(null);
  const [scale, setScale] = React.useState<2 | 4>(2);
  const [job, setJob] = React.useState<JobState>({ phase: 'idle' });
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    fetch('/api/ai/enhance')
      .then((r) => r.json())
      .then((data: Status) => { if (alive) setStatus(data); })
      .catch(() => { if (alive) setStatus({ available: false, image: false, video: false, engines: null }); });
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    if (job.phase !== 'running') return;
    const started = job.since;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [job]);

  const ready = status?.available === true && user !== null;
  const busy = job.phase === 'running' || job.phase === 'uploading';

  const run = async () => {
    if (!target || !ready || busy) return;
    setJob({ phase: 'running', kind: target.kind, since: Date.now() });
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/ai/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({ kind: target.kind, mediaId: target.mediaId, scale }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        mediaId?: string; url?: string; thumbnailUrl?: string; error?: string;
      };
      if (!res.ok || !data.mediaId || !data.url) {
        setJob({ phase: 'failed', error: data.error ?? `Enhancement failed (${res.status}).` });
        return;
      }
      setJob({ phase: 'done', mediaId: data.mediaId, url: data.url, thumbnailUrl: data.thumbnailUrl ?? undefined });
    } catch (error) {
      setJob({ phase: 'failed', error: error instanceof Error ? error.message : 'Enhancement failed.' });
    }
  };

  const uploadFirst = (file: File) => {
    if (!user) return;
    const isImage = file.type.startsWith('image/');
    setJob({ phase: 'uploading', percent: 0 });
    const handle = uploadMedia(file, user, (progress) => {
      if (progress.phase === 'failed') {
        setJob({ phase: 'failed', error: progress.error ?? 'Upload failed.' });
      } else if (progress.phase === 'ready') {
        setJob({ phase: 'idle' });
        setTarget({ mediaId: handle.mediaId, kind: isImage ? 'image' : 'video', label: file.name });
      } else {
        setJob({ phase: 'uploading', percent: progress.percent });
      }
    });
    void handle.promise;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Sparkles className="h-4 w-4 text-emerald-400" /> AI UHD · Enhance
          </span>
          <button type="button" aria-label="Close AI workspace" onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          {/* Provider truth */}
          {status === null && (
            <p className="flex items-center gap-2 text-[12px] text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking enhancement capability…
            </p>
          )}
          {status !== null && !status.available && (
            <div className="flex gap-2 rounded-lg border border-amber-800/60 bg-amber-950/40 px-3 py-2.5 text-[12px] leading-relaxed text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <b>No enhancement provider is connected to this server.</b> AI UHD cannot run, so it is switched
                off rather than simulated. Everything else — trimming, filters, effects, captions, export — works
                normally. An admin can connect an upscaling provider (fal.ai key) in environment settings to turn
                this on.
              </span>
            </div>
          )}
          {status?.available && (
            <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[11px] text-zinc-400">
              Provider connected · engines: <span className="text-emerald-400">{status.engines}</span>. Up-scaling
              is a real model run on your file — expect {job.phase === 'running' ? 'the current run to take 1–5 minutes' : '1–5 minutes per run'}.
            </p>
          )}

          {/* Target */}
          <div className="rounded-lg border border-zinc-800 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">What to enhance</p>
            {contextMediaId && !target && (
              <button
                type="button"
                onClick={() => setTarget({ mediaId: contextMediaId, kind: 'video', label: contextClipName ?? 'Current clip' })}
                className="mb-2 flex w-full items-center gap-2 rounded-md border border-emerald-700/60 bg-emerald-950/30 px-3 py-2 text-left text-[12px] text-emerald-200"
              >
                <Film className="h-4 w-4 shrink-0" /> Current clip: {contextClipName ?? 'this timeline clip'}
              </button>
            )}
            {!target && (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1 text-xs" disabled={!ready} onClick={() => setPicker('video')}>
                  <Film className="mr-1 h-3.5 w-3.5" /> Video from library
                </Button>
                <Button size="sm" variant="secondary" className="flex-1 text-xs" disabled={!ready} onClick={() => setPicker('image')}>
                  <ImageIcon className="mr-1 h-3.5 w-3.5" /> Image from library
                </Button>
              </div>
            )}
            {target && (
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12px] text-zinc-200">
                  {target.kind === 'image' ? <ImageIcon className="mr-1 inline h-3.5 w-3.5" /> : <Film className="mr-1 inline h-3.5 w-3.5" />}
                  {target.label}
                </span>
                <button type="button" className="shrink-0 text-[11px] text-zinc-500 underline" onClick={() => { setTarget(null); setJob({ phase: 'idle' }); }}>
                  change
                </button>
              </div>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
              Enhancement runs on files the server can send to the provider — pick from your library, or choose a
              device file and it uploads first (it would upload on publish anyway).
            </p>
          </div>

          {/* Scale */}
          <div className="rounded-lg border border-zinc-800 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Upscale factor</p>
            <div className="flex gap-1.5">
              {([2, 4] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScale(value)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-[11px]',
                    scale === value ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 text-zinc-300',
                  )}
                >
                  {value}× {value === 2 ? '(UHD, faster)' : '(max, slower)'}
                </button>
              ))}
            </div>
          </div>

          {/* Job state */}
          {job.phase === 'uploading' && (
            <div className="space-y-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${job.percent}%` }} />
              </div>
              <p className="text-[11px] text-zinc-400">Uploading to your library… {job.percent}%</p>
            </div>
          )}
          {job.phase === 'running' && (
            <p className="flex items-center gap-2 text-[12px] text-zinc-300">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              Enhancing ({job.kind}) — running for <Clock className="h-3 w-3" /> {elapsed}s. Keep this tab open.
            </p>
          )}
          {job.phase === 'failed' && (
            <p className="flex gap-2 rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-[11px] text-red-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {job.error}
            </p>
          )}
          {job.phase === 'done' && (
            <div className="space-y-2 rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-3">
              <p className="flex items-center gap-2 text-[12px] text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> Enhanced file saved to your Vidnov library ({scale}×).
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    onAddToTimeline({ mediaId: job.mediaId, url: job.url, name: `${target?.label ?? 'Enhanced'} ${scale}×` });
                    toast({ title: 'Added to timeline', description: 'The enhanced clip was appended to the video track.' });
                    onClose();
                  }}
                >
                  <Sparkles className="mr-1 h-3.5 w-3.5" /> Add to timeline
                </Button>
                <Button size="sm" variant="secondary" className="h-8 text-xs" asChild>
                  <a href="/my-media"><Link2 className="mr-1 h-3.5 w-3.5" /> Open my media</a>
                </Button>
              </div>
            </div>
          )}

          {/* Run */}
          <Button className="w-full" disabled={!ready || !target || busy} onClick={() => void run()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {job.phase === 'failed' ? 'Try again' : `Enhance ${scale}×`}
          </Button>
        </div>
      </div>

      {picker && (
        <MediaPicker
          kind={picker}
          user={user}
          onClose={() => setPicker(null)}
          onPickFile={uploadFirst}
          onPickUrl={(item: LibraryItem) => setTarget({ mediaId: item.mediaId, kind: picker, label: item.originalName || item.mediaId })}
        />
      )}
    </div>
  );
}
