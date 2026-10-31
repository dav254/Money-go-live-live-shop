'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AtSign,
  CalendarClock,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Hash,
  Mail,
  MessageCircle,
  Newspaper,
  PenLine,
  Pin,
  RefreshCw,
  Send,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';

/**
 * Admin · Growth Posts — the approval queue for the nightly draft engine.
 *
 * A thin consumer of `/api/admin/growth-posts`: this page NEVER invents a
 * status. It renders exactly what the API returns — the drafted caption, the
 * real product facts behind it, the tracked share path, and the provider
 * status derived from env presence. Publishing is offered for every channel
 * the API accepts (`copy`, `email`, and the four free social networks from
 * Phase 2A); each social button only claims success when the platform's own
 * response carried a message id.
 */

type PostStatus = 'draft' | 'approved' | 'rejected' | 'copied' | 'emailed' | 'published' | 'failed';

interface GrowthResult {
  state: 'published' | 'dev_captured' | 'copied' | 'failed';
  remoteId?: string;
  at: string;
  note?: string;
}

interface GrowthPost {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  price?: number;
  currency?: string;
  caption: string;
  hashtags: string[];
  sharePath: string;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
  draftedBy: string;
  decidedBy?: string;
  emailStatus?: string;
  reason?: string;
  publishChannel?: string;
  publishedAt?: string;
  results?: Record<string, GrowthResult>;
  /** Pending scheduler action — present only while a schedule is armed. */
  scheduledAt?: string;
  scheduledChannels?: string[];
}

interface ProviderStatus {
  id: string;
  label: string;
  status: 'configured' | 'not_configured';
  requiredEnvVars: string[];
  note: string;
}

type Counts = Record<PostStatus, number>;

interface DraftReport {
  scanned: number;
  drafted: number;
  failed: number;
  skippedCooldown: number;
  limit: number;
  dailyBudgetRemaining: number;
}

const STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
  copied: 'Copied by admin',
  emailed: 'Emailed to seller',
  published: 'Published',
  failed: 'Failed',
};

const STATUS_STYLES: Record<PostStatus, string> = {
  draft: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  approved: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300',
  rejected: 'border-white/15 bg-white/5 text-neutral-400',
  copied: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  emailed: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  published: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  failed: 'border-red-500/40 bg-red-500/10 text-red-400',
};

/**
 * The free social networks wired into the queue: the four Phase 2A channels
 * plus Pinterest and Reddit (Phase 2C). Each flips to `configured` only when
 * its own credential names are present in the environment — the selector
 * never claims a channel it cannot reach.
 */
const SOCIAL_CHANNELS: Array<{
  id: 'bluesky' | 'mastodon' | 'telegram' | 'discord' | 'pinterest' | 'reddit';
  label: string;
  icon: typeof Send;
}> = [
  { id: 'bluesky', label: 'Bluesky', icon: AtSign },
  { id: 'mastodon', label: 'Mastodon', icon: Hash },
  { id: 'telegram', label: 'Telegram', icon: Send },
  { id: 'discord', label: 'Discord', icon: MessageCircle },
  { id: 'pinterest', label: 'Pinterest', icon: Pin },
  { id: 'reddit', label: 'Reddit', icon: Newspaper },
];

