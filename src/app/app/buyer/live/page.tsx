'use client';

/**
 * BUYER APP · LIVE — live shopping, natively.
 *
 * ## What this is
 *
 * The buyer sidebar had no Live destination, so live shopping was a website
 * thing: the sidebar pointed nowhere and the only route into it was `/live` on
 * the website, wrapped in the website's `BuyerLayout`. Tapping a stream from
 * there dropped the buyer out of the installed app and into a desktop sidebar
 * layout — the exact hand-off this section exists to prevent.
 *
 * ## What is reused, and what is deliberately not
 *
 * Reused: the backend contract (`GET /api/live?scope=active`, bearer-authed
 * with the buyer's own ID token) and the shape of a live card. That endpoint is
 * the same one the website calls; calling it from here is not a hand-off, it is
 * the same data over the same auth.
 *
 * Not reused: `BuyerLayout`. That is the website's desktop sidebar chrome, and
 * rendering it inside `BuyerAppShell` would stack two shells. The frame here is
 * the buyer app's own — max-w-md, borderless 3xl cards, cyan → violet accents,
 * the section's own title block.
 *
 * The watch screen it links to is this section's own `/app/buyer/live/[id]`, not
 * the website's `/live/[id]`. There is no link on this page that leaves the app.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight, Eye, Loader2, MapPin, Radio, Search,
} from 'lucide-react';
import { useUser } from '@/firebase';
import { Input } from '@/components/ui/input';
import {
  BuyerEmptyState, BuyerSectionTitle,
} from '@/components/app/buyer/buyer-app-shell';
import { cn } from '@/lib/utils';

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

/** Same taxonomy the website filter uses, so the two agree on what exists. */
const CATEGORIES = [
  'All', 'Fashion', 'Electronics', 'Home', 'Beauty', 'Food', 'Sports', 'Art', 'Books', 'Other',
];

export default function BuyerSectionLive() {
  const { user } = useUser();
  const [streams, setStreams] = React.useState<LiveCard[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('All');

  React.useEffect(() => {
    if (!user) return;
    let alive = true;

    void (async () => {
      try {
        const token = await (user as unknown as { getIdToken: () => Promise<string> }).getIdToken();
        const res = await fetch('/api/live?scope=active', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error(
            (await res.json().catch(() => ({}))).error || 'Could not load live streams.',
          );
        }
        const data = await res.json();
        if (!alive) return;
        setStreams(data.streams ?? []);
        setLoadError(null);
      } catch (e) {
        if (!alive) return;
        // The list is genuinely unavailable, so say so rather than rendering an
        // empty grid that reads as "nobody is live" — those are different
        // truths and a buyer would wait for a stream that is already running.
        setStreams([]);
        setLoadError(e instanceof Error ? e.message : 'Could not load live streams.');
      }
    })();

    return () => {
      alive = false;
    };
  }, [user]);

  const filtered = (streams ?? []).filter((s) => {
    if (category !== 'All' && (s.category ?? 'Other') !== category) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      (s.businessName ?? '').toLowerCase().includes(q) ||
      (s.location ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="vn-page-enter space-y-5 pb-2">
      <BuyerSectionTitle
        eyebrow="Vidnov Live"
        title="Live now"
      />

      <p className="-mt-3 px-4 font-sans text-xs leading-relaxed text-muted-foreground">
        Shop live from businesses across Vidnov — watch, chat and order in the moment.
      </p>

      {/* Search + categories. The rail scrolls horizontally rather than
          wrapping: on a phone a wrapped category list pushed the grid below
          the fold before a single stream was visible. */}
      <div className="space-y-3">
        <div className="relative px-4">
          <Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lives, businesses, places…"
            aria-label="Search live streams"
            className="h-11 rounded-2xl pl-10"
          />
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={cn(
                'vn-micro shrink-0 rounded-full border px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest transition',
                category === c
                  ? 'border-transparent bg-gradient-to-r from-cyan-400 to-violet-500 text-white'
                  : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {streams === null ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
          <span className="font-sans text-sm">Finding live streams…</span>
        </div>
      ) : loadError ? (
        <BuyerEmptyState
          icon={Radio}
          title="Live is unavailable"
          body={`${loadError} Your connection may have dropped — pull down to try again.`}
        />
      ) : filtered.length === 0 ? (
        <BuyerEmptyState
          icon={Radio}
          title="No lives right now"
          body="When a business goes live it appears here instantly. Try another category, or check back shortly."
        />
      ) : (
        <div className="space-y-4 px-4">
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/app/buyer/live/${s.id}`}
              className="vn-buyer-card group block overflow-hidden transition active:scale-[0.99]"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-cyan-500/20 via-[#101B33] to-violet-600/20">
                {s.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Radio className="h-10 w-10 text-white/20" />
                  </div>
                )}

                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 font-sans text-[9px] font-black uppercase tracking-widest text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  Live
                </span>

                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 font-sans text-[10px] font-bold text-white backdrop-blur">
                  <Eye className="h-3 w-3" />
                  {s.viewerCount}
                </span>

                <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent px-3.5 pb-2.5 pt-10">
                  <span className="truncate font-sans text-sm font-bold text-white">
                    {s.businessName || 'Vidnov Business'}
                  </span>
                  {s.category && (
                    <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-widest text-white/90 backdrop-blur">
                      {s.category}
                    </span>
                  )}
                </span>
              </div>

              <div className="space-y-3 p-4">
                <p className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
                  {s.title}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1 font-sans text-[11px] text-muted-foreground">
                    {s.location && (
                      <>
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{s.location}</span>
                      </>
                    )}
                  </span>
                  <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-3 font-sans text-[10px] font-black uppercase tracking-widest text-white shadow-md shadow-violet-500/25">
                    Watch
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}