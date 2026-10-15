'use client';

import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Trash2, RefreshCw, ImageIcon, Film, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * MY GENERATIONS (spec §13): the user's AI history, backed by aiJobs.
 * Tabs: All / Images / Videos / Processing / Completed / Failed.
 */

export interface AiAttachmentView {
  target: 'product' | 'service' | 'request' | 'business' | 'message' | 'live';
  targetId: string;
  label: string;
  attachedAt?: unknown;
}

export interface AiJobView {
  id: string;
  type: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  prompt?: string | null;
  outputUrl?: string | null;
  thumbnailUrl?: string | null;
  outputMediaId?: string | null;
  engine?: string | null;
  model?: string | null;
  saved?: boolean;
  attachments?: AiAttachmentView[];
  processingMs?: number | null;
  progress?: number;
  creditsUsed?: number;
  errorMessage?: string | null;
  createdAt?: unknown;
}

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'images', label: 'Images' },
  { key: 'videos', label: 'Videos' },
  { key: 'processing', label: 'Processing' },
  { key: 'completed', label: 'Completed' },
  { key: 'saved', label: 'Saved' },
  { key: 'failed', label: 'Failed' },
] as const;

const IMAGE_TYPES = ['text-to-image', 'image-to-image'];

function matches(job: AiJobView, tab: string): boolean {
  switch (tab) {
    case 'all':
      return true;
    case 'images':
      return IMAGE_TYPES.includes(job.type);
    case 'videos':
      return !IMAGE_TYPES.includes(job.type);
    case 'processing':
      return job.status === 'QUEUED' || job.status === 'PROCESSING';
    case 'completed':
      return job.status === 'COMPLETED';
    case 'saved':
      return job.status === 'COMPLETED' && (job.saved || (job.attachments?.length ?? 0) > 0);
    case 'failed':
      return job.status === 'FAILED' || job.status === 'CANCELLED';
    default:
      return true;
  }
}

function statusBadge(status: AiJobView['status']) {
  const map: Record<AiJobView['status'], { label: string; className: string }> = {
    QUEUED: { label: 'Queued', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
    PROCESSING: { label: 'Generating…', className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
    COMPLETED: { label: 'Completed', className: 'bg-green-500/10 text-green-600 border-green-500/30' },
    FAILED: { label: 'Failed', className: 'bg-destructive/10 text-destructive border-destructive/30' },
    CANCELLED: { label: 'Cancelled', className: 'bg-muted text-muted-foreground border-border' },
  };
  const s = map[status];
  return (
    <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-wider ${s.className}`}>
      {s.label}
    </Badge>
  );
}

function createdLabel(value: unknown): string {
  const ts = value as { toDate?: () => Date } | null | undefined;
  const d = typeof ts?.toDate === 'function' ? ts.toDate() : ts ? new Date(String(ts)) : null;
  return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

interface GenerationHistoryProps {
  jobs: AiJobView[] | null;
  loading?: boolean;
  className?: string;
  onDelete?: (job: AiJobView) => void;
  /** Opens the professional creation viewer (spec §10). */
  onOpen?: (job: AiJobView) => void;
  /** Hides the "My Generations" heading when the studio renders its own. */
  hideTitle?: boolean;
}

export function GenerationHistory({ jobs, loading, className, onDelete, onOpen, hideTitle }: GenerationHistoryProps) {
  const [tab, setTab] = React.useState<string>('all');
  const list = (jobs ?? []).filter((j) => matches(j, tab));

  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!hideTitle && (
          <h2 className="font-grotesk text-xl font-black uppercase tracking-tight">My Generations</h2>
        )}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wide transition',
              tab === t.key
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/40',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 && !loading && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-12 text-center">
          <Clock3 className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nothing here yet — your generations will appear here.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((job) => (
          <div key={job.id} className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md">
            <div className="relative aspect-video w-full overflow-hidden bg-muted">
              {job.status === 'COMPLETED' && job.outputUrl ? (
                job.type === 'text-to-image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={job.outputUrl} alt={job.prompt ?? 'Generation'} className="h-full w-full object-cover" />
                ) : job.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={job.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <video src={job.outputUrl} controls preload="metadata" className="h-full w-full object-cover" />
                )
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  {job.status === 'FAILED' ? (
                    <RefreshCw className="h-5 w-5" />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  )}
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {job.status === 'FAILED' ? 'Generation failed' : 'Generating…'}
                  </span>
                </div>
              )}
              <div className="absolute left-2 top-2 flex gap-1.5">
                {job.type === 'text-to-image' ? (
                  <ImageIcon className="h-4 w-4 text-white drop-shadow" />
                ) : (
                  <Film className="h-4 w-4 text-white drop-shadow" />
                )}
              </div>
            </div>

            <div className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                  {job.type.replace(/-/g, ' ')}
                </span>
                {statusBadge(job.status)}
              </div>
              {job.prompt && <p className="line-clamp-2 text-xs text-muted-foreground">{job.prompt}</p>}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {createdLabel(job.createdAt)}
                  {job.engine ? ` · ${job.engine}` : ''}
                </span>
                <div className="flex items-center gap-1">
                  {job.status === 'COMPLETED' && onOpen && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[10px] font-black uppercase tracking-wider"
                      onClick={() => onOpen(job)}
                    >
                      View
                    </Button>
                  )}
                  {job.status === 'COMPLETED' && job.outputUrl && (
                    <Button asChild variant="ghost" size="icon" className="h-7 w-7" aria-label="Download">
                      <a href={job.outputUrl} download target="_blank" rel="noreferrer">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      aria-label="Delete"
                      onClick={() => onDelete(job)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              {job.status === 'FAILED' && job.errorMessage && (
                <p className="text-[11px] font-semibold text-destructive">{job.errorMessage}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
