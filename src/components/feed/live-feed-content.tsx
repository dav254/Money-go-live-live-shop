'use client';

import * as React from 'react';
import { useCallback, useRef, useState, useEffect } from 'react';
import { useCollection, useMemoFirebase, useUserProfile } from '@/firebase';
import { collection, query, orderBy, limit, where, documentId } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { useFirestore, useUser } from '@/firebase';
import { RealtimeVideoCard } from '@/components/feed/realtime-video-card';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Search, ChevronLeft, Video, Loader2, Bookmark } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { isService } from '@/components/listings/service-badge';

/**
 * THE DISCOVERY FEED.
 *
 * Extracted from the seller's page so both surfaces can render it. The card,
 * the queries and the snap-scrolling were always the same; only the chrome
 * around them belonged to the seller. Keeping one implementation means a fix to
 * the feed lands on both, which is the whole reason `RealtimeVideoCard` lives
 * in `components/feed` rather than inside a page.
 *
 * ## Why `backHref` is a prop
 *
 * The chevron used to push `/dashboard/seller`, hard-coded. Rendering this same
 * feed for a buyer would have sent them into the SELLER workspace — a buyer
 * following "back" would land in a section they have no business being in, and
 * a buyer has no seller dashboard to return to at all.
 *
 * ## Saved view
 *
 * `?view=saved` filters to the signed-in user's own wishlist, so a buyer sees
 * their private collection here too. Firestore caps an `in` query at 30 values,
 * which is why the list is sliced rather than sent whole.
 *
 * ## `chrome={false}` — the app surfaces
 *
 * The website chrome is a back chevron, a search field that pushes to
 * `/search`, and a "Global Discovery" badge. None of that belongs inside the
 * installed app: it has its own header, and a search box that navigates out to
 * a website route is exactly the leak the app is supposed to stop having.
 *
 * So `chrome={false}` renders the scroller alone and the caller supplies its own
 * chrome. `className` then controls the height — `h-screen` is right on the
 * website, but inside the app shell the screen is already inset by a header
 * and a tab bar, so `h-screen` overflows by exactly that much.
 */
