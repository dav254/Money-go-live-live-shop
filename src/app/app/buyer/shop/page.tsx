'use client';

/**
 * BUYER APP · SHOP — the discovery feed, natively.
 *
 * ## What this used to be
 *
 * A grid of product cards with a search field and a category rail. Which is a
 * reasonable *website* marketplace, and the wrong thing here for two reasons:
 *
 *   1. It was a grid, and the thing buyers actually scroll in this app is a
 *      vertical feed. The website already ships that at `/buyer/discovery`;
 *      the app was showing a different catalogue shape for the same products.
 *   2. It linked OUT. The empty state carried `<Link href="/buyer/requests/new">`
 *      — a website route, inside the installed app. One tap and the session
 *      left the section it was standing in. That is the single habit this
 *      section exists to break, and the screen had it.
 *
 * ## What it is now
 *
 * The same shared feed the website renders, with the website chrome switched
 * off (`chrome={false}`). The card, the snap-scrolling and the queries are one
 * implementation in `components/feed/live-feed-content`; only the frame differs.
 *
 * ## No website routes, anywhere
 *
 * The All / Saved switch navigates this app's OWN route with a query param —
 * `?view=saved` — because the shared feed reads its view from the URL. It is
 * the same page, not a hand-off. Everything else on this screen is a tap on a
 * card or a swipe. There is no link that leaves the app.
 *
 * ## Sizing
 *
 * This route is immersive (see `IMMERSIVE_ROUTES` in the buyer shell): no full
 * header, no tab bar. So the only chrome above the feed is the h-12 (3rem)
 * bar, plus the 0.5rem the shell's `main` keeps as bottom padding — which is
 * where the 3.5rem comes from. One product is exactly one visible screen, with
 * no dead strip underneath and no title row stealing a card's height.
 */

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Compass, Heart, Video } from 'lucide-react';
import { LiveFeedContent } from '@/components/feed/live-feed-content';
import { cn } from '@/lib/utils';

function ShopInner() {
  // The shared feed reads its view from the URL, so the switch reads it from
  // the same place rather than keeping a second copy of that state.
  const view = useSearchParams()?.get('view') === 'saved' ? 'saved' : 'all';

  const tabClass = (active: boolean) =>
    cn(
      'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition',
      active
        ? 'bg-gradient-to-br from-cyan-400 to-violet-500 text-white'
        : 'text-white/60 hover:text-white',
    );

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] overflow-hidden">
      {/* Full-bleed: no title row, no gutter. The screen IS the feed, so the
          All / Saved switch floats over the top-right corner of the first card
          rather than occupying a band above it and stealing a card's height.
          Both hrefs stay on this app's own route — a view switch, not a
          hand-off. Links rather than buttons so they work pre-hydration and
          are keyboard reachable. */}
      <div className="absolute right-3 top-3 z-30 flex rounded-full border border-white/20 bg-black/45 p-0.5 backdrop-blur-md">
        <Link href="/app/buyer/shop" scroll={false} className={tabClass(view === 'all')}>
          <Video className="h-3 w-3" />
          All
        </Link>
        <Link
          href="/app/buyer/shop?view=saved"
          scroll={false}
          className={tabClass(view === 'saved')}
        >
          <Heart className="h-3 w-3" />
          Saved
        </Link>
      </div>

      <LiveFeedContent backHref="/app/buyer" chrome={false} className="h-full" />
    </div>
  );
}

export default function BuyerSectionShop() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center px-4 pt-10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Compass className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em]">
              Loading the feed
            </span>
          </div>
        </div>
      }
    >
      <ShopInner />
    </Suspense>
  );
}