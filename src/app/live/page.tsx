'use client';

/**
 * Vidnov Live — buyer discovery (spec §21, §25).
 *
 * LIVE NOW grid backed by /api/live?scope=active. LiveKit stays invisible:
 * buyers see Vidnov surfaces only. Signed-in users of any role can browse;
 * watching requires the viewer token flow on /live/[id].
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import {
  Radio, Search, MapPin, Eye, Loader2, ArrowLeft,
} from 'lucide-react';

interface LiveCard {
  id: string;
  title: string;
  status: string;
  thumbnailUrl?: string | null;
  businessName?: string | null;
  category?: string | null;
  location?: string | null;
  viewerCount: number;
}

const CATEGORIES = [
  'All', 'Fashion', 'Electronics', 'Home', 'Beauty', 'Food', 'Sports', 'Art', 'Books', 'Other',
];

export default function LiveDiscoveryPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [streams, setStreams] = React.useState<LiveCard[] | null>(null);
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('All');

  const load = React.useCallback(async () => {
    if (!user) return;
    try {
      const token = await (user as any).getIdToken();
      const res = await fetch('/api/live?scope=active', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not load lives.');
      const data = await res.json();
      setStreams(data.streams ?? []);
    } catch (e) {
      setStreams([]);
      toast({
        variant: 'destructive',
        title: 'Live is starting up',
        description: e instanceof Error ? e.message : 'Check back shortly.',
      });
    }
  }, [user, toast]);

  React.useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const filtered = (streams ?? []).filter((s) => {
    if (category !== 'All' && (s.category ?? 'Other') !== category) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        (s.businessName ?? '').toLowerCase().includes(q) ||
        (s.location ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openStream = (id: string) => {
    router.push(`/live/${id}`);
  };

  return (
    <BuyerLayout>
      <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8 vn-page-enter">
        <header className="space-y-3">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-primary">
            <Radio className="h-3.5 w-3.5" /> Vidnov Live
          </p>
          <h1 className="font-grotesk text-3xl font-bold text-foreground sm:text-4xl">LIVE NOW</h1>
          <p className="max-w-lg text-sm text-muted-foreground">
            Shop live from businesses across Vidnov — watch, chat, and order in the moment.
          </p>
        </header>

        {/* Search + categories (§21) */}
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lives, businesses, places…"
              className="h-11 rounded-xl pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  'rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest vn-transition',
                  category === c
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {streams === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <Radio className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-4 font-grotesk text-lg font-bold text-foreground">No lives right now</p>
            <p className="mt-1 text-sm text-muted-foreground">
              When a business goes live it appears here instantly.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <Link
                key={s.id}
                href={`/live/${s.id}`}
                className="group overflow-hidden rounded-2xl border border-border bg-card vn-transition hover:border-foreground/40 hover:shadow-lg"
              >
                {/* Tile */}
                <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-[#1A1030] via-[#2A1440] to-[#0A1224]">
                  {s.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Radio className="h-10 w-10 text-white/20" />
                    </div>
                  )}
                  <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
                  </span>
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
                    <Eye className="h-3 w-3" /> {s.viewerCount}
                  </span>
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10">
                    <span className="truncate text-sm font-bold text-white">{s.businessName || 'Vidnov Business'}</span>
                    {s.category && (
                      <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white/90 backdrop-blur">
                        {s.category}
                      </span>
                    )}
                  </span>
                </div>
                {/* Meta */}
                <div className="space-y-3 p-4">
                  <p className="truncate font-semibold text-foreground">{s.title}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                      {s.location && (
                        <>
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{s.location}</span>
                        </>
                      )}
                    </span>
                    <span className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-red-600 px-3 text-[10px] font-black uppercase tracking-widest text-white group-hover:bg-red-700">
                      Watch live <ArrowLeft className="h-3 w-3 rotate-180" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {isLoading && !user && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading Vidnov Live…
          </div>
        )}
      </div>
    </BuyerLayout>
  );
}
