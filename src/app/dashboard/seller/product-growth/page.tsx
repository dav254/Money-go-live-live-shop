'use client';

/**
 * SELLER · PRODUCT GROWTH CENTRE (`/dashboard/seller/product-growth`).
 *
 * One screen, three questions:
 *   1. WHICH listings do I put in front of people? (selection, eligibility)
 *   2. HOW? Free distribution through the Core Engine, or a points-priced boost
 *      an administrator reviews. (both are real; neither promises reach)
 *   3. WHAT HAPPENED? (job states per destination, boost states per request)
 *
 * Everything on this page comes from `/api/seller/product-growth`, which reads
 * the existing engine. The page never invents a number: a destination that has
 * no credentials is rendered as unavailable (with the toggle disabled), a job's
 * `ready` state is never labelled "published", and the paid section shows the
 * points balance the server actually holds.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  Compass,
  Globe2,
  Loader2,
  Megaphone,
  Radar,
  Send,
  Share2,
  ShoppingBag,
  Sparkles,
  Store,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Wire types ──────────────────────────────────────────────────────────── */

interface GrowthProduct {
  id: string;
  name: string;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
  listingType: 'product' | 'service';
  eligible: boolean;
  reasons: string[];
  publicPath: string | null;
  suggestedCaption: string;
}

interface Destination {
  id: string;
  label: string;
  kind: string;
  group: 'vidnov' | 'search' | 'commerce';
  configured: boolean;
  canSubmit: boolean;
  quotas: { perRun: number; perDay: number };
  capabilities: { submit: boolean; verify: boolean; confirmable: string[] };
}

interface SocialDestination {
  id: string;
  label: string;
  connected: boolean;
  accountLabel: string | null;
  connectedAt: string | null;
  publishReady: boolean;
  note: string;
}

interface Campaign {
  id: string;
  productId: string | null;
  channel: string | null;
  status: string;
  integrationStatus: string;
  attempts: number;
  lastError: { message: string; at: string | null } | null;
  updatedAt: string | null;
  createdAt: string | null;
}

interface Boost {
  id: string;
  productId: string | null;
  status: string;
  pointsPaid: number;
  durationDays: number | null;
  caption: string;
  rejectionReason: string | null;
  createdAt: string | null;
}

interface GrowthData {
  points: { balance: number; perDay: number; minDays: number; maxDays: number };
  products: GrowthProduct[];
  destinations: Destination[];
  social: SocialDestination[];
  campaigns: Campaign[];
  boosts: Boost[];
}

interface FreeResult {
  productId: string;
  channel: string;
  ok: boolean;
  status?: string;
  duplicate?: boolean;
  message?: string;
}

const STATUS_STYLE: Record<string, string> = {
  ready: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  queued: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  processing: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  submitted: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
  live: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  failed: 'border-red-500/30 bg-red-500/10 text-red-300',
  needs_attention: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  stopped: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
  not_configured: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-red-500/30 bg-red-500/10 text-red-300',
  completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  active: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
};

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    ready: 'Prepared',
    queued: 'Queued',
    processing: 'Sending',
    submitted: 'Accepted by service',
    live: 'Verified live',
    failed: 'Failed',
    needs_attention: 'Needs attention',
    stopped: 'Stopped',
    not_configured: 'Not connected',
    pending: 'Awaiting review',
    approved: 'Approved',
    rejected: 'Rejected',
    completed: 'Completed',
    active: 'Running',
  };
  return map[status] ?? status;
}

function groupOf(destination: Destination): 'vidnov' | 'search' | 'commerce' {
  return destination.group;
}

const GROUP_META = {
  vidnov: { title: 'Vidnov platform', icon: Store, blurb: 'Our own surfaces — always available.' },
  search: { title: 'Search engines', icon: Radar, blurb: 'URL submission and webmaster consoles.' },
  commerce: { title: 'Commerce feeds', icon: ShoppingBag, blurb: 'Product feeds into marketplaces.' },
} as const;

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function ProductGrowthCentrePage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [data, setData] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<FreeResult[] | null>(null);

  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [primary, setPrimary] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [days, setDays] = useState(3);
  const [age, setAge] = useState('18-35');
  const [counties, setCounties] = useState('');
  const [interests, setInterests] = useState('');

  const token = useCallback(() => user?.getIdToken() ?? Promise.resolve<string | null>(null), [user]);

  const api = useCallback(
    async (init: RequestInit = {}) => {
      const t = await token();
      if (!t) throw new Error('Sign in again to continue.');
      const response = await fetch('/api/seller/product-growth', {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
          ...(init.headers ?? {}),
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || 'Request failed.');
      }
      return payload;
    },
    [token],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = (await api()) as GrowthData;
      setData(payload);
      setSelectedChannels((current) =>
        current.length > 0
          ? current
          : payload.destinations.filter((d) => d.canSubmit).map((d) => d.id),
      );
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not load the growth centre',
        description: (error as Error).message,
      });
    } finally {
      setLoading(false);
    }
  }, [api, toast]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const products = data?.products ?? [];
  const destinations = data?.destinations ?? [];
  const social = data?.social ?? [];
  const selected = useMemo(
    () => products.filter((p) => selectedProducts.includes(p.id)),
    [products, selectedProducts],
  );
  const primaryProduct = products.find((p) => p.id === primary) ?? selected[0] ?? null;
  const cost = (data?.points.perDay ?? 100) * days;
  const canAfford = (data?.points.balance ?? 0) >= cost;

  const toggleProduct = (id: string) => {
    setSelectedProducts((current) => {
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      if (!primary || !next.includes(primary)) setPrimary(next[0] ?? '');
      return next;
    });
  };

  const toggleChannel = (id: string) => {
    setSelectedChannels((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  const submitFree = async () => {
    if (selectedProducts.length === 0) {
      toast({ variant: 'destructive', title: 'Select at least one listing.' });
      return;
    }
    if (selectedChannels.length === 0) {
      toast({ variant: 'destructive', title: 'Select at least one destination.' });
      return;
    }
    setBusy(true);
    setResults(null);
    try {
      const payload = (await api({
        method: 'POST',
        body: JSON.stringify({ action: 'free', productIds: selectedProducts, channels: selectedChannels }),
      })) as { submitted: number; skipped: number; results: FreeResult[]; note: string };
      setResults(payload.results);
      toast({
        title: `${payload.submitted} distribution ${payload.submitted === 1 ? 'job' : 'jobs'} prepared`,
        description: payload.skipped > 0 ? `${payload.skipped} skipped — see the reasons below.` : payload.note,
      });
      await load();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not submit',
        description: (error as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  const submitPaid = async () => {
    if (!primaryProduct) {
      toast({ variant: 'destructive', title: 'Select a listing to boost.' });
      return;
    }
    setBusy(true);
    try {
      const payload = (await api({
        method: 'POST',
        body: JSON.stringify({
          action: 'paid',
          productId: primaryProduct.id,
          durationDays: days,
          caption,
          targeting: {
            age,
            counties: counties.split(',').map((c) => c.trim()).filter(Boolean),
            interests: interests.split(',').map((c) => c.trim()).filter(Boolean),
          },
        }),
      })) as { costPoints: number; remainingPoints: number; note: string };
      toast({
        title: 'Boost request submitted',
        description: `${payload.costPoints.toLocaleString()} points held · ${payload.remainingPoints.toLocaleString()} left. ${payload.note}`,
      });
      setCaption('');
      await load();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Boost not submitted',
        description: (error as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SellerLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Growth</p>
            <h1 className="mt-1 font-headline text-3xl font-black tracking-tight">Product Growth Centre</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Put your listings in front of buyers through Vidnov&apos;s own surfaces, the search engines
              the platform is connected to, and the marketplaces it feeds. Free distribution is
              included; boosts are paid in points and reviewed by the team.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3">
            <Coins className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Points balance</p>
              <p className="font-headline text-xl font-bold">
                {loading ? '—' : (data?.points.balance ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          {/* ── Selection ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingBag className="h-4 w-4 text-primary" /> 1 · Choose what to promote
              </CardTitle>
              <CardDescription>
                Only your own listings appear here. A listing that is private, has no photo or no
                price cannot be distributed — it is shown with the reason instead of being hidden.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : products.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No listings yet.{' '}
                  <Link href="/dashboard/seller/ai-studio" className="text-primary underline">
                    Add a product
                  </Link>{' '}
                  and it will appear here.
                </div>
              ) : (
                products.map((product) => {
                  const isSelected = selectedProducts.includes(product.id);
                  return (
                    <div
                      key={product.id}
                      className={cn(
                        'flex items-start gap-3 rounded-xl border p-3 transition',
                        isSelected ? 'border-primary/60 bg-primary/5' : 'hover:bg-muted/40',
                        !product.eligible && 'opacity-70',
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleProduct(product.id)}
                        disabled={!product.eligible}
                        aria-label={`Select ${product.name}`}
                        className="mt-1"
                      />
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt={product.name}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.price === null
                            ? 'Price on request'
                            : `${product.currency ?? ''} ${product.price.toLocaleString()}`.trim()}
                          {' · '}
                          {product.listingType === 'service' ? 'Service' : 'Product'}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {product.eligible ? (
                            <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-400">
                              Eligible
                            </Badge>
                          ) : (
                            product.reasons.map((reason) => (
                              <Badge
                                key={reason}
                                variant="outline"
                                className="border-amber-500/40 text-[10px] text-amber-400"
                              >
                                {reason.replace(/_/g, ' ')}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={primary === product.id ? 'default' : 'ghost'}
                        onClick={() => {
                          setPrimary(product.id);
                          setCaption(product.suggestedCaption);
                        }}
                        disabled={!product.eligible}
                      >
                        {primary === product.id ? 'Primary' : 'Preview'}
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* ── Preview ───────────────────────────────────────────────── */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" /> Preview
              </CardTitle>
              <CardDescription>Exactly what the boost will show. Free distribution uses the listing itself.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {primaryProduct ? (
                <>
                  <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
                    {primaryProduct.imageUrl ? (
                      <Image
                        src={primaryProduct.imageUrl}
                        alt={primaryProduct.name}
                        fill
                        sizes="(max-width: 1024px) 100vw, 400px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        No photo — add one before boosting.
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      Sponsored
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold">{primaryProduct.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {primaryProduct.price === null
                        ? 'Price on request'
                        : `${primaryProduct.currency ?? ''} ${primaryProduct.price.toLocaleString()}`.trim()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="caption" className="text-xs">
                      Boost caption ({caption.length}/280)
                    </Label>
                    <Textarea
                      id="caption"
                      value={caption}
                      onChange={(event) => setCaption(event.target.value.slice(0, 280))}
                      placeholder={primaryProduct.suggestedCaption}
                      rows={3}
                    />
                  </div>
                  {primaryProduct.publicPath ? (
                    <p className="truncate text-[11px] text-muted-foreground">
                      Public page: <span className="text-foreground">{primaryProduct.publicPath}</span>
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Select a listing to preview how it is promoted.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Free / Paid ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4 text-primary" /> 2 · Choose how
            </CardTitle>
            <CardDescription>
              Free distribution is included with every listing. A boost is paid in points and
              reviewed by a person before anything runs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="free">
              <TabsList className="grid w-full max-w-sm grid-cols-2">
                <TabsTrigger value="free">Free growth</TabsTrigger>
                <TabsTrigger value="paid">Paid boost</TabsTrigger>
              </TabsList>

              {/* FREE */}
              <TabsContent value="free" className="space-y-5 pt-4">
                {(['vidnov', 'search', 'commerce'] as const).map((group) => {
                  const rows = destinations.filter((d) => groupOf(d) === group);
                  if (rows.length === 0) return null;
                  const meta = GROUP_META[group];
                  const Icon = meta.icon;
                  return (
                    <div key={group} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-semibold">{meta.title}</p>
                        <span className="text-[11px] text-muted-foreground">{meta.blurb}</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {rows.map((destination) => {
                          const checked = selectedChannels.includes(destination.id);
                          const disabled = !destination.canSubmit;
                          return (
                            <label
                              key={destination.id}
                              className={cn(
                                'flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition',
                                checked && !disabled && 'border-primary/60 bg-primary/5',
                                disabled && 'cursor-not-allowed opacity-60',
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleChannel(destination.id)}
                                disabled={disabled}
                                aria-label={destination.label}
                                className="mt-0.5"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center justify-between gap-2">
                                  <span className="truncate font-medium">{destination.label}</span>
                                  {destination.canSubmit ? (
                                    <Badge
                                      variant="outline"
                                      className="shrink-0 border-emerald-500/40 text-[10px] text-emerald-400"
                                    >
                                      Available
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="shrink-0 border-slate-500/40 text-[10px] text-slate-400"
                                    >
                                      Not connected
                                    </Badge>
                                  )}
                                </span>
                                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                  {destination.canSubmit
                                    ? `Up to ${destination.quotas.perRun} per run · ${destination.quotas.perDay} per day`
                                    : 'The platform has not finished connecting this destination.'}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Social accounts</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {social.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No social modules are configured yet.</p>
                    ) : (
                      social.map((account) => (
                        <div
                          key={account.id}
                          className="rounded-xl border p-3 text-sm"
                          title={account.note}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">{account.label}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'shrink-0 text-[10px]',
                                account.connected
                                  ? 'border-emerald-500/40 text-emerald-400'
                                  : 'border-slate-500/40 text-slate-400',
                              )}
                            >
                              {account.connected ? 'Connected' : 'Not connected'}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">{account.note}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <Button onClick={submitFree} disabled={busy || selectedProducts.length === 0}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Prepare free distribution ({selectedProducts.length} ×{' '}
                  {selectedChannels.length})
                </Button>

                {results ? (
                  <div className="space-y-1 rounded-xl border p-3">
                    {results.map((row) => (
                      <div key={`${row.productId}-${row.channel}`} className="flex items-center gap-2 text-xs">
                        {row.ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-amber-400" />
                        )}
                        <span className="text-muted-foreground">{row.channel}</span>
                        <span className="flex-1 truncate">
                          {row.ok ? statusLabel(row.status ?? 'ready') : row.message}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </TabsContent>

              {/* PAID */}
              <TabsContent value="paid" className="space-y-4 pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Campaign length</Label>
                    <div className="flex flex-wrap gap-2">
                      {[1, 3, 7, 14, 30].map((option) => (
                        <Button
                          key={option}
                          type="button"
                          size="sm"
                          variant={days === option ? 'default' : 'outline'}
                          onClick={() => setDays(option)}
                        >
                          {option}d
                        </Button>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {data?.points.perDay ?? 100} points per day · max {data?.points.maxDays ?? 30} days
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Audience age</Label>
                    <Input value={age} onChange={(event) => setAge(event.target.value)} placeholder="18-35" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Counties (comma separated)</Label>
                    <Input
                      value={counties}
                      onChange={(event) => setCounties(event.target.value)}
                      placeholder="Nairobi, Mombasa"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Interests</Label>
                    <Input
                      value={interests}
                      onChange={(event) => setInterests(event.target.value)}
                      placeholder="fashion, phones"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm">
                  <Coins className="h-4 w-4 text-amber-400" />
                  <span>
                    Cost <strong>{cost.toLocaleString()} points</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Balance {(data?.points.balance ?? 0).toLocaleString()}
                  </span>
                  {!canAfford ? (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-400">
                      Not enough points
                    </Badge>
                  ) : null}
                </div>

                <Button onClick={submitPaid} disabled={busy || !primaryProduct || !canAfford}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Request boost
                </Button>

                <p className="text-[11px] text-muted-foreground">
                  Points are held when the request is created and returned if it is rejected. A boost
                  buys Vidnov placement and a review by the team — it does not guarantee search
                  indexing, social reach or sales.
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ── History ───────────────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe2 className="h-4 w-4 text-primary" /> Distribution jobs
              </CardTitle>
              <CardDescription>What the engine has done with your listings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.campaigns ?? []).length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nothing distributed yet.
                </p>
              ) : (
                data!.campaigns.map((job) => (
                  <div key={job.id} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                    <Compass className="h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        <span className="font-medium">{job.channel ?? 'channel'}</span>{' '}
                        <span className="text-muted-foreground">
                          · {products.find((p) => p.id === job.productId)?.name ?? job.productId}
                        </span>
                      </p>
                      {job.lastError?.message ? (
                        <p className="truncate text-[11px] text-amber-400">{job.lastError.message}</p>
                      ) : null}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('shrink-0 text-[10px]', STATUS_STYLE[job.status] ?? '')}
                    >
                      {statusLabel(job.status)}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary" /> Boost requests
              </CardTitle>
              <CardDescription>Paid promotion, reviewed by the Vidnov team.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.boosts ?? []).length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No boost requested yet.</p>
              ) : (
                data!.boosts.map((boost) => (
                  <div key={boost.id} className="rounded-lg border p-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium">
                        {products.find((p) => p.id === boost.productId)?.name ?? boost.productId}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn('shrink-0 text-[10px]', STATUS_STYLE[boost.status] ?? '')}
                      >
                        {statusLabel(boost.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {boost.pointsPaid.toLocaleString()} points
                      {boost.durationDays ? ` · ${boost.durationDays} days` : ''}
                      {boost.rejectionReason ? ` · ${boost.rejectionReason}` : ''}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            A prepared job means the platform has accepted the listing for that destination. It is
            not indexing, reach or a sale, and this page never reports those unless the destination
            itself confirmed them.
          </p>
        </div>
      </div>
    </SellerLayout>
  );
}
