'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser, useUserProfile } from '@/firebase';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { SellerLayout } from '@/components/layout/seller-layout';
import { fetchMyRequests, fetchOpenRequests, fetchMyWonRequests } from '@/lib/requests/client';
import { REQUEST_CATEGORIES, type MarketplaceRequest } from '@/lib/requests/types';
import { budgetLabel } from '@/lib/requests/labels';
import { StatusBadge } from '@/app/buyer/requests/status-badge';
import { CreateWithAiLink } from '@/components/ai/create-with-ai';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  MapPin,
  CalendarDays,
  Eye,
  MessageSquareText,
  Loader2,
  Inbox,
  Store,
  CheckCircle2,
  Search,
  ArrowDownUp,
  Clock,
  User as UserIcon,
} from 'lucide-react';

/** Firestore Timestamp | ISO string | epoch → Date, without importing types. */
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  const t = value as { toDate?: () => Date; seconds?: number };
  if (typeof t.toDate === 'function') return t.toDate();
  if (typeof t.seconds === 'number') return new Date(t.seconds * 1000);
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * REQUEST MARKETPLACE HUB — works for BOTH buyers and sellers (§24):
 *  - Sellers see open requests matched to their business (their inbox).
 *  - Buyers (and any signed-in user) see their own posted requests.
 *  - A seller who also posts requests can switch between both views.
 */
export default function RequestsHubPage() {
  const { user, isLoading: authLoading } = useUser();
  const { userProfile, isLoading: profileLoading } = useUserProfile(user?.uid);
  const router = useRouter();

  const isSeller = userProfile?.userRole === 'seller' || userProfile?.userRole === 'admin';
  const loadingProfile = authLoading || profileLoading;

  // Sellers browse + offer only — buyers post requests.
  const canPost = !!user && !isSeller;

  const [tab, setTab] = React.useState<'mine' | 'open' | 'won'>('mine');
  const [mine, setMine] = React.useState<MarketplaceRequest[] | null>(null);
  const [open, setOpen] = React.useState<MarketplaceRequest[] | null>(null);
  const [won, setWon] = React.useState<MarketplaceRequest[] | null>(null);
  const [loadingMine, setLoadingMine] = React.useState(false);
  const [loadingOpen, setLoadingOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Auth gate
  React.useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?returnTo=/requests');
    }
  }, [authLoading, user, router]);

  // Load my requests (any signed-in user)
  React.useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoadingMine(true);
    fetchMyRequests(user)
      .then((rows) => alive && setMine(rows))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Failed to load your requests.'))
      .finally(() => alive && setLoadingMine(false));
    return () => {
      alive = false;
    };
  }, [user]);

  // Load open (matched) requests for sellers only
  React.useEffect(() => {
    if (!user || !isSeller || !loadingProfile) return;
    let alive = true;
    setLoadingOpen(true);
    fetchOpenRequests(user)
      .then((rows) => alive && setOpen(rows))
      .catch(() => alive && setOpen([]))
      .finally(() => alive && setLoadingOpen(false));
    return () => {
      alive = false;
    };
  }, [user, isSeller, loadingProfile]);

  // Requests this seller WON — the customer accepted their offer, so they stay
  // visible (and actionable) even though the brief is closed.
  React.useEffect(() => {
    if (!user || !isSeller || !loadingProfile) return;
    let alive = true;
    fetchMyWonRequests(user)
      .then((rows) => alive && setWon(rows))
      .catch(() => alive && setWon([]));
    return () => {
      alive = false;
    };
  }, [user, isSeller, loadingProfile]);

  // Default sellers to the open-requests inbox
  React.useEffect(() => {
    if (!loadingProfile && isSeller) setTab('open');
  }, [loadingProfile, isSeller]);

  const loading = tab === 'mine' ? loadingMine : loadingOpen;

  // ── Discovery filters (§2): search · category · location · sort ───────────
  const [q, setQ] = React.useState('');
  const [cat, setCat] = React.useState('all');
  const [loc, setLoc] = React.useState('all');
  const [sort, setSort] = React.useState<'recent' | 'budget' | 'offers' | 'expiry'>('recent');

  const locations = React.useMemo(() => {
    const source = tab === 'mine' ? mine ?? [] : tab === 'open' ? open ?? [] : won ?? [];
    return [...new Set(source.map((r) => (r.location ?? '').trim()).filter(Boolean))].sort();
  }, [tab, mine, open, won]);

  // Defensive: a brief with an accepted offer is no longer open to bids, so it
  // must never be rendered in the "Open for Business" list.
  const rows = React.useMemo(() => {
    const base =
      tab === 'mine'
        ? mine ?? []
        : tab === 'open'
          ? (open ?? []).filter((r) => !r.acceptedOfferId)
          : won ?? [];

    const needle = q.trim().toLowerCase();
    const filtered = base.filter((r) => {
      if (cat !== 'all' && r.category !== cat) return false;
      if (loc !== 'all' && (r.location ?? '').trim() !== loc) return false;
      if (needle) {
        const haystack = `${r.title} ${r.description} ${r.category} ${r.location ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    const ms = (v: unknown): number => {
      if (!v) return 0;
      if (typeof v === 'number') return v;
      if (v instanceof Date) return v.getTime();
      const t = v as { toDate?: () => Date; seconds?: number };
      if (typeof t.toDate === 'function') return t.toDate().getTime();
      if (typeof t.seconds === 'number') return t.seconds * 1000;
      return 0;
    };
    const sorted = [...filtered];
    if (sort === 'budget') {
      sorted.sort((a, b) => (b.budgetMax ?? b.budgetMin ?? 0) - (a.budgetMax ?? a.budgetMin ?? 0));
    } else if (sort === 'offers') {
      sorted.sort((a, b) => (b.offersCount ?? 0) - (a.offersCount ?? 0));
    } else if (sort === 'expiry') {
      sorted.sort((a, b) => {
        const ae = a.expiresAt ? Date.parse(a.expiresAt) : Number.MAX_SAFE_INTEGER;
        const be = b.expiresAt ? Date.parse(b.expiresAt) : Number.MAX_SAFE_INTEGER;
        return ae - be;
      });
    } else {
      sorted.sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
    }
    return sorted;
  }, [tab, mine, open, won, q, cat, loc, sort]);

  // ROLE-AWARE CHROME: the Requests hub is shared, but sellers must never
  // see it wrapped in the buyer section — they get their own workspace.
  const content = (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">
              Request Marketplace
            </p>
            <h1 className="font-grotesk text-3xl font-black uppercase tracking-tight">Requests</h1>
            <p className="text-sm font-medium text-muted-foreground">
              {isSeller
                ? 'Open briefs matched to your business — and your own requests in one place.'
                : 'Post what you need and track offers from matched businesses.'}
            </p>
          </div>
          {canPost && (
            <div className="flex flex-wrap items-center gap-3">
              <CreateWithAiLink
                href="/ai-studio"
                variant="outline"
                label="Create AI concept"
              />
              <Button asChild className="rounded-xl bg-gradient-to-r from-[#FF4D2E] to-[#FF7A45] font-black uppercase tracking-wide shadow-lg shadow-primary/25">
                <Link href="/buyer/requests/new">
                  <Plus className="mr-2 h-4 w-4" /> New Request
                </Link>
              </Button>
            </div>
          )}
        </header>

        {/* Role tabs: sellers get both views */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('mine')}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition ${
              tab === 'mine'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <UserIcon className="h-3.5 w-3.5" /> My Requests
          </button>{isSeller && (
            <button
              type="button"
              onClick={() => setTab('open')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition ${
                tab === 'open'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Store className="h-3.5 w-3.5" /> Open for Business
            </button>
          )}
          {isSeller && (won?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => setTab('won')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition ${
                tab === 'won'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> My Deals ({won?.length})
            </button>
          )}
        </div>

        {/* Discovery controls (§2): search · category · location · sort */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search requests…"
              className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            aria-label="Filter by category"
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="all">All categories</option>
            {REQUEST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            aria-label="Filter by location"
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="all">All locations</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Sort requests"
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="recent">Newest first</option>
            <option value="budget">Highest budget</option>
            <option value="offers">Most offers</option>
            <option value="expiry">Expiring soon</option>
          </select>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">{error}</p>
        )}

        {!loading && rows?.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground/50" />
              {tab === 'mine' ? (
                <>
                  <p className="font-grotesk text-lg font-black uppercase">No requests yet</p>
                  {canPost ? (
                    <>
                      <p className="max-w-sm text-sm text-muted-foreground">
                        Post what you need — photos or a short video help, but they're optional —
                        and let matched businesses come to you with offers.
                      </p>
                      <Button asChild className="mt-2 rounded-xl">
                        <Link href="/buyer/requests/new">Post your first request</Link>
                      </Button>
                    </>
                  ) : (
                    <p className="max-w-sm text-sm text-muted-foreground">
                      As a business account you respond to customer briefs — switch to
                      “Open for Business” to see what customers need.
                    </p>
                  )}
                </>
              ) : tab === 'won' ? (
                <>
                  <p className="font-grotesk text-lg font-black uppercase">No won requests yet</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    When a customer accepts one of your offers it moves here so you can fulfil it
                    and message them directly.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-grotesk text-lg font-black uppercase">No matched requests</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Complete your shop profile (category &amp; location) so the matching engine can
                    bring you the right briefs.
                  </p>
                  <Button asChild variant="outline" className="mt-2 rounded-xl">
                    <Link href="/dashboard/account">Set up your shop profile</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {(rows ?? []).map((r) => (
            <Link key={r.id} href={`/requests/${r.id}`} className="block">
              <Card className="transition hover:border-primary/50 hover:shadow-md">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate font-grotesk text-lg font-bold">{r.title}</h2>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="line-clamp-1 text-sm text-muted-foreground">{r.description}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      <span>{r.category}</span>
                      {r.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {r.location}
                        </span>
                      )}
                      {r.deadline && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" /> Due {r.deadline}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <MessageSquareText className="h-3 w-3" /> {r.offersCount ?? 0} offer
                        {(r.offersCount ?? 0) === 1 ? '' : 's'}
                      </span>
                      {toDate(r.createdAt) && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Posted{' '}
                          {toDate(r.createdAt)!.toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {tab === 'mine' ? (
                      <Badge variant="secondary" className="rounded-full font-bold">
                        <MessageSquareText className="mr-1 h-3 w-3" /> {r.offersCount ?? 0} offers
                      </Badge>
                    ) : tab === 'won' ? (
                      <Badge className="rounded-full font-bold uppercase text-[10px]">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> You won
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-full font-bold uppercase text-[10px]">
                        Open
                      </Badge>
                    )}
                    <span className="text-xs font-black">{budgetLabel(r)}</span>
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
                      <Eye className="h-3 w-3" /> {r.views ?? 0}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
    </div>
  );

  // Sellers render inside SellerLayout (seller sidebar + header). Buyers and
  // admins keep the existing buyer chrome.
  if (userProfile?.userRole === 'seller') {
    return <SellerLayout>{content}</SellerLayout>;
  }
  return <BuyerLayout>{content}</BuyerLayout>;
}
