'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, X, PartyPopper, Clock3, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AiJobView } from './generation-history';

/**
 * GENERATION QUEUE (spec §9).
 *
 * Generation never blocks the page: this panel shows every in-flight job
 * with its live progress, its place in the queue, an estimate and a cancel
 * action, then switches to "Your creation is ready" when the job lands.
 */
interface GenerationQueueProps {
  jobs: AiJobView[];
  onCancel?: (job: AiJobView) => void;
  onView?: (job: AiJobView) => void;
  className?: string;
}

const TYPE_LABEL: Record<string, string> = {
  'text-to-image': 'Text → Image',
  'image-to-image': 'Image → Image',
  'text-to-video': 'Text → Video',
  'image-to-video': 'Image → Video',
  'image-animation': 'Animate Image',
};

/** Rough ETA per capability — video work on the GPU worker takes minutes. */
function estimate(type: string): string {
  return type.includes('video') || type === 'image-animation' ? 'Usually 1–4 minutes' : 'Usually under a minute';
}

export function GenerationQueue({ jobs, onCancel, onView, className }: GenerationQueueProps) {
  const active = jobs.filter((j) => j.status === 'QUEUED' || j.status === 'PROCESSING');
  const justDone = jobs.filter((j) => j.status === 'COMPLETED').slice(0, 2);
  if (active.length === 0 && justDone.length === 0) return null;

  return (
    <section className={cn('space-y-3', className)} aria-label="Generation queue">
      {active.map((job, index) => {
        const queued = job.status === 'QUEUED';
        const progress = queued ? 5 : Math.max(job.progress ?? 30, 30);
        return (
          <div
            key={job.id}
            className="rounded-2xl border border-white/12 bg-white/[0.04] p-5"
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                  {TYPE_LABEL[job.type] ?? job.type}
                </p>
                <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-white">
                  {queued ? <Clock3 className="h-4 w-4 text-white/60" /> : <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  {queued ? 'Waiting in the queue…' : 'Your creation is being created…'}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  Position in queue: {queued ? index + 1 : '—'} · {estimate(job.type)}
                </p>
              </div>
              {onCancel && queued && (
                <Button variant="outline" size="sm" className="border-white/15 text-white hover:bg-white/10" onClick={() => onCancel(job)}>
                  <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
                </Button>
              )}
            </div>

            <Progress value={progress} className="mt-4 h-1.5 bg-white/10" />

            <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/35">
              <span>{queued ? 'Queued' : 'Processing'}</span>
              <span>{progress}%</span>
            </div>
          </div>
        );
      })}

      {active.length === 0 &&
        justDone.map((job) => (
          <div key={job.id} className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <PartyPopper className="h-4 w-4 text-emerald-300" /> Your creation is ready.
            </p>
            <p className="mt-1 text-xs text-white/55">
              {TYPE_LABEL[job.type] ?? job.type}
              {job.engine ? ` · ${job.engine}` : ''}
              {job.processingMs ? ` · ${Math.max(1, Math.round(job.processingMs / 1000))}s` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {onView && (
                <Button size="sm" className="rounded-full font-black uppercase tracking-wide" onClick={() => onView(job)}>
                  View Creation
                </Button>
              )}
              {job.status === 'FAILED' && (
                <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
                  <Ban className="h-3.5 w-3.5" /> {job.errorMessage ?? 'Generation failed'}
                </span>
              )}
            </div>
          </div>
        ))}
    </section>
  );
}