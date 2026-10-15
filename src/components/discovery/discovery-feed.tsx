'use client';

/**
 * DISCOVERY — the feed.
 *
 * One shape, one job: a vertical, full-screen, snap-scrolled column where every
 * listing is an immersive post. That is the whole idea. A marketplace feed that
 * interleaves grids and rows makes a buyer decide, ten times a minute, whether
 * to keep scrolling or start reading — and deciding is what makes people close
 * the app. Here there is exactly one gesture: up.
 *
 * ## Layout
 * The section is a flex column that fills the viewport. The pinned bar is
 * `shrink-0`; the feed is `flex-1` and is the only scroller, with `snap-y
 * mandatory` so a flick lands on one listing rather than between two. Each
 * post is `absolute inset-0` inside a `snap-start` cell, so the media is the
 * cell — no letterboxing, no dead strip.
 *
 * ## Performance
 * One IntersectionObserver marks the post on screen; every other post is
 * paused and its video rewound. Comment threads subscribe only for the active
 * post. The whole page is one page of listings — no unbounded scroll that
 * quietly grows a listener set until a mid-range Android gives up.
 */

import * as React from 'react';
import { collection, limit, query, where } from 'firebase/firestore';
import { AlertTriangle, Compass, Loader2, RefreshCw } from 'lucide-react';

import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import type { Product, SellerShop } from '@/lib/types';
import {
  dedupeById,
  filterListings,
  isSponsoredNow,
  listingCover,
  type DiscoveryCategoryId,
  type DiscoveryFilters,
} from '@/lib/discovery';
import { DiscoveryVideoPost, type DiscoverySeller } from './discovery-video-post';
import { DiscoveryLiveLane } from './discovery-live';
import { DiscoveryDetails } from './discovery-details';

const PAGE_SIZE = 60;
const PLACEHOLDER_AVATAR = '/placeholder-avatar.svg';

/* ── Loading / empty / error ────────────────────────────────────────────── */

function FeedSkeleton() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[color:var(--vn-discovery-accent)]" aria-hidden />
      <p className="text-[11px] uppercase tracking-[0.25em] text-white/55">Loading the feed</p>
    </div>
  );
}

