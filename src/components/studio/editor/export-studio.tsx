'use client';

/**
 * Export studio — every control maps to a real encoder parameter, progress
 * is the actual render clock, and the container badge tells the truth about
 * what THIS browser can record (MP4 directly, or WebM that Vidnov's
 * pipeline transcodes to MP4 on publish).
 */

import * as React from 'react';
import type { User } from 'firebase/auth';
import {
  X, Download, Loader2, AlertTriangle, CheckCircle2, CloudUpload, Copy, Film,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  detectCapabilities,
  exportProject,
  frameRateOptions,
  pickContainer,
  qualityPresets,
  resolutionOptions,
  type ExportJob,
  type ExportPhase,
  type ExportResult,
} from '@/lib/editor/export';
import { totalDuration } from '@/lib/editor/timeline';
import type { EditorProject } from '@/lib/editor/types';
import { uploadMedia } from '@/lib/media/upload-client';
import { cn } from '@/lib/utils';

export interface ExportStudioProps {
  project: EditorProject;
  user: User | null;
  onClose: () => void;
}

type AspectMode = 'original' | '9:16' | '16:9' | '1:1';

type PublishState =
  | { phase: 'idle' }
  | { phase: 'uploading'; percent: number }
  | { phase: 'ready'; url: string; thumbnailUrl?: string }
  | { phase: 'failed'; error: string };

const even = (n: number): number => Math.max(2, Math.round(n / 2) * 2);

export function ExportStudio({ project, user, onClose }: ExportStudioProps) {
  const caps = React.useMemo(() => detectCapabilities(), []);
  const container = React.useMemo(() => pickContainer(caps), [caps]);
  const resolutions = React.useMemo(() => resolutionOptions(caps), [caps]);
  const { toast } = useToast();

  const [height, setHeight] = React.useState(() => (caps.largeCanvas ? 1080 : 720));
  const [fps, setFps] = React.useState(30);
  const [qualityId, setQualityId] = React.useState('recommended');
  const [aspectMode, setAspectMode] = React.useState<AspectMode>('original');
  const [withAudio, setWithAudio] = React.useState(true);

  const [status, setStatus] = React.useState<ExportPhase | null>(null);
  const [result, setResult] = React.useState<ExportResult | null>(null);
  const [publish, setPublish] = React.useState<PublishState>({ phase: 'idle' });
  const jobRef = React.useRef<ExportJob | null>(null);
  const savedUrlRef = React.useRef<string | null>(null);

  const aspect = aspectMode === 'original'
    ? project.aspect
    : aspectMode === '9:16' ? { w: 9, h: 16 } : aspectMode === '16:9' ? { w: 16, h: 9 } : { w: 1, h: 1 };
  const width = even((height * aspect.w) / aspect.h);
  const outHeight = even(height);
  const quality = qualityPresets(outHeight).find((q) => q.id === qualityId) ?? qualityPresets(outHeight)[1];
  const busy = status !== null && status.phase !== 'error' && status.phase !== 'cancelled' && status.phase !== 'done';
  const total = totalDuration(project);

  const start = () => {
    setResult(null);
    setPublish({ phase: 'idle' });
    const job = exportProject(
      project,
      { width, height: outHeight, fps, bitrate: quality.mbps * 1_000_000, withAudio },
      setStatus,
    );
    jobRef.current = job;
    void job.promise.then((res) => {
      setResult(res);
      if (res.ok) setStatus({ phase: 'done', percent: 100 });
      else if (res.cancelled) setStatus({ phase: 'cancelled', percent: 0 });
      else setStatus({ phase: 'error', percent: 0, error: res.error ?? 'Export failed.' });
    });
  };

  const saveToDevice = () => {
    if (!result?.blob) return;
    const url = URL.createObjectURL(result.blob);
    savedUrlRef.current = url;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(project.name || 'vidnov-edit').replace(/[^\w-]+/g, '-').slice(0, 40)}-${outHeight}p.${result.extension}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const publishToVidnov = () => {
    if (!result?.blob || !user || publish.phase === 'uploading') return;
    const fileName = `${(project.name || 'export').replace(/[^\w-]+/g, '-').slice(0, 32)}.${result.extension}`;
    const file = new File([result.blob], fileName, {
      type: result.mimeType.split(';')[0] || (result.extension === 'mp4' ? 'video/mp4' : 'video/webm'),
    });
    setPublish({ phase: 'uploading', percent: 0 });
    const handle = uploadMedia(file, user, (progress) => {
      if (progress.phase === 'failed') {
        setPublish({ phase: 'failed', error: progress.error ?? 'Upload failed.' });
      } else if (progress.phase === 'ready') {
        setPublish({ phase: 'ready', url: progress.url ?? '', thumbnailUrl: progress.thumbnailUrl });
      } else {
        setPublish({ phase: 'uploading', percent: progress.percent });
      }
    });
    void handle.promise;
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy', description: url });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur">
          <span className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Film className="h-4 w-4 text-emerald-400" /> Export
          </span>
          <button type="button" aria-label="Close export" onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          {/* Container truth */}
          {container ? (
            <p className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[11px] leading-relaxed text-zinc-300">
              <b className="text-emerald-400">{container.extension.toUpperCase()}</b>{' '}
              {container.extension === 'mp4'
                ? '— this browser records MP4 directly.'
                : '— this browser has no MP4 recorder. Exported file is WebM; publishing through Vidnov transcodes it to MP4 on the server.'}
            </p>
          ) : (
            <p className="rounded-md border border-red-900/70 bg-red-950/40 px-3 py-2 text-[11px] text-red-300">
              This browser cannot record video (MediaRecorder unavailable). Open the editor in Chrome or Safari on the device.
            </p>
          )}

          {!caps.canvasFilter && (
            <p className="flex gap-2 rounded-md border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-[11px] text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              This browser cannot bake colour adjustments into the recording — filters and effects on the picture will be missing from the file.
            </p>
          )}

          {/* Resolution */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Resolution</p>
            <div className="flex flex-wrap gap-1.5">
              {resolutions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setHeight(option.height)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-[11px]',
                    height === option.height ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 text-zinc-300',
                  )}
                >
                  {option.label}
                  {!option.publishable && (
                    <span className="ml-1 text-[9px] text-amber-400">device only</span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-zinc-500">
              {width}×{outHeight}
              {aspectMode === 'original' ? ' · original aspect preserved' : ` · ${aspectMode} (letterboxed)`}
            </p>
          </div>

          {/* Frame rate */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Frame rate</p>
            <div className="flex gap-1.5">
              {frameRateOptions().map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setFps(rate)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-[11px]',
                    fps === rate ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 text-zinc-300',
                  )}
                >
                  {rate} fps
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Quality · {quality.mbps} Mbps
            </p>
            <div className="flex gap-1.5">
              {qualityPresets(outHeight).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setQualityId(option.id)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-[11px]',
                    qualityId === option.id ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 text-zinc-300',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Aspect */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Aspect ratio</p>
            <div className="flex flex-wrap gap-1.5">
              {(['original', '9:16', '16:9', '1:1'] as AspectMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAspectMode(mode)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-[11px] capitalize',
                    aspectMode === mode ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 text-zinc-300',
                  )}
                >
                  {mode === 'original' ? 'Original' : mode}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between text-[11px] text-zinc-300">
            <span>Include audio ({project.audio.length} music · clip sound {withAudio ? 'on' : 'off'})</span>
            <input type="checkbox" checked={withAudio} onChange={(e) => setWithAudio(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
          </label>

          {/* Progress / result */}
          {status && status.phase === 'rendering' && (
            <div className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full bg-emerald-500 transition-[width] duration-200" style={{ width: `${status.percent.toFixed(0)}%` }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Rendering in real time… {status.percent.toFixed(0)}%
                  <span className="text-zinc-600">({status.elapsed.toFixed(0)}s of {total.toFixed(0)}s)</span>
                </span>
                <button
                  type="button"
                  className="rounded border border-red-900/70 px-2 py-0.5 text-red-300"
                  onClick={() => jobRef.current?.cancel()}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {status && status.phase === 'preparing' && (
            <p className="flex items-center gap-2 text-[11px] text-zinc-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading media…</p>
          )}
          {status && status.phase === 'finalizing' && (
            <p className="flex items-center gap-2 text-[11px] text-zinc-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Finalizing file…</p>
          )}
          {status && status.phase === 'error' && (
            <p className="flex gap-2 rounded-md border border-red-900/70 bg-red-950/40 px-3 py-2 text-[11px] text-red-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {status.error}
            </p>
          )}
          {status && status.phase === 'cancelled' && (
            <p className="text-[11px] text-zinc-400">Export cancelled — nothing was saved.</p>
          )}

          {result?.ok && result.blob && (
            <div className="space-y-2 rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-3">
              <p className="flex items-center gap-2 text-[12px] text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Rendered {(result.blob.size / 1048576).toFixed(1)} MB · {result.extension.toUpperCase()} · {width}×{outHeight}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="h-8 text-xs" onClick={saveToDevice}>
                  <Download className="mr-1 h-3.5 w-3.5" /> Save to device
                </Button>
                <Button size="sm" variant="secondary" className="h-8 text-xs" disabled={!user || publish.phase === 'uploading'} onClick={publishToVidnov}>
                  {publish.phase === 'uploading' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="mr-1 h-3.5 w-3.5" />}
                  {publish.phase === 'uploading' ? `Uploading ${publish.percent}%` : 'Publish to Vidnov'}
                </Button>
              </div>

              {publish.phase === 'uploading' && (
                <div className="h-1.5 overflow-hidden rounded-full bg-emerald-950">
                  <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${publish.percent}%` }} />
                </div>
              )}
              {publish.phase === 'ready' && publish.url && (
                <div className="space-y-1.5 text-[11px]">
                  <p className="text-emerald-300">In your Vidnov media library — ready for Discovery, product listings, your shop and social posts.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => void copyLink(publish.url)}>
                      <Copy className="mr-1 h-3 w-3" /> Copy link
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" asChild>
                      <a href="/my-media">Open my media</a>
                    </Button>
                  </div>
                </div>
              )}
              {publish.phase === 'failed' && (
                <p className="text-[11px] text-red-300">Publish failed: {publish.error} — your file is still saved locally.</p>
              )}
            </div>
          )}

          {/* Primary action */}
          <div className="flex gap-2 pt-1">
            {!result?.ok && (
              <Button className="flex-1" disabled={!container || busy || total <= 0} onClick={start}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {result && status?.phase === 'error' ? 'Try again' : `Export ${container?.extension.toUpperCase() ?? 'video'}`}
              </Button>
            )}
            <Button variant={result?.ok ? 'default' : 'ghost'} className={result?.ok ? 'flex-1' : 'shrink-0'} onClick={onClose}>
              {result?.ok ? 'Done' : 'Close'}
            </Button>
          </div>
          <p className="text-[10px] leading-relaxed text-zinc-600">
            Export plays the timeline once in real time and records what it draws — keep this tab in the
            foreground until it finishes. {height >= 2160 ? '4K stays on your device; Vidnov publishing re-encodes at up to 1080p.' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
