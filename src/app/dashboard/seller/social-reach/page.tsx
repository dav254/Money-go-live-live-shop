'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { useUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Share2,
  Link2,
  Unlink,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Send,
  Clock,
  Film,
  ShoppingBag,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Status {
  connected: boolean;
  needsReconnect: boolean;
  connectedAt: number | null;
  scopes: string[];
  hasPublishScope: boolean;
  publishing: { enabled: boolean; approvalGranted: boolean; reason: string };
  postCostPoints: number;
  pointsBalance: number;
}

interface ProductRow {
  id: string;
  name?: string;
  price?: number;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  videoUrls?: string[];
}

interface HistoryJob {
  id: string;
  status: string;
  productName?: string | null;
  caption?: string;
  pointsCharged: number;
  tiktokVideoId?: string | null;
  errorMessage?: string | null;
  createdAt: number;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  RESERVED: { label: 'Queued', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  SUBMITTING: { label: 'Submitting', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  PUBLISHED: { label: 'Published', className: 'bg-[#FE2C55]/15 text-[#FE2C55] border-[#FE2C55]/30' },
  FAILED: { label: 'Failed', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  REFUNDED: { label: 'Refunded', className: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30' },
  UNKNOWN: { label: 'Reconciling', className: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
};

export default function SocialReachPage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [status, setStatus] = useState<Status | null>(null);
  const [products, setProducts] = useState<ProductRow[] | null>(null);
  const [history, setHistory] = useState<HistoryJob[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  const [selectedId, setSelectedId] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const token = useCallback(() => user?.getIdToken() ?? Promise.resolve<string | null>(null), [user]);

  const api = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const t = await token();
      const res = await fetch(path, {
        ...init,
        headers: {
          Authorization: `Bearer ${t ?? ''}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers ?? {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      return { res, data };
    },
    [token],
  );

  const loadAll = useCallback(async () => {
    if (!user) return;
    try {
      const [statusRes, productsRes, historyRes] = await Promise.all([
        api('/api/social-reach/status'),
        api('/api/products/mine'),
        api('/api/social-reach/history'),
      ]);
      if (statusRes.res.ok) setStatus(statusRes.data as Status);
      setProducts((productsRes.data?.products ?? []) as ProductRow[]);
      if (historyRes.res.ok) setHistory((historyRes.data?.jobs ?? []) as HistoryJob[]);
    } catch {
      setNotice({ kind: 'err', text: 'Could not load Social Reach. Check your connection and refresh.' });
    } finally {
      setLoading(false);
    }
  }, [api, user]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // One-shot result banners from the OAuth redirect (?success=/?error=).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    if (success === 'tiktok_connected') {
      setNotice({ kind: 'ok', text: 'TikTok connected. Your account is ready for publishing.' });
      void loadAll();
    } else if (error) {
      const messages: Record<string, string> = {
        denied: 'You declined the TikTok authorization. Nothing was connected.',
        invalid_state: 'The TikTok connection session expired or was invalid. Please try connecting again.',
        invalid_token_response: 'TikTok returned an incomplete response. Nothing was saved — please retry.',
        exchange_failed: 'TikTok did not accept the connection. Please retry.',
        not_configured: 'TikTok is not configured on the server yet (missing TIKTOK_CLIENT_KEY / secret).',
        not_seller: 'Only business accounts can connect TikTok.',
      };
      setNotice({ kind: 'err', text: messages[error] ?? `TikTok connection failed (${error}).` });
    }
    if (success || error) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [loadAll]);

  const videoProducts = useMemo(
    () => (products ?? []).filter((p) => !!(p.videoUrl || (p.videoUrls ?? []).length)),
    [products],
  );
  const selected = useMemo(() => (products ?? []).find((p) => p.id === selectedId) ?? null, [products, selectedId]);
  const selectedHasVideo = !!(selected?.videoUrl || (selected?.videoUrls ?? []).length);
  const fullCaption = [caption.trim(), hashtags.replace(/\s+/g, ' ').trim()].filter(Boolean).join(' ').trim();

  const connectTikTok = async () => {
    setActionBusy(true);
    try {
      const { res, data } = await api('/api/tiktok/connect', { headers: { Accept: 'application/json' } });
      if (res.ok && data.authorizeUrl) {
        window.location.assign(String(data.authorizeUrl));
        return;
      }
      setNotice({ kind: 'err', text: 'Could not start the TikTok connection. Is the server configured?' });
    } catch {
      setNotice({ kind: 'err', text: 'Could not start the TikTok connection.' });
    } finally {
      setActionBusy(false);
    }
  };

  const disconnect = async () => {
    setActionBusy(true);
    try {
      const { res } = await api('/api/social-reach/status', { method: 'POST' });
      if (res.ok) {
        setNotice({ kind: 'info', text: 'TikTok disconnected. Your published posts stay on TikTok.' });
        setStatus((s) => (s ? { ...s, connected: false, needsReconnect: false, scopes: [] } : s));
      } else {
        setNotice({ kind: 'err', text: 'Could not disconnect right now.' });
      }
    } finally {
      setActionBusy(false);
    }
  };

  const publish = async () => {
    if (!selectedId || !fullCaption) {
      setNotice({ kind: 'err', text: 'Pick a video listing and write a caption first.' });
      return;
    }
    setPublishing(true);
    setNotice(null);
    try {
      const { res, data } = await api('/api/social-reach/post', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedId,
          caption: caption.trim(),
          hashtags: hashtags.trim(),
          // One key per attempt; the button is disabled while in flight, so a
          // double-tap can never create two charged jobs.
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const kind = res.ok ? 'ok' : 'err';
      setNotice({ kind, text: data.message ?? data.error ?? 'Unexpected response from the server.' });
      void loadAll();
      // TikTok processes asynchronously — refresh history as it settles.
      if (pollRef.current) clearTimeout(pollRef.current);
      pollRef.current = setTimeout(() => void loadAll(), 4000);
      if (res.ok) toast({ title: data.status === 'PUBLISHED' ? 'Published to TikTok' : 'Submission received', description: data.message });
    } catch {
      setNotice({ kind: 'err', text: 'Publishing request failed. You were not charged twice — check History.' });
    } finally {
      setPublishing(false);
      void loadAll();
    }
  };

  const gate = status?.publishing;
  const canPublish =
    !!gate?.enabled && !!status?.connected && !!status?.hasPublishScope && !!selectedHasVideo && fullCaption.length > 0 && !publishing;

  return (
    <SellerLayout>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#FE2C55] to-black shadow-lg shadow-[#FE2C55]/25">
                <Share2 className="h-4 w-4 text-white" />
              </span>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Social Reach</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect TikTok and publish your Vidnov listings to your audience — paid with AI points.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {status ? `${status.pointsBalance.toLocaleString()} points` : '—'}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                'gap-1.5 px-3 py-1.5 text-xs',
                status?.connected ? 'border-[#FE2C55]/40 text-[#FE2C55]' : 'text-muted-foreground',
              )}
            >
              {status?.connected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {status?.needsReconnect ? 'Reconnect needed' : status?.connected ? 'TikTok connected' : 'Not connected'}
            </Badge>
          </div>
        </div>

        {notice && (
          <div
            className={cn(
              'rounded-lg border px-4 py-3 text-sm',
              notice.kind === 'ok' && 'border-[#FE2C55]/30 bg-[#FE2C55]/10 text-foreground',
              notice.kind === 'err' && 'border-red-500/30 bg-red-500/10 text-red-200',
              notice.kind === 'info' && 'border-border bg-muted text-muted-foreground',
            )}
            role="alert"
          >
            {notice.text}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        ) : (
          <>
            {/* CONNECTION */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-[#FE2C55]" />
                    <CardTitle className="text-base">TikTok account</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    {!status?.connected ? (
                      <Button size="sm" onClick={connectTikTok} disabled={actionBusy} className="gap-2">
                        {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                        {status?.needsReconnect ? 'Reconnect TikTok' : 'Connect TikTok'}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={disconnect} disabled={actionBusy} className="gap-2">
                        <Unlink className="h-4 w-4" /> Disconnect
                      </Button>
                    )}
                  </div>
                </div>
                <CardDescription>
                  {status?.connected
                    ? `Connected${status.connectedAt ? ` since ${new Date(status.connectedAt).toLocaleDateString()}` : ''}. Vidnov can publish videos to this account only after you press Publish.`
                    : 'Connecting authorizes Vidnov to publish short videos to YOUR TikTok account. We never post without your explicit action, and we never see or store your TikTok password.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(status?.scopes?.length ? status.scopes : ['video.publish']).map((s) => (
                    <Badge key={s} variant="secondary" className="font-mono text-[11px]">
                      {s}
                    </Badge>
                  ))}
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                  <ShieldCheck className="mb-1 h-3.5 w-3.5 text-primary" />
                  <strong className="text-foreground">What publishing does:</strong> Vidnov uploads the selected video to
                  TikTok on your behalf with your caption, using the official Content Posting API. The post is public to
                  everyone. Tokens are stored server-only; they are never shown in your browser.
                </div>
                {!gate?.enabled && gate && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    {gate.reason}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* COMPOSER */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Film className="h-4 w-4 text-[#FE2C55]" /> Create post
                  </CardTitle>
                  <CardDescription>Pick one of your listings that has a video, then write the caption.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Product selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Your listings {products && products.length > 0 && `(${videoProducts.length} with video)`}
                    </label>
                    {products === null ? (
                      <Skeleton className="h-20 w-full" />
                    ) : products.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                        <ShoppingBag className="mx-auto mb-2 h-5 w-5" />
                        You have no listings yet. Add a product first — Social Reach publishes your listing videos.
                        <div className="mt-3">
                          <Button size="sm" variant="outline" asChild>
                            <a href="/dashboard/products">Add a listing</a>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                        {products.map((p) => {
                          const hasVideo = !!(p.videoUrl || (p.videoUrls ?? []).length);
                          const active = p.id === selectedId;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setSelectedId(p.id)}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition',
                                active ? 'border-[#FE2C55] bg-[#FE2C55]/10' : 'border-border/60 hover:border-border',
                                !hasVideo && 'opacity-50',
                              )}
                            >
                              {p.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.imageUrl} alt="" className="h-9 w-9 rounded-md object-cover" />
                              ) : (
                                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                                  <Film className="h-4 w-4 text-muted-foreground" />
                                </span>
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{p.name || 'Untitled'}</span>
                                <span className="block text-[11px] text-muted-foreground">
                                  {hasVideo ? 'Video ready' : 'No video yet — cannot post to TikTok'}
                                </span>
                              </span>
                              {typeof p.price === 'number' && (
                                <span className="shrink-0 text-xs font-semibold text-primary">
                                  KES {p.price.toLocaleString()}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Caption */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Caption</label>
                      <span
                        className={cn(
                          'text-[11px] tabular-nums',
                          fullCaption.length > 2200 ? 'text-red-400' : 'text-muted-foreground',
                        )}
                      >
                        {fullCaption.length}/2200
                      </span>
                    </div>
                    <Textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Tell buyers what makes this listing special…"
                      rows={4}
                      className="resize-none"
                    />
                    <Textarea
                      value={hashtags}
                      onChange={(e) => setHashtags(e.target.value)}
                      placeholder="#vidnov #shopping #deals"
                      rows={1}
                      className="resize-none text-sm"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* PREVIEW + PUBLISH */}
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Send className="h-4 w-4 text-[#FE2C55]" /> Preview & publish
                  </CardTitle>
                  <CardDescription>This is exactly what will be posted to your TikTok.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
                    {selected?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selected.imageUrl} alt="" className="h-24 w-20 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-24 w-20 items-center justify-center rounded-lg bg-muted">
                        <Film className="h-6 w-6 text-muted-foreground" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-semibold">{selected?.name || 'No listing selected'}</p>
                      {typeof selected?.price === 'number' && (
                        <p className="text-sm font-bold text-primary">KES {selected.price.toLocaleString()}</p>
                      )}
                      <p className="line-clamp-4 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                        {fullCaption || 'Your caption will appear here.'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/60 p-3 text-xs">
                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-muted-foreground">Account</span>
                      <span className="font-semibold">{status?.connected ? 'Your TikTok (@connected)' : 'Not connected'}</span>
                    </div>
                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-muted-foreground">Cost per successful post</span>
                      <span className="font-semibold">{status?.postCostPoints ?? 50} points</span>
                    </div>
                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-muted-foreground">Your balance</span>
                      <span className="font-semibold">{(status?.pointsBalance ?? 0).toLocaleString()} points</span>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                      You are charged only when TikTok confirms the post is live. Rejected posts are refunded
                      automatically — never twice, never zero times.
                    </p>
                  </div>

                  <Button className="w-full gap-2" onClick={publish} disabled={!canPublish}>
                    {publishing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Publishing…
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" /> Publish for {status?.postCostPoints ?? 50} points
                      </>
                    )}
                  </Button>
                  {!gate?.enabled && gate && (
                    <p className="text-center text-[11px] text-amber-300">{gate.reason}</p>
                  )}
                  {gate?.enabled && !status?.connected && (
                    <p className="text-center text-[11px] text-muted-foreground">Connect your TikTok account to publish.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* HISTORY */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-[#FE2C55]" /> Publishing history
                </CardTitle>
                <CardDescription>Every submission and its settled outcome — including refunds.</CardDescription>
              </CardHeader>
              <CardContent>
                {history === null ? (
                  <Skeleton className="h-24 w-full" />
                ) : history.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    Nothing published yet. Your posts — pending, published, failed and refunded — will appear here.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((job) => {
                      const style = STATUS_STYLES[job.status] ?? { label: job.status, className: '' };
                      return (
                        <div
                          key={job.id}
                          className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                        >
                          <Badge variant="outline" className={cn('shrink-0 text-[11px]', style.className)}>
                            {style.label}
                          </Badge>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {job.productName || 'Listing'}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {new Date(job.createdAt).toLocaleString()}
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-primary">{job.pointsCharged} pts</span>
                          {job.status === 'FAILED' && job.errorMessage && (
                            <span className="w-full truncate text-[11px] text-red-400">{job.errorMessage}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </SellerLayout>
  );
}