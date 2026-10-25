'use client';

/**
 * MY VIDEOS — the studio's library (spec §A8).
 *
 * Five states, all driven by the seller's own `studioVideos` documents:
 * All / Drafts / Processing / Published / Failed. Every metric shown comes
 * from the linked PUBLIC listing (real viewCount / likes / sales — no
 * invented numbers), and deleting a video removes only the studio record —
 * a linked product listing is never touched (§A8 integrity rule).
 */

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  AlertTriangle,
  Copy,
  Film,
  Loader2,
  Pencil,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import type { StudioVideoDoc } from '@/lib/studio/video-studio';
import { cn } from '@/lib/utils';

export type DraftRecord = StudioVideoDoc & { id: string };

type TabKey = 'all' | 'draft' | 'processing' | 'published' | 'failed';

const STATUS_META: Record<
  string,
  { label: string; className: string; icon: React.ReactNode }
> = {
  draft: {
    label: 'Draft',
    className: 'bg-muted text-muted-foreground',
    icon: <Pencil className="h-3 w-3" />,
  },
  rendering: {
    label: 'Processing',
    className: 'bg-amber-500/15 text-amber-600',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  ready: {
    label: 'Ready to publish',
    className: 'bg-sky-500/15 text-sky-600',
    icon: <Film className="h-3 w-3" />,
  },
  publishing: {
    label: 'Publishing',
    className: 'bg-amber-500/15 text-amber-600',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  published: {
    label: 'Published',
    className: 'bg-emerald-500/15 text-emerald-600',
    icon: <Film className="h-3 w-3" />,
  },
  failed: {
    label: 'Failed',
    className: 'bg-destructive/15 text-destructive',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
};

function inTab(status: string, tab: TabKey): boolean {
  if (tab === 'all') return true;
  if (tab === 'processing') return status === 'rendering' || status === 'publishing';
  if (tab === 'draft') return status === 'draft' || status === 'ready';
  if (tab === 'published') return status === 'published';
  return status === 'failed';
}

function formatDate(value: unknown): string {
  if (!value) return '';
  const d =
    typeof value === 'object' && value !== null && 'toDate' in value
      ? (value as { toDate: () => Date }).toDate()
      : new Date(value as string | number);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Props {
  drafts: DraftRecord[];
  /** productId → real listing metrics (viewCount/likes/salesCount). */
  metrics: Map<string, { viewCount?: number; likes?: number; salesCount?: number }>;
  onResume: (d: DraftRecord) => void;
  onDelete: (id: string) => void;
}

export function MyVideos({ drafts, metrics, onResume, onDelete }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<TabKey>('all');

  const filtered = React.useMemo(
    () => drafts.filter((d) => inTab(d.status ?? 'draft', tab)),
    [drafts, tab],
  );

  const counts = React.useMemo(() => {
    const c = { all: drafts.length, draft: 0, processing: 0, published: 0, failed: 0 };
    for (const d of drafts) {
      const s = d.status ?? 'draft';
      if (s === 'published') c.published += 1;
      else if (s === 'rendering' || s === 'publishing') c.processing += 1;
      else if (s === 'failed') c.failed += 1;
      else c.draft += 1;
    }
    return c;
  }, [drafts]);

  const copyLink = async (id: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/products/${id}`);
      toast({ title: 'Link copied', description: 'The share link is on your clipboard.' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy the link' });
    }
  };

  return (
    <section className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          {(
            [
              ['all', `All (${counts.all})`],
              ['draft', `Drafts (${counts.draft})`],
              ['processing', `Processing (${counts.processing})`],
              ['published', `Published (${counts.published})`],
              ['failed', `Failed (${counts.failed})`],
            ] as const
          ).map(([key, label]) => (
            <TabsTrigger
              key={key}
              value={key}
              className="rounded-full border border-border px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-primary/10"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Film className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
          <p className="text-sm font-semibold">No videos here yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tab === 'published'
              ? 'Videos you publish will appear here with their live listing link.'
              : 'Record or upload a clip to start your first video.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => {
            const meta = STATUS_META[d.status ?? 'draft'] ?? STATUS_META.draft;
            const thumb = d.final?.thumbnailUrl || d.source?.thumbnailUrl || '';
            const listingId = d.publishedDocId || '';
            const m = listingId ? metrics.get(listingId) : undefined;
            const title = d.details?.title?.trim() || 'Untitled video';

            return (
              <article
                key={d.id}
                className="group overflow-hidden rounded-2xl border border-border bg-card"
              >
                <div className="relative aspect-video w-full bg-muted">
                  {thumb ? (
                    <Image
                      src={thumb}
                      alt={title}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Film className="h-7 w-7 text-muted-foreground" />
                    </div>
                  )}
                  <Badge
                    className={cn(
                      'absolute left-2 top-2 border-none text-[10px] font-bold',
                      meta.className,
                    )}
                  >
                    {meta.icon}
                    <span className="ml-1">{meta.label}</span>
                  </Badge>
                </div>

                <div className="space-y-2 p-3">
                  <div>
                    <p className="truncate text-sm font-bold">{title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(d.publishedAt || d.updatedAt || d.createdAt)}
                      {d.details?.productId || listingId ? ' · linked listing' : ''}
                    </p>
                  </div>

                  {d.status === 'failed' && d.error && (
                    <p className="rounded-lg bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
                      {d.error}
                    </p>
                  )}

                  {m && (
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {m.viewCount ?? 0} views
                      </span>
                      <span>{m.likes ?? 0} likes</span>
                      <span>{m.salesCount ?? 0} sales</span>
                    </div>
                  )}
                  {d.status === 'published' && !m && (
                    <p className="text-[11px] text-muted-foreground">
                      Listing metrics will appear once the video gets activity.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {d.status === 'published' && listingId ? (
                      <>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-8 border-border text-xs"
                        >
                          <Link href={`/products/${listingId}`}>View listing</Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs"
                          onClick={() => copyLink(listingId)}
                        >
                          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy link
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="h-8 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
                        onClick={() => onResume(d)}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        {d.status === 'failed' ? 'Retry' : 'Continue'}
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 ml-auto text-xs text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes the studio record and its saved edits. Any published
                            listing and its product stay exactly as they are — manage listings
                            from Inventory.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep it</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(d.id)}>
                            Delete video
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}