/** Local `datetime-local` value (YYYY-MM-DDTHH:mm), one hour from now. */
function defaultAtLocal(): string {
  const d = new Date(Date.now() + 3_600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const FILTERS: Array<{ id: 'all' | PostStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Awaiting approval' },
  { id: 'approved', label: 'Approved' },
  { id: 'copied', label: 'Copied' },
  { id: 'emailed', label: 'Emailed' },
  { id: 'published', label: 'Published' },
  { id: 'failed', label: 'Failed' },
];

export default function AdminGrowthPostsPage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [posts, setPosts] = useState<GrowthPost[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [filter, setFilter] = useState<'all' | PostStatus>('all');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [runningDraft, setRunningDraft] = useState(false);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await user!.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch('/api/admin/growth-posts', { headers: await authHeaders() });
      if (!res.ok) throw new Error('bad status');
      const data = (await res.json()) as {
        posts: GrowthPost[];
        counts: Counts;
        providers: Record<string, ProviderStatus>;
      };
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setCounts(data.counts ?? null);
      setProviders(Object.values(data.providers ?? {}));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [user, authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = useCallback(
    async (
      body: Record<string, unknown>,
      busyKey: string | null,
    ): Promise<{
      ok: boolean;
      data: { error?: string; result?: { outcome?: string; message?: string } };
    }> => {
      if (!user) return { ok: false, data: {} };
      setBusyId(busyKey);
      try {
        const res = await fetch('/api/admin/growth-posts', {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          result?: { outcome?: string; message?: string };
        };
        if (!res.ok) {
          toast({ variant: 'destructive', title: 'Could not complete', description: data.error || 'Try again.' });
          return { ok: false, data };
        }
        return { ok: true, data };
      } catch {
        toast({ variant: 'destructive', title: 'Network error', description: 'The action did not go through.' });
        return { ok: false, data: {} };
      } finally {
        setBusyId(null);
      }
    },
    [user, authHeaders, toast],
  );

  const runDraftJob = useCallback(async () => {
    setRunningDraft(true);
    const res = await post({ action: 'draft' }, 'draft');
    if (res.ok) {
      toast({ title: 'Draft run finished', description: 'Refresh shows the new drafts in the queue.' });
      await load();
    }
    setRunningDraft(false);
  }, [post, load, toast]);

  const decide = useCallback(
    async (id: string, decision: 'approve' | 'reject') => {
      const res = await post({ action: 'decide', id, decision }, id);
      if (res.ok) {
        toast({ title: decision === 'approve' ? 'Post approved' : 'Post rejected' });
        await load();
      }
    },
    [post, load, toast],
  );

  const fullText = useCallback(
    (p: GrowthPost): string => {
      const tags = (p.hashtags ?? []).map((t) => `#${t}`).join(' ');
      const url = typeof window !== 'undefined' ? `${window.location.origin}${p.sharePath}` : p.sharePath;
      return [p.caption, tags, url].filter(Boolean).join('\n\n');
    },
    [],
  );

  const publishCopy = useCallback(
    async (p: GrowthPost) => {
      let copied = false;
      try {
        await navigator.clipboard.writeText(fullText(p));
        copied = true;
      } catch {
        copied = false;
      }
      const res = await post({ action: 'publish', id: p.id, channel: 'copy' }, p.id);
      if (res.ok) {
        toast({
          title: copied ? 'Post copied' : 'Marked as copied',
          description: copied
            ? 'Paste it into the network yourself — nothing was published automatically.'
            : 'Clipboard was blocked by the browser — select the text manually.',
        });
        await load();
      }
    },
    [post, fullText, load, toast],
  );

  const publishEmail = useCallback(
    async (p: GrowthPost) => {
      const res = await post({ action: 'publish', id: p.id, channel: 'email' }, p.id);
      if (res.ok && res.data.result?.outcome !== 'failed') {
        toast({ title: 'Sent to the seller', description: 'Delivery is recorded per message in the email log.' });
      } else if (res.ok) {
        toast({
          variant: 'destructive',
          title: 'Email failed',
          description: res.data.result?.message || 'The provider rejected the message.',
        });
      }
      await load();
    },
    [post, load, toast],
  );

  const publishTo = useCallback(
    async (p: GrowthPost, channel: (typeof SOCIAL_CHANNELS)[number]['id']) => {
      const label = SOCIAL_CHANNELS.find((c) => c.id === channel)?.label ?? channel;
      const res = await post({ action: 'publish', id: p.id, channel }, p.id);
      if (res.ok && res.data.result?.outcome === 'published') {
        toast({
          title: `Published to ${label}`,
          description: 'Confirmed by the platform’s own message id and attributed with ?ch=',
        });
      } else if (res.ok) {
        toast({
          variant: 'destructive',
          title: `${label} publish failed`,
          description: res.data.result?.message || 'The platform rejected the post.',
        });
      }
      await load();
    },
    [post, load, toast],
  );

  const visible = useMemo(
    () => (filter === 'all' ? posts : posts.filter((p) => p.status === filter)),
    [posts, filter],
  );

  /* ── Composer: write your own post about a real listing ─────────────── */
  const [composing, setComposing] = useState(false);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [productFilter, setProductFilter] = useState('');
  const [composeProductId, setComposeProductId] = useState('');
  const [composeCaption, setComposeCaption] = useState('');
  const [composeTags, setComposeTags] = useState('');

  const openComposer = useCallback(async () => {
    setComposing(true);
    if (products.length > 0) return;
    try {
      const res = await fetch('/api/admin/products/list', { headers: await authHeaders() });
      const data = (await res.json().catch(() => ({}))) as { products?: Array<{ id: string; name?: string }> };
      setProducts(
        (data.products ?? [])
          .filter((p) => p && typeof p.id === 'string' && p.id)
          .map((p) => ({ id: p.id, name: p.name || p.id })),
      );
    } catch {
      // Keep the form open — the admin can retry by re-opening it.
    }
  }, [authHeaders, products.length]);

  const submitCompose = useCallback(async () => {
    if (!composeProductId || !composeCaption.trim()) {
      toast({ variant: 'destructive', title: 'Pick a product and write the post copy.' });
      return;
    }
    const hashtags = composeTags.split(/[,\s]+/).map((t) => t.replace(/^#/, '').trim()).filter(Boolean);
    const res = await post(
      { action: 'compose', productId: composeProductId, caption: composeCaption, hashtags },
      'compose',
    );
    if (res.ok) {
      toast({ title: 'Post composed', description: 'It is approved — publish it now or schedule it.' });
      setComposing(false);
      setComposeProductId('');
      setComposeCaption('');
      setComposeTags('');
      setProductFilter('');
      await load();
    }
  }, [composeProductId, composeCaption, composeTags, post, load, toast]);

  /* ── Scheduling: arm / cancel the pending action the tick spends ────── */
  const [schedDraft, setSchedDraft] = useState<Record<string, { at: string; channels: string[] }>>({});

  const toggleSchedChannel = useCallback((id: string, channel: string) => {
    setSchedDraft((prev) => {
      const cur = prev[id] ?? { at: defaultAtLocal(), channels: [] as string[] };
      const channels = cur.channels.includes(channel)
        ? cur.channels.filter((c) => c !== channel)
        : [...cur.channels, channel];
      return { ...prev, [id]: { ...cur, channels } };
    });
  }, []);

  const submitSchedule = useCallback(
    async (p: GrowthPost) => {
      const draft = schedDraft[p.id];
      if (!draft?.at || draft.channels.length === 0) {
        toast({ variant: 'destructive', title: 'Pick a time and at least one channel.' });
        return;
      }
      const res = await post(
        { action: 'schedule', id: p.id, channels: draft.channels, at: new Date(draft.at).toISOString() },
        p.id,
      );
      if (res.ok) {
        toast({
          title: 'Scheduled',
          description: `Publishes ${new Date(draft.at).toLocaleString()} — the scheduler tick handles it, and nothing runs before then.`,
        });
        setSchedDraft((prev) => {
          const next = { ...prev };
          delete next[p.id];
          return next;
        });
        await load();
      }
    },
    [schedDraft, post, load, toast],
  );

  const cancelSchedule = useCallback(
    async (p: GrowthPost) => {
      const res = await post({ action: 'unschedule', id: p.id }, p.id);
      if (res.ok) {
        toast({ title: 'Schedule cancelled', description: 'Nothing will publish automatically.' });
        await load();
      }
    },
    [post, load, toast],
  );

  return (
    <AdminLayout>
      <div className="container mx-auto max-w-5xl space-y-6 py-6">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden />
              Growth Posts
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              The nightly engine drafts ready-to-post copy for your best-performing products from real
              metrics — or compose your own. Every draft waits here for approval; approved posts can be
              copied, emailed to the seller, published to the four free social channels right away, or
              scheduled for later. Every publish is confirmed by the platform’s own message id or
              reported as an honest failure.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => void runDraftJob()} disabled={runningDraft}>
              {runningDraft ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Run draft job
            </Button>
          </div>
        </div>

        {/* ── Provider status (env presence only) ────────────────── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {providers.map((p) => (
            <Card key={p.id} className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-black uppercase tracking-widest">
                  {p.label}
                </CardDescription>
                <CardTitle className="text-sm">
                  <Badge
                    variant={p.status === 'configured' ? 'default' : 'secondary'}
                    className="rounded-full"
                  >
                    {p.status === 'configured' ? 'Configured' : 'Not configured'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] leading-relaxed text-muted-foreground">
                {p.note}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Composer: an admin-written post about a real listing ── */}
        {!composing ? (
          <Button variant="outline" size="sm" onClick={() => void openComposer()}>
            <PenLine className="mr-2 h-4 w-4" /> Compose a post
          </Button>
        ) : (
          <Card className="rounded-2xl border-primary/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Compose a post about a real listing</CardTitle>
              <CardDescription>
                Written by you and saved straight to approved — it passes the same listing gate as the
                drafter (visible, priced, pictured), and can be published or scheduled like any other post.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                placeholder="Filter products…"
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              />
              <select
                value={composeProductId}
                onChange={(e) => setComposeProductId(e.target.value)}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              >
                <option value="">Select a product…</option>
                {products
                  .filter((p) =>
                    p.name.toLowerCase().includes(productFilter.trim().toLowerCase()),
                  )
                  .slice(0, 200)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <textarea
                value={composeCaption}
                onChange={(e) => setComposeCaption(e.target.value)}
                rows={4}
                placeholder="Write the post copy…"
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              />
              <input
                value={composeTags}
                onChange={(e) => setComposeTags(e.target.value)}
                placeholder="hashtags, separated by commas (without #)"
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void submitCompose()} disabled={busyId === 'compose'}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Save as approved
                </Button>
                <Button size="sm" variant="outline" onClick={() => setComposing(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Counts + filters ───────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => {
            const badgeValue = f.id === 'all' ? posts.length : (counts?.[f.id] ?? 0);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition',
                  filter === f.id
                    ? 'border-primary bg-primary text-white'
                    : 'border-white/10 bg-white/5 text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
                <span className="ml-1.5 tabular-nums opacity-70">{badgeValue}</span>
              </button>
            );
          })}
          {counts && (
            <span className="ml-auto text-[11px] text-muted-foreground">
              {counts.draft} awaiting · {counts.approved} approved
            </span>
          )}
        </div>

        {/* ── Queue ──────────────────────────────────────────────── */}
        {loading ? (
          <Card className="rounded-2xl">
            <CardContent className="flex items-center justify-center gap-3 py-14 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading the queue…
            </CardContent>
          </Card>
        ) : failed ? (
          <Card className="rounded-2xl border-destructive/40">
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <XCircle className="h-6 w-6 text-destructive" aria-hidden />
              <p className="text-sm font-semibold">The growth post queue could not be loaded.</p>
              <Button variant="outline" size="sm" onClick={() => void load()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : visible.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <Sparkles className="h-6 w-6 text-muted-foreground" aria-hidden />
              <p className="text-sm font-semibold">
                {filter === 'all' ? 'No drafts yet.' : `Nothing with this status.`}
              </p>
              <p className="max-w-md text-xs text-muted-foreground">
                {filter === 'all'
                  ? 'Run the draft job to have the engine prepare posts from your top-performing products. It is bounded: 3 per run, 12 per day, and no product repeats within 14 days.'
                  : 'Switch back to “All” to see the whole queue.'}
              </p>
              {filter === 'all' && (
                <Button size="sm" onClick={() => void runDraftJob()} disabled={runningDraft}>
                  <Sparkles className="mr-2 h-4 w-4" /> Run draft job
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {visible.map((p) => (
              <Card key={p.id} className="rounded-2xl">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- seller media URL */}
                    <img
                      src={p.productImage || getPlaceholderImage()}
                      alt={p.productName}
                      className="h-16 w-16 shrink-0 rounded-xl border object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base">{p.productName}</CardTitle>
                      <CardDescription className="mt-0.5 flex flex-wrap items-center gap-2">
                        {typeof p.price === 'number' && (
                          <span className="font-semibold text-foreground">
                            {p.currency || 'USD'} {p.price.toLocaleString()}
                          </span>
                        )}
                        <span className="text-xs">
                          {new Date(p.createdAt).toLocaleString()}
                        </span>
                        <span className="text-xs">by {p.draftedBy}</span>
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0 rounded-full', STATUS_STYLES[p.status])}>
                      {STATUS_LABELS[p.status]}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="rounded-xl border bg-white/[0.03] p-4">
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{p.caption}</p>
                    {p.hashtags.length > 0 && (
                      <p className="mt-2 flex flex-wrap gap-1.5">
                        {p.hashtags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                          >
                            #{tag}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <a
                      href={p.sharePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border px-2 py-1 font-mono text-[11px] transition hover:border-primary hover:text-primary"
                    >
                      {p.sharePath}
                    </a>
                    {p.emailStatus && (
                      <span className="rounded-md border px-2 py-1">
                        email: {p.emailStatus}
                        {p.emailStatus === 'dev_captured' ? ' (not delivered)' : ''}
                      </span>
                    )}
                    {p.reason && <span className="truncate">{p.reason}</span>}
                  </div>

                  {/* Per-channel outcomes — the platform's own ids, or the honest failure note. */}
                  {p.results && Object.keys(p.results).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(p.results).map(([channel, r]) => (
                        <span
                          key={channel}
                          title={r.note ?? ''}
                          className={cn(
                            'rounded-md border px-2 py-1 text-[11px] font-semibold',
                            r.state === 'published'
                              ? 'border-emerald-400/40 text-emerald-300'
                              : 'border-red-500/40 text-red-400',
                          )}
                        >
                          {channel}: {r.state}
                          {r.remoteId ? ` \u00b7 ${r.remoteId}` : ''}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {p.status === 'draft' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => void decide(p.id, 'approve')}
                          disabled={busyId === p.id}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void decide(p.id, 'reject')}
                          disabled={busyId === p.id}
                        >
                          <XCircle className="mr-2 h-4 w-4" /> Reject
                        </Button>
                      </>
                    )}
                    {p.status === 'approved' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void publishCopy(p)}
                          disabled={busyId === p.id}
                        >
                          <ClipboardCopy className="mr-2 h-4 w-4" /> Copy post
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void publishEmail(p)}
                          disabled={busyId === p.id}
                          title="Emails this ready-made post to the product's seller"
                        >
                          <Mail className="mr-2 h-4 w-4" /> Email seller
                        </Button>
                        {SOCIAL_CHANNELS.map((ch) => {
                          const configured =
                            providers.find((prov) => prov.id === ch.id)?.status === 'configured';
                          const prior = p.results?.[ch.id];
                          return (
                            <Button
                              key={ch.id}
                              size="sm"
                              onClick={() => void publishTo(p, ch.id)}
                              disabled={busyId === p.id}
                              title={
                                configured
                                  ? prior?.remoteId
                                    ? `Last post id: ${prior.remoteId}`
                                    : `Publishes via ${ch.label}\u2019s API and records its message id.`
                                  : `Not configured \u2014 requires ${ch.id.toUpperCase()} credentials in the environment.`
                              }
                              className={configured ? '' : 'opacity-60'}
                            >
                              <ch.icon className="mr-2 h-4 w-4" /> {ch.label}
                            </Button>
                          );
                        })}
                      </>
                    )}
                    {p.status === 'published' && (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Published
                        {p.publishChannel ? ` on ${p.publishChannel}` : ''} — confirmed by the
                        platform's own message id.
                      </span>
                    )}
                    {p.status === 'copied' && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ClipboardCopy className="h-3.5 w-3.5" /> Copied — share it on your channels.
                      </span>
                    )}
                    {p.status === 'emailed' && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" /> Sent to the seller to share.
                      </span>
                    )}
                    {p.status === 'failed' && (
                      <span className="flex items-center gap-1.5 text-xs text-red-400">
                        <XCircle className="h-3.5 w-3.5" /> Publishing failed — see the note above.
                      </span>
                    )}
                    {p.status === 'rejected' && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5" /> Rejected — it will not be used.
                      </span>
                    )}
                  </div>

                  {/* Scheduling — a pending action on the side, never a status. */}
                  {p.status !== 'draft' && p.status !== 'rejected' && (
                    <div className="rounded-xl border border-dashed p-3">
                      {p.scheduledAt ? (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <CalendarClock className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
                          <span className="font-semibold text-cyan-200">
                            Scheduled for {new Date(p.scheduledAt).toLocaleString()}
                          </span>
                          <span className="text-muted-foreground">
                            → {(p.scheduledChannels ?? []).join(', ') || 'no channels' }
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void cancelSchedule(p)}
                            disabled={busyId === p.id}
                          >
                            Cancel schedule
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            Schedule
                          </span>
                          <input
                            type="datetime-local"
                            value={schedDraft[p.id]?.at ?? ''}
                            onFocus={() => {
                              setSchedDraft((prev) =>
                                prev[p.id]
                                  ? prev
                                  : { ...prev, [p.id]: { at: defaultAtLocal(), channels: ['bluesky'] } },
                              );
                            }}
                            onChange={(e) =>
                              setSchedDraft((prev) => ({
                                ...prev,
                                [p.id]: {
                                  at: e.target.value,
                                  channels: prev[p.id]?.channels ?? ['bluesky'],
                                },
                              }))
                            }
                            className="rounded-md border bg-transparent px-2 py-1.5 text-xs"
                          />
                          {SOCIAL_CHANNELS.map((ch) => {
                            const configured =
                              providers.find((prov) => prov.id === ch.id)?.status === 'configured';
                            const selected = (schedDraft[p.id]?.channels ?? []).includes(ch.id);
                            return (
                              <button
                                key={ch.id}
                                type="button"
                                onClick={() => toggleSchedChannel(p.id, ch.id)}
                                title={
                                  configured
                                    ? `Publishes via ${ch.label}’s API at the scheduled time.`
                                    : `Not configured — requires ${ch.id.toUpperCase()} credentials in the environment.`
                                }
                                className={cn(
                                  'rounded-full border px-2.5 py-1 text-[11px] font-bold transition',
                                  selected
                                    ? 'border-primary bg-primary text-white'
                                    : 'border-white/10 bg-white/5 text-muted-foreground hover:text-foreground',
                                  !configured && 'opacity-60',
                                )}
                              >
                                {ch.label}
                              </button>
                            );
                          })}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void submitSchedule(p)}
                            disabled={busyId === p.id}
                          >
                            <CalendarClock className="mr-2 h-4 w-4" /> Set schedule
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Cadence note ───────────────────────────────────────── */}
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Nightly runs are opt-in: set <code className="font-mono">VIDNOV_CRON_ENABLED</code>,{' '}
          <code className="font-mono">GROWTH_POSTS_CRON_ENABLED</code> and{' '}
          <code className="font-mono">CRON_SECRET</code>, then hit{' '}
          <code className="font-mono">/api/growth-posts/cron</code> from your scheduler. Scheduled posts
          are spent by the same three gates plus{' '}
          <code className="font-mono">GROWTH_POSTS_SCHEDULER_ENABLED</code> on{' '}
          <code className="font-mono">/api/growth-posts/scheduler</code> — until both are enabled,
          “Run draft job” and the publish buttons above do the same work on demand.
        </p>
      </div>
    </AdminLayout>
  );
}