function FeedMessage({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center">
        <Icon className="mx-auto h-6 w-6 text-white/55" aria-hidden />
        <p className="font-grotesk mt-3 text-[15px] font-bold text-white">{title}</p>
        <p className="mx-auto mt-1.5 max-w-xs text-[12px] leading-relaxed text-white/55">{body}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

/* ── The feed ───────────────────────────────────────────────────────────── */

export function DiscoveryFeed({
  category,
  filters,
  onResultCount,
  ownCover,
}: {
  category: DiscoveryCategoryId;
  filters: DiscoveryFilters;
  onResultCount?: (count: number) => void;
  ownCover?: (listing: Product) => string;
}) {
  const firestore = useFirestore();

  // Retry re-subscribes by giving the queries a new identity. Flipping a
  // boolean would only re-render the same failed snapshot.
  const [attempt, setAttempt] = React.useState(0);

  const productsQuery = React.useMemo(() => {
    void attempt;
    if (!firestore) return null;
    // Deliberately NOT `orderBy('uploadDate')`. This catalogue spans several
    // generations of upload form: some documents carry `uploadDate`, some
    // carry `createdAt`, and an `orderBy` on either field silently drops every
    // document missing it — which is how the old Discovery screens rendered an
    // empty page forever. Reading an unordered page and sorting in
    // `filterListings` (via `createdMs`, which knows both fields) cannot lose a
    // listing.
    return query(collection(firestore, 'products'), limit(PAGE_SIZE));
  }, [firestore, attempt]);

  const shopsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sellerShops'), limit(200));
  }, [firestore]);

  // Public read. Used only for the Live dot on a seller, never to decide what
  // a live stream is — the Live lane gets that from the streaming service.
  const liveQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'liveSessions'), where('status', '==', 'live'), limit(50));
  }, [firestore]);

  const products = useCollection<Product>(productsQuery);
  const shops = useCollection<SellerShop>(shopsQuery);
  const liveSessions = useCollection<{ sellerId?: string; id?: string }>(liveQuery);

  const shopsById = React.useMemo(() => {
    const map = new Map<string, SellerShop>();
    for (const shop of shops.data ?? []) map.set(shop.id, shop);
    return map;
  }, [shops.data]);

  const sellerNames = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, shop] of shopsById) map.set(id, shop.shopName);
    return map;
  }, [shopsById]);

  const liveSellerIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const session of liveSessions.data ?? []) {
      const id = session.sellerId ?? session.id;
      if (id) ids.add(id);
    }
    return ids;
  }, [liveSessions.data]);

  const sellerFor = React.useCallback(
    (listing: Product): DiscoverySeller => {
      const shop = shopsById.get(listing.sellerId);
      return {
        id: listing.sellerId,
        name: shop?.shopName || 'Vidnov Seller',
        avatarUrl: shop?.logoUrl || PLACEHOLDER_AVATAR,
        isVerified: !!shop?.isVerified,
        location: shop?.location || '',
        isLive: liveSellerIds.has(listing.sellerId),
      };
    },
    [shopsById, liveSellerIds],
  );

  const filtered = React.useMemo(() => {
    const listings = dedupeById(products.data ?? []);
    return filterListings(listings, filters, category, { sellerNames });
  }, [products.data, filters, category, sellerNames]);

  React.useEffect(() => {
    onResultCount?.(filtered.length);
  }, [filtered.length, onResultCount]);

  /* — which post is on screen — */

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLElement>('[data-video-post]');
    if (nodes.length === 0) {
      setActiveId(null);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            setActiveId(entry.target.getAttribute('data-video-post'));
          }
        }
      },
      { threshold: [0.55] },
    );
    nodes.forEach((node) => observer.observe(node));
    // Land on the first post rather than half a screen in.
    setActiveId(nodes[0].getAttribute('data-video-post'));
    return () => observer.disconnect();
  }, [filtered]);

  /* — details sheet — */

  const [details, setDetails] = React.useState<{
    listing: Product;
    seller: DiscoverySeller;
    sponsored: boolean;
  } | null>(null);

  const openDetails = (listing: Product) => {
    setDetails({ listing, seller: sellerFor(listing), sponsored: isSponsoredNow(listing) });
  };

  const loading = products.isLoading && products.data === null;
  const failed = !!products.error;

  return (
    <>
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <FeedSkeleton />
        ) : failed ? (
          <FeedMessage
            icon={AlertTriangle}
            title="Discovery could not load"
            body="The listings did not come through. Nothing is wrong with your account — try again."
            action={
              <button
                type="button"
                onClick={() => setAttempt((a) => a + 1)}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[color:var(--vn-discovery-accent)] px-5 text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            }
          />
        ) : category === 'live' ? (
          <div className="h-full overflow-y-auto">
            <DiscoveryLiveLane />
          </div>
        ) : (filtered.length === 0 || !filtered[0]) ? (
          <FeedMessage
            icon={Compass}
            title={filters.query.trim() ? 'No matches' : 'Nothing in this lane yet'}
            body={
              filters.query.trim()
                ? `Nothing matches “${filters.query.trim()}” with these filters. Try a wider search or clear the filters.`
                : 'Once sellers publish listings that fit, they show up here straight away. Try another lane in the meantime.'
            }
            action={
              <button
                type="button"
                onClick={() => setAttempt((a) => a + 1)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--vn-discovery-accent)] px-5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--vn-discovery-accent)] transition hover:bg-[color:var(--vn-discovery-accent)] hover:text-[#0A0A0A]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            }
          />
        ) : (
          <div
            ref={scrollRef}
            className="vn-discovery-snap h-full overflow-y-auto overscroll-y-contain"
          >
            {filtered.map((listing) => (
              <div
                key={listing.id}
                data-video-post={listing.id}
                className="relative h-full w-full snap-start"
              >
                <DiscoveryVideoPost
                  listing={listing}
                  seller={sellerFor(listing)}
                  sponsored={isSponsoredNow(listing)}
                  active={activeId === listing.id}
                  onOpenDetails={() => openDetails(listing)}
                  cover={ownCover ? ownCover(listing) : undefined}
                />
              </div>
            ))}

            <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
              <Compass className="h-6 w-6 text-[color:var(--vn-discovery-accent)]" aria-hidden />
              <p className="font-grotesk text-[15px] font-bold text-white">
                That is everything for now
              </p>
              <p className="max-w-xs text-[12px] leading-relaxed text-white/55">
                {products.data && products.data.length >= PAGE_SIZE
                  ? 'There is more to publish than this page holds — new listings appear at the top.'
                  : 'You have reached the end of this lane. Check back soon, or swipe to another lane above.'}
              </p>
            </div>
          </div>
        )}
      </div>

      <DiscoveryDetails
        listing={details?.listing ?? null}
        seller={details?.seller ?? null}
        sponsored={details?.sponsored ?? false}
        open={!!details}
        onOpenChange={(next) => {
          if (!next) setDetails(null);
        }}
      />
    </>
  );
}