export function LiveFeedContent({
  backHref,
  chrome = true,
  className,
}: {
  backHref: string;
  chrome?: boolean;
  className?: string;
}) {
  /*
   * Where a card's SHOP button goes.
   *
   * `chrome={false}` is already this component's "I am inside an app shell"
   * signal, so it is the right thing to key the destination off rather than
   * sniffing the pathname: inside the app the buyer must stay in the app, and
   * on the website the product detail page is `/products/[productId]`.
   */
  const productHrefFor = useCallback(
    (productId: string) =>
      chrome ? `/products/${productId}` : `/app/buyer/product/${productId}`,
    [chrome],
  );

  /*
   * The drawer's "Buy now" target and its seller-link wording, same split.
   *
   * `checkoutHrefFor` takes the freshly created order id. Both surfaces now
   * HAVE a checkout — the website's `/checkout/[orderId]` and the app's
   * `/app/buyer/checkout/[orderId]` — so the id is used on both sides and the
   * app no longer drops the buyer back into the cart after an order exists.
   */
  const checkoutHrefFor = useCallback(
    (orderId: string) => (chrome ? `/checkout/${orderId}` : `/app/buyer/checkout/${orderId}`),
    [chrome],
  );
  const shopLinkLabel = chrome ? 'Visit Shop' : 'View product';

  /*
   * The rail's CHAT button.
   *
   * Both surfaces use `?chatWith=<sellerId>` — the website's ChatSystem already
   * reads that param, and the buyer messages screen was built to the same
   * contract — so only the base route differs between them.
   */
  const messageHrefFor = useCallback(
    (sellerId: string) =>
      `${chrome ? '/messages' : '/app/buyer/messages'}?chatWith=${encodeURIComponent(sellerId)}`,
    [chrome],
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [intersectingCard, setIntersectingCard] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const view = searchParams?.get('view') || 'all';
  const kind = searchParams?.get('kind') || 'all';

  const productsQuery = useMemoFirebase(() => {
    if (!firestore) return null;

    if (view === 'saved' && userProfile) {
      const wishlist = userProfile.wishlist || [];
      if (wishlist.length === 0) return null;
      return query(
        collection(firestore, 'products'),
        where(documentId(), 'in', wishlist.slice(0, 30)),
      );
    }

    return query(collection(firestore, 'products'), orderBy('uploadDate', 'desc'), limit(10));
  }, [firestore, view, userProfile]);

  const { data: allProducts, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

  /*
   * The Services filter is done here, in memory, not in the query.
   *
   * Firestore rules for `products` allow public read and there is no composite
   * index for "listingType == service, ordered by uploadDate" — adding one
   * would be a deploy. So the page fetches the same 10 newest listings it
   * always did and narrows them client-side.
   *
   * That is honest about its limits: it filters what is loaded, not the whole
   * marketplace. When the Services tab is worth a real index, this becomes a
   * `where('listingType', '==', 'service')` and nothing else moves.
   */
  const products = React.useMemo(() => {
    if (!allProducts) return allProducts;
    if (kind !== 'services') return allProducts;
    return allProducts.filter((p) => isService(p));
  }, [allProducts, kind]);
  const isLoading = isUserLoading || areProductsLoading || isProfileLoading;

  /*
   * No programmatic scroll. The up/down arrows in the action rail are gone —
   * a swipe is the natural gesture on a snapping pager, and a tap that jumps a
   * whole screen skipped past the product you were reading.
   */

  // Exactly one card is "current" at a time; only that one runs its player.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIntersectingCard(entry.target.getAttribute('data-product-id'));
          }
        });
      },
      { threshold: 0.7 },
    );

    const cards = container.querySelectorAll('[data-product-id]');
    cards.forEach((card) => observer.observe(card));

    return () => cards.forEach((card) => observer.unobserve(card));
  }, [products]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <Loader2 className="mr-3 h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-black uppercase tracking-widest text-white">
          Syncing Immersive Stream...
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-black',
        className ?? 'h-screen',
      )}
    >
      {chrome && (
        <div className="absolute left-0 right-0 top-0 z-50 flex items-center gap-2 bg-gradient-to-b from-black/80 to-transparent p-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-black/20 text-white hover:bg-black/40"
            onClick={() => router.push(backHref)}
            aria-label="Back"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <form onSubmit={handleSearchSubmit} className="mx-auto max-w-md flex-1">
            <div className="group relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70 transition-colors group-focus-within:text-primary" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={view === 'saved' ? 'Search your private collection...' : 'Search global discovery...'}
                className="h-10 rounded-full border-white/20 bg-white/10 pl-10 text-white backdrop-blur-md transition-all placeholder:text-white/50 focus:border-primary/50 focus:bg-white/20 md:h-11"
              />
            </div>
          </form>
          <div className="flex items-center gap-2">
            {/*
              Everything / Products / Services.

              A buyer who wants a plumber and a buyer who wants a sofa are on
              the same feed — that was the point of services — but they are
              looking for different things, so the two are one tap apart.
            */}
            <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1 md:flex">
              {([
                { key: 'all', label: 'All' },
                { key: 'products', label: 'Products' },
                { key: 'services', label: 'Services' },
              ] as const).map(chip => {
                const active = kind === chip.key;
                const onClick = () => {
                  const next = new URLSearchParams(searchParams?.toString() || '');
                  if (chip.key === 'all') next.delete('kind');
                  else next.set('kind', chip.key);
                  router.replace(`${pathname}?${next.toString()}`);
                };
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={onClick}
                    aria-pressed={active}
                    className={cn(
                      'h-7 rounded-full px-3 text-[9px] font-black uppercase tracking-widest transition',
                      active ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-white' : 'text-white/60 hover:text-white',
                    )}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
            <Badge
              variant="outline"
              className="hidden h-8 border-white/10 bg-black/40 px-3 text-[9px] font-black uppercase tracking-widest text-white md:flex"
            >
              {view === 'saved' ? 'My Private Collection' : 'Global Discovery'}
            </Badge>
          </div>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className={cn(
          'h-full w-full snap-y snap-mandatory overflow-y-scroll',
          '[&::-webkit-scrollbar]:hidden',
          'scrollbar-hide',
        )}
      >
        {products && products.length > 0 ? (
          products.map((product) => (
            <div
              key={product.id}
              data-product-id={product.id}
              className="h-full w-full flex-shrink-0 snap-start"
            >
              <RealtimeVideoCard
                product={product}
                isIntersecting={intersectingCard === product.id}
                productHref={productHrefFor(product.id)}
                shopLinkLabel={shopLinkLabel}
                checkoutHrefFor={checkoutHrefFor}
                messageHref={messageHrefFor(product.sellerId || '')}
              />
            </div>
          ))
        ) : (
          <div className="flex h-full w-full flex-shrink-0 snap-start items-center justify-center bg-neutral-950">
            <div className="max-w-sm p-8 text-center">
              <div className="mx-auto mb-6 w-fit rounded-full bg-white/5 p-4">
                {view === 'saved' ? (
                  <Bookmark className="h-10 w-10 text-neutral-500" />
                ) : (
                  <Video className="h-10 w-10 text-neutral-500" />
                )}
              </div>
              <h2 className="mb-2 text-xl font-black uppercase tracking-tight text-white">
                {view === 'saved'
                  ? 'My Saved Items are Empty'
                  : kind === 'services'
                    ? 'No services yet'
                    : 'Discovery Empty'}
              </h2>
              <p className="mb-8 text-sm font-medium leading-relaxed text-neutral-500">
                {view === 'saved'
                  ? 'This collection is private to you. Heart some items in the Discovery Feed to see them here.'
                  : kind === 'services'
                    ? "No services among the newest listings yet. Plumbers, electricians, cleaners, tutors — anyone can be the first. Post yours from the seller section."
                    : "We couldn't find any media to show right now. Check back later!"}
              </p>
              {kind === 'services' && view !== 'saved' && (
                <Button asChild className="h-12 rounded-xl text-xs font-black uppercase tracking-widest">
                  {/* Back to the unfiltered feed, not the website. */}
                  <Link href={pathname ?? backHref}>See everything</Link>
                </Button>
              )}
              {view === 'saved' && (
                <Button asChild className="h-12 rounded-xl text-xs font-black uppercase tracking-widest">
                  {/* The feed's own URL, whichever surface we are on. */}
                  <Link href={pathname ?? backHref}>Explore Discovery Feed</Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveFeedContent;