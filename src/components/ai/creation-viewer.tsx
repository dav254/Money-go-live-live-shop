'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Bookmark,
  BookmarkCheck,
  Download,
  Link2,
  Package,
  MessagesSquare,
  Play,
  Share2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { AiJobView } from './generation-history';

/**
 * AI CREATION VIEWER (spec §10).
 *
 * Opens a finished creation full-screen: video player or image, the
 * generation metadata, and the actions that connect the creation back to the
 * marketplace — Save, Share, Download, Use in Product / Request.
 */

const TYPE_LABEL: Record<string, string> = {
  'text-to-image': 'Text → Image',
  'image-to-image': 'Image → Image',
  'text-to-video': 'Text → Video',
  'image-to-video': 'Image → Video',
  'image-animation': 'Animate Image',
};

interface Destination {
  target: 'product' | 'request';
  id: string;
  label: string;
}

interface AiCreationViewerProps {
  job: AiJobView | null;
  onOpenChange: (open: boolean) => void;
  /** Called after save/attach so the caller can refresh its job list. */
  onChanged?: () => void;
}

export function AiCreationViewer({ job, onOpenChange, onChanged }: AiCreationViewerProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [attachTarget, setAttachTarget] = React.useState<'product' | 'request' | null>(null);

  // Marketplace destinations this creation can be attached to.
  const productsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [user, firestore]);
  const requestsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'requests'), where('userId', '==', user.uid));
  }, [user, firestore]);
  const { data: products } = useCollection<{ productName?: string; name?: string }>(productsQuery);
  const { data: requests } = useCollection<{ title?: string }>(requestsQuery);

  const destinations: Destination[] = React.useMemo(() => {
    if (attachTarget === 'product') {
      return (products ?? []).map((p) => ({ target: 'product' as const, id: p.id, label: p.productName || p.name || 'Untitled product' }));
    }
    if (attachTarget === 'request') {
      return (requests ?? []).map((r) => ({ target: 'request' as const, id: r.id, label: r.title || 'Untitled request' }));
    }
    return [];
  }, [attachTarget, products, requests]);

  const authHeaders = React.useCallback(async () => {
    const token = await user?.getIdToken();
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : undefined;
  }, [user]);

  const post = React.useCallback(
    async (body: Record<string, unknown>, successMessage: string) => {
      const headers = await authHeaders();
      if (!headers) return;
      setBusy(true);
      try {
        const res = await fetch('/api/ai/attach', { method: 'POST', headers, body: JSON.stringify(body) });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || 'Could not save the change.');
        toast({ title: 'Saved', description: successMessage });
        onChanged?.();
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Something went wrong.',
          variant: 'destructive',
        });
      } finally {
        setBusy(false);
      }
    },
    [authHeaders, onChanged, toast],
  );

  if (!job) return null;

  const isVideo = !['text-to-image', 'image-to-image'].includes(job.type);
  const createdAt = (() => {
    const ts = job.createdAt as { toDate?: () => Date } | null | undefined;
    const d = typeof ts?.toDate === 'function' ? ts.toDate() : null;
    return d ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  })();
  const attachments = job.attachments ?? [];

  const share = async () => {
    const url = job.outputUrl ?? window.location.href;
    if (navigator.share) {
      await navigator.share({ title: TYPE_LABEL[job.type] ?? 'AI creation', text: job.prompt ?? '', url }).catch(() => undefined);
    } else {
      await navigator.clipboard?.writeText(url);
      toast({ title: 'Link copied', description: 'Share this creation anywhere.' });
    }
  };

  return (
    <Dialog open={!!job} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,64rem)] overflow-y-auto border-white/10 bg-[#0b1020] text-white">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3 font-grotesk text-lg font-black uppercase tracking-wide">
            {TYPE_LABEL[job.type] ?? job.type}
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold tracking-widest text-white/60">
              {job.engine ?? job.model ?? 'AI'}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          {job.outputUrl ? (
            isVideo ? (
              <video src={job.outputUrl} controls playsInline className="max-h-[52vh] w-full bg-black object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={job.outputUrl} alt={job.prompt ?? 'AI creation'} className="max-h-[52vh] w-full object-contain" />
            )
          ) : (
            <p className="p-10 text-center text-sm text-white/50">This creation has no preview available.</p>
          )}
        </div>

        {job.prompt && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Prompt</p>
            <p className="mt-1.5 text-sm text-white/80">{job.prompt}</p>
          </div>
        )}

        <div className="grid gap-3 text-xs text-white/50 sm:grid-cols-3">
          <p>Model: {job.model ?? job.engine ?? '—'}</p>
          <p>Created: {createdAt}</p>
          <p>Processing: {job.processingMs ? `${Math.max(1, Math.round(job.processingMs / 1000))}s` : '—'}</p>
        </div>

        {attachments.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Used in</p>
            <div className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <span key={`${a.target}-${a.targetId}`} className="rounded-full border border-white/12 px-3 py-1 text-[11px] text-white/70">
                  {a.label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="outline"
            className="border-white/15 text-white hover:bg-white/10"
            disabled={busy}
            onClick={() => post({ jobId: job.id, saved: !job.saved }, job.saved ? 'Removed from saved.' : 'Saved to My Creations.')}
          >
            {job.saved ? <BookmarkCheck className="mr-2 h-4 w-4" /> : <Bookmark className="mr-2 h-4 w-4" />}
            {job.saved ? 'Saved' : 'Save'}
          </Button>
          {job.outputUrl && (
            <Button asChild variant="outline" className="border-white/15 text-white hover:bg-white/10">
              <a href={job.outputUrl} download target="_blank" rel="noreferrer">
                <Download className="mr-2 h-4 w-4" /> Download
              </a>
            </Button>
          )}
          <Button variant="outline" className="border-white/15 text-white hover:bg-white/10" onClick={share}>
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
          <Button variant="outline" className="border-white/15 text-white hover:bg-white/10" onClick={() => setAttachTarget('product')}>
            <Package className="mr-2 h-4 w-4" /> Use in Product
          </Button>
          <Button variant="outline" className="border-white/15 text-white hover:bg-white/10" onClick={() => setAttachTarget('request')}>
            <MessagesSquare className="mr-2 h-4 w-4" /> Use in Request
          </Button>
        </div>

        {attachTarget && (
          <div className="space-y-2 rounded-2xl border border-white/12 bg-white/[0.04] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
              Choose a {attachTarget}
            </p>
            {destinations.length === 0 ? (
              <p className="text-sm text-white/50">
                You have no {attachTarget}s yet — create one first, then come back.
              </p>
            ) : (
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                {destinations.map((d) => (
                  <Button
                    key={d.id}
                    size="sm"
                    variant="outline"
                    className={cn('border-white/15 text-white hover:bg-white/10')}
                    disabled={busy}
                    onClick={() =>
                      post({ jobId: job.id, target: d.target, targetId: d.id, label: d.label }, `Attached to ${d.label}.`)
                    }
                  >
                    <Play className="mr-1.5 h-3 w-3" /> {d.label}
                  </Button>
                ))}
              </div>
            )}
            <Button variant="ghost" size="sm" className="text-white/60" onClick={() => setAttachTarget(null)}>
              Close
            </Button>
          </div>
        )}

        <p className="flex items-center gap-2 text-[11px] text-white/35">
          <Link2 className="h-3 w-3" /> Files live in your Vidnov Media library — nothing is stored separately.
        </p>
      </DialogContent>
    </Dialog>
  );
}