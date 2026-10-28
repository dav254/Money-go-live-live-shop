'use client';

/**
 * DISCOVERY — listing details.
 *
 * One component, two jobs: a product and a service are different purchases, but
 * they are the same document and the same drawer. Splitting them into two
 * screens is what makes a plumber's page say "In stock: 3", so the branches
 * live inside one panel and everything genuinely shared — seller attribution,
 * gallery, reviews, save, share, message — stays written once.
 *
 * ## What is real here
 * Cart and Buy Now write the same `userProfiles/{uid}/cart` and `orders`
 * documents the rest of the marketplace already uses, so an order placed from
 * Discovery is indistinguishable from one placed anywhere else. Reviews are the
 * real `products/{id}/reviews` documents — no invented ratings.
 *
 * ## What is deliberately absent
 * A booking calendar. There is no bookings collection in this project, and a
 * date picker that silently messages the seller instead of booking would be a
 * lie told in UI. "Book service" and "Request a quote" both open the real
 * conversation with the seller, which is how those jobs are actually done here.
 */

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bookmark, Check, ChevronLeft, ChevronRight, Loader2, MapPin, MessageCircle, Minus,
  Package, Plus, Share2, ShoppingBag, Star, Store, Truck, Verified,
} from 'lucide-react';
import {
  arrayRemove, arrayUnion, collection, doc, increment, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { mirrorCartItem } from '@/lib/users/mirror';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCollection, useFirestore, useUser, useMemoFirebase, useUserProfile } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/types';
import { isService } from '@/components/listings/service-badge';
import { availabilityLabel, isPurchasable, listingCover, listingMedia, timeAgo } from '@/lib/discovery';
import type { DiscoverySeller } from './discovery-video-post';

interface ReviewDoc {
  id: string;
  byCustomer?: {
    rating: number;
    text: string;
    authorName?: string;
    createdAt?: unknown;
    status?: string;
  };
}

function reviewMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const maybe = value as { toMillis?: () => number };
  if (typeof maybe?.toMillis === 'function') return maybe.toMillis();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

const panelClass = 'rounded-2xl border border-white/12 bg-white/6 p-4';
const headingClass = 'font-grotesk text-[11px] font-bold uppercase tracking-[0.18em] text-white/50';
const iconButtonClass =
  'flex h-9 w-9 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--vn-discovery-accent)]';

export function DiscoveryDetails({
  listing,
  seller,
  sponsored,
  related,
  open,
  onOpenChange,
}: {
  listing: Product | null;
  seller: DiscoverySeller | null;
  sponsored: boolean;
  /**
   * "You may also like" candidates, computed by the feed from the SAME
   * loaded pool it already shows — no extra query, no duplicate items, always
   * excluding the listing being viewed. Empty means the section is hidden.
   */
  related?: Product[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!listing || !seller) return null;
  return (
    <DetailsBody
      listing={listing}
      seller={seller}
      sponsored={sponsored}
      related={related ?? []}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}

function DetailsBody({
  listing,
  seller,
  sponsored,
  related = [],
  open,
  onOpenChange,
}: {
  listing: Product;
  seller: DiscoverySeller;
  sponsored: boolean;
  related?: Product[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const service = isService(listing);
  const media = React.useMemo(() => listingMedia(listing), [listing]);
  const [active, setActive] = React.useState(0);
  const current = media[Math.min(active, media.length - 1)];

  const { toast } = useToast();
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const router = useRouter();

  const [quantity, setQuantity] = React.useState(1);
  const [saved, setSaved] = React.useState(false);
  const [busy, setBusy] = React.useState<'cart' | 'buy' | null>(null);

  React.useEffect(() => {
    setActive(0);
    setQuantity(1);
  }, [listing.id]);

  React.useEffect(() => {
    setSaved(!!userProfile?.wishlist?.includes(listing.id));
  }, [userProfile, listing.id]);

  const reviewsQuery = useMemoFirebase(() => {
    if (!firestore || !open) return null;
    return collection(firestore, 'products', listing.id, 'reviews');
  }, [firestore, open, listing.id]);
  const { data: reviewDocs } = useCollection<ReviewDoc>(reviewsQuery);

  const reviews = React.useMemo(() => {
    const out: NonNullable<ReviewDoc['byCustomer']>[] = [];
    for (const doc of reviewDocs ?? []) {
      const review = doc.byCustomer;
      if (review && review.status === 'published') out.push(review);
    }
    out.sort((a, b) => reviewMillis(b.createdAt) - reviewMillis(a.createdAt));
    return out;
  }, [reviewDocs]);

  const averageRating = reviews.length
    ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length
    : null;

  const price = Number(listing.localPrice || listing.price || 0);
  const currency = listing.localCurrency || 'USD';
  const stock = Number(listing.stock ?? 0);
  const purchasable = isPurchasable(listing);
  const maxQuantity = service ? 1 : Math.max(1, Math.min(stock || 1, 20));
  /*
   * Surface-aware, like the feed post does it: whichever app shell this
   * discovery screen is rendered inside owns its own messages route, so a
   * buyer on /app/buyer/discovery must not be bounced to the standalone
   * /messages page (and vice versa).
   */
  const pathname = usePathname() ?? '';
  const messageHref = pathname.startsWith('/app/seller')
    ? `/app/seller/messages?chatWith=${encodeURIComponent(listing.sellerId)}`
    : pathname.startsWith('/app/buyer')
      ? `/app/buyer/messages?chatWith=${encodeURIComponent(listing.sellerId)}`
      : `/messages?chatWith=${encodeURIComponent(listing.sellerId)}`;

  const requireAuth = (message: string) => {
    toast({
      title: 'Sign in to continue',
      description: message,
      action: (
        <Button asChild size="sm" className="bg-[color:var(--vn-discovery-accent)] text-[#0A0A0A] hover:bg-[color:var(--vn-discovery-accent-hover)]">
          <Link href="/login?returnTo=%2Fbuyer%2Fdiscovery">Sign in</Link>
        </Button>
      ),
    });
  };

  const cover = current?.url ?? media[0]?.url ?? '';

  /*
   * Gallery browsing. Horizontal intent on a PHOTO steps through the seller's
   * uploads (swipe like the feed does); the video is left alone so a swipe
   * never fights its own controls. Arrow buttons cover desktop and anyone
   * who does not discover the swipe, and the n/N badge makes it visible that
   * there is more to see at all — previously only tiny dots hinted at it.
   */
  const dragStart = React.useRef<{ x: number; y: number } | null>(null);
  const onGalleryPointerDown = (e: React.PointerEvent) => {
    if (current?.type !== 'image') return;
    dragStart.current = { x: e.clientX, y: e.clientY };
  };
  const onGalleryPointerUp = (e: React.PointerEvent) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start || current?.type !== 'image') return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) < 40) return;
    stepGallery(dx < 0 ? 1 : -1);
  };
  const stepGallery = (delta: number) => {
    if (media.length <= 1) return;
    setActive((i) => (i + delta + media.length) % media.length);
  };

  const toggleSave = async () => {
    if (!user) return requireAuth('Saved items need an account so they follow you.');
    if (!firestore) return;
    const next = !saved;
    setSaved(next);
    try {
      await updateDoc(doc(firestore, 'userProfiles', user.uid), {
        wishlist: next ? arrayUnion(listing.id) : arrayRemove(listing.id),
      });
      toast({ title: next ? 'Saved' : 'Removed from saved' });
    } catch {
      setSaved(!next);
      toast({ variant: 'destructive', title: 'Could not update saved items' });
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/products/${listing.id}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: listing.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied', description: 'The listing link is on your clipboard.' });
    } catch {
      /* A dismissed share sheet is not an error. */
    }
  };

  const addToCart = async () => {
    if (!user) return requireAuth('Your cart needs an account so it is waiting for you.');
    if (!firestore) return;
    if (!purchasable) {
      toast({
        variant: 'destructive',
        title: 'Out of stock',
        description: 'This listing cannot be added to a cart right now.',
      });
      return;
    }
    setBusy('cart');
    try {
      await setDoc(
        doc(firestore, 'userProfiles', user.uid, 'cart', listing.id),
        {
          productId: listing.id,
          sellerId: listing.sellerId,
          buyerId: user.uid,
          name: listing.name,
          price,
          imageUrl: cover,
          quantity: increment(quantity),
          addedAt: serverTimestamp(),
        },
        { merge: true },
      );
      mirrorCartItem(user, listing.id);
      toast({ title: 'Added to cart', description: `${quantity} × ${listing.name}` });
    } catch {
      toast({ variant: 'destructive', title: 'Could not add to cart' });
    } finally {
      setBusy(null);
    }
  };

  const buyNow = async () => {
    if (!user) return requireAuth('Checkout needs an account to record your order.');
    if (!firestore) return;
    if (!purchasable) {
      toast({ variant: 'destructive', title: 'Unavailable', description: 'This listing cannot be purchased right now.' });
      return;
    }
    setBusy('buy');
    try {
      const orders = collection(firestore, 'orders');
      const ref = doc(orders);
      const shipping = Number(listing.shippingCost || 0);
      await setDoc(ref, {
        id: ref.id,
        buyerId: user.uid,
        sellerId: listing.sellerId,
        businessId: listing.businessId ?? null,
        productId: listing.id,
        productName: listing.name,
        productImage: cover,
        productPrice: price,
        quantity,
        subtotal: price * quantity,
        shippingCost: shipping,
        totalAmount: price * quantity + shipping,
        orderDate: serverTimestamp(),
        shippingAddress: '',
        orderStatus: 'pending',
        paymentMethod: 'pending',
      });
      toast({ title: 'Order created', description: 'Taking you to checkout…' });
      onOpenChange(false);
      router.push(`/checkout/${ref.id}`);
    } catch {
      toast({ variant: 'destructive', title: 'Could not create the order', description: 'Nothing was charged. Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  const place = listing.location || listing.vendorLocation || listing.serviceArea;
  const availability = availabilityLabel(listing);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="vn-discovery-scope h-[92dvh] gap-0 overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#0A0A0A] p-0 text-white sm:right-0 sm:h-full sm:max-w-md sm:rounded-none sm:border-l"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{listing.name}</SheetTitle>
        </SheetHeader>

        <div className="flex h-full flex-col">
          {/* Gallery */}
          <div className="relative shrink-0">            <div className="relative aspect-[4/5] w-full bg-black sm:aspect-square"
              onPointerDown={onGalleryPointerDown}
              onPointerUp={onGalleryPointerUp}
            >
              {current?.type === 'video' ? (
                <video
                  key={current.url}
                  src={current.url}
                  poster={current.poster}
                  controls
                  playsInline
                  controlsList="nodownload"
                  onContextMenu={(e) => e.preventDefault()}
                  /* Contain, not cover: on any phone or laptop the WHOLE
                     frame must be visible — cropping a product photo or a
                     clip to fill a box hides exactly what is for sale. */
                  className="h-full w-full bg-black object-contain"
                />
              ) : (
                <Image
                  src={cover || '/placeholder-image.svg'}
                  alt={listing.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 480px"
                  className="object-contain"
                  priority
                />
              )}

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close listing"
                className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--vn-discovery-accent)]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {sponsored && (
                <span className="absolute right-3 top-3 rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white backdrop-blur">
                  Sponsored
                </span>
              )}

              {media.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => stepGallery(-1)}
                    aria-label="Previous photo"
                    className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--vn-discovery-accent)]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepGallery(1)}
                    aria-label="Next photo"
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--vn-discovery-accent)]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white backdrop-blur">
                    {Math.min(active, media.length - 1) + 1} / {media.length}
                  </span>
                </>
              )}
            </div>

            {media.length > 1 && (
              <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 px-4">
                {media.map((m, i) => (
                  <button
                    key={m.url}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`Show item ${i + 1} of ${media.length}`}
                    aria-current={i === active}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      i === active ? 'w-6 bg-[color:var(--vn-discovery-accent)]' : 'w-1.5 bg-white/35',
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <div>
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-grotesk text-xl font-bold leading-tight text-white">{listing.name}</h2>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={toggleSave}
                    aria-pressed={saved}
                    aria-label={saved ? 'Remove from saved' : 'Save to wishlist'}
                    className={cn(
                      iconButtonClass,
                      saved ? 'border-[color:var(--vn-discovery-accent)] bg-[color:var(--vn-discovery-accent)] text-[#0A0A0A]' : 'border-white/15 bg-white/6 text-white',
                    )}
                  >
                    <Bookmark className={cn('h-4 w-4', saved && 'fill-current')} />
                  </button>
                  <button
                    type="button"
                    onClick={share}
                    aria-label="Share product"
                    className={cn(iconButtonClass, 'border-white/15 bg-white/6 text-white hover:border-white/40')}
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="font-grotesk text-2xl font-bold text-[color:var(--vn-discovery-accent)]">
                  {service && listing.priceMode === 'quote'
                    ? 'Get a quote'
                    : `${currency} ${price.toLocaleString()}`}
                </p>
                {typeof listing.wasPrice === 'number' && listing.wasPrice > price && (
                  <p className="text-sm text-white/45 line-through">
                    {currency} {listing.wasPrice.toLocaleString()}
                  </p>
                )}
                {service && listing.priceMode === 'hourly' && (
                  <span className="text-xs font-bold uppercase tracking-wider text-white/50">per hour</span>
                )}
              </div>

              {(availability || place) && (
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-wider text-white/55">
                  {availability && (
                    <span className={cn(availability === 'out of stock' && 'text-red-400')}>{availability}</span>
                  )}
                  {place && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" aria-hidden />
                      {place}
                    </span>
                  )}
                </p>
              )}
            </div>

            {listing.description && (
              <section>
                <h3 className={cn(headingClass, 'mb-1.5')}>Description</h3>
                <p className="whitespace-pre-line text-[13px] leading-relaxed text-white/80">
                  {listing.description}
                </p>
              </section>
            )}

            {service && (
              <section className="space-y-2 rounded-2xl border border-white/12 bg-white/6 p-4">
                <h3 className={headingClass}>Service details</h3>
                {listing.serviceArea && (
                  <p className="flex items-center gap-2 text-[13px] text-white">
                    <MapPin className="h-3.5 w-3.5 text-white/50" aria-hidden />
                    Covers {listing.serviceArea}
                  </p>
                )}
                {listing.availability && (
                  <p className="flex items-center gap-2 text-[13px] text-white">
                    <Check className="h-3.5 w-3.5 text-white/50" aria-hidden />
                    {listing.availability}
                  </p>
                )}
                {listing.includes && (
                  <p className="text-[13px] leading-relaxed text-white/80">
                    <span className="font-semibold">Includes:</span> {listing.includes}
                  </p>
                )}
              </section>
            )}

            {!service && (
              <section className="flex items-center justify-between rounded-2xl border border-white/12 bg-white/6 p-4">
                <div>
                  <h3 className={headingClass}>Quantity</h3>
                  <p className="mt-0.5 text-[12px] text-white/55">
                    {stock > 0 ? `${stock} in stock` : 'Out of stock'}
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/40 p-1">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white transition disabled:opacity-30 hover:bg-white/10"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold tabular-nums text-white">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                    disabled={quantity >= maxQuantity}
                    aria-label="Increase quantity"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white transition disabled:opacity-30 hover:bg-white/10"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </section>
            )}

            {listing.deliveryOptions && (
              <section className="space-y-2">
                <h3 className={headingClass}>Delivery &amp; pickup</h3>
                <div className="flex items-start gap-2 rounded-2xl border border-white/12 bg-white/6 p-4">
                  <Truck className="mt-0.5 h-4 w-4 shrink-0 text-white/50" aria-hidden />
                  <p className="text-[13px] leading-relaxed text-white/80">{listing.deliveryOptions}</p>
                </div>
              </section>
            )}

            {listing.variations && listing.variations.length > 0 && (
              <section className="space-y-3">
                <h3 className={headingClass}>Options</h3>
                {listing.variations.map((variation) => (
                  <div key={variation.name}>
                    <p className="mb-1.5 text-[12px] font-semibold text-white">{variation.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {variation.options.map((option) => (
                        <span
                          key={option}
                          className="rounded-full border border-white/15 bg-white/6 px-3 py-1 text-[11px] font-semibold text-white"
                        >
                          {option}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Seller */}
            <section className="rounded-2xl border border-white/12 bg-white/6 p-4">
              <h3 className={cn(headingClass, 'mb-3')}>Sold by</h3>
              <div className="flex items-center gap-3">
                <Link
                  href={`/sellers/${seller.id}`}
                  className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/20"
                >
                  <Image src={seller.avatarUrl} alt={seller.name} fill sizes="44px" className="object-cover" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/sellers/${seller.id}`}
                    className="font-grotesk flex items-center gap-1.5 text-[14px] font-bold text-white hover:underline"
                  >
                    <span className="truncate">{seller.name}</span>
                    {seller.isVerified && <Verified className="h-3.5 w-3.5 shrink-0 text-[#2D9CFF]" aria-label="Verified" />}
                  </Link>
                  {seller.location && <p className="truncate text-[11px] text-white/55">{seller.location}</p>}
                </div>
                <Link
                  href={`/sellers/${seller.id}`}
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/20 px-3 text-[10px] font-bold uppercase tracking-wider text-white transition hover:border-[color:var(--vn-discovery-accent)] hover:text-[color:var(--vn-discovery-accent)]"
                >
                  <Store className="h-3.5 w-3.5" />
                  Store
                </Link>
              </div>

              {/* The direct line to the seller. Labeled, full-width and above
                  the fold of the sheet — an icon-only circle in the action bar
                  was too easy to miss for buyers who arrived wanting to ask a
                  question. Hidden on your own listing: you do not chat with
                  yourself. */}
              {user?.uid !== listing.sellerId && (
                <Link
                  href={messageHref}
                  className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[color:var(--vn-discovery-accent)] text-[11px] font-bold uppercase tracking-wider text-[color:var(--vn-discovery-accent)] transition hover:bg-[color:var(--vn-discovery-accent)] hover:text-[#0A0A0A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--vn-discovery-accent)]"
                >
                  <MessageCircle className="h-4 w-4" />
                  Chat with seller
                </Link>
              )}
            </section>

            {/* You may also like — real listings from the same loaded pool.
                Every card links to the existing product route, so variants,
                stock checks and the purchase flow are untouched. */}
            {related.length > 0 && (
              <section>
                <h3 className={cn(headingClass, 'mb-2')}>You may also like</h3>
                <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                  {related.map((item) => {
                    const itemPrice = Number(item.localPrice || item.price || 0);
                    return (
                      <Link
                        key={item.id}
                        href={`/products/${item.id}`}
                        className="vn-discovery-card w-32 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--vn-cyan)]"
                      >
                        <div className="relative h-24 w-full bg-black">
                          <Image
                            src={listingCover(item) || '/placeholder-image.svg'}
                            alt={item.name}
                            fill
                            sizes="128px"
                            className="object-cover"
                          />
                        </div>
                        <div className="p-2">
                          <p className="truncate text-[11px] font-bold text-white">{item.name}</p>
                          <p className="truncate text-[11px] font-bold text-[color:var(--vn-discovery-accent)]">
                            {item.localCurrency || 'USD'} {itemPrice.toLocaleString()}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Reviews */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className={headingClass}>Customer reviews</h3>
                {averageRating !== null && (
                  <span className="flex items-center gap-1 text-[12px] font-bold text-white">
                    <Star className="h-3.5 w-3.5 fill-[color:var(--vn-discovery-accent)] text-[color:var(--vn-discovery-accent)]" aria-hidden />
                    {averageRating.toFixed(1)}
                    <span className="font-normal text-white/50">({reviews.length})</span>
                  </span>
                )}
              </div>

              {reviews.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-[12px] text-white/50">
                  No reviews for this seller yet. Reviews are only written by buyers who actually
                  received an order.
                </p>
              ) : (
                <ul className="space-y-2">
                  {reviews.slice(0, 6).map((review, i) => (
                    <li key={i} className="rounded-2xl border border-white/12 bg-white/6 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-bold text-white">{review.authorName || 'Verified buyer'}</p>
                        <span className="flex items-center gap-0.5 text-[11px] font-bold text-white">
                          <Star className="h-3 w-3 fill-[color:var(--vn-discovery-accent)]" aria-hidden />
                          {Number(review.rating) || 0}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-white/80">{review.text}</p>
                      {review.createdAt ? (
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-white/45">
                          {timeAgo(reviewMillis(review.createdAt))}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Sticky actions */}
          <div className="shrink-0 border-t border-white/10 bg-[#0A0A0A] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-2">
              <Link
                href={messageHref}
                aria-label="Message the seller"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-[color:var(--vn-discovery-accent)] hover:text-[color:var(--vn-discovery-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--vn-discovery-accent)]"
              >
                <MessageCircle className="h-4 w-4" />
              </Link>

              {service ? (
                <>
                  <Button
                    asChild
                    className="h-11 flex-1 rounded-full bg-white/10 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-white/16"
                  >
                    <Link href={messageHref}>
                      <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                      Request a quote
                    </Link>
                  </Button>
                  <Button
                    asChild
                    className="h-11 flex-1 rounded-full bg-[color:var(--vn-discovery-accent)] text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A] hover:bg-[color:var(--vn-discovery-accent-hover)]"
                  >
                    <Link href={messageHref}>
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      Book service
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => void addToCart()}
                    disabled={busy !== null || !purchasable}
                    className="h-11 flex-1 rounded-full bg-white/10 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-white/16 disabled:opacity-40"
                  >
                    {busy === 'cart' ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Add to cart
                  </Button>
                  <Button
                    onClick={() => void buyNow()}
                    disabled={busy !== null || !purchasable}
                    className="h-11 flex-1 rounded-full bg-[color:var(--vn-discovery-accent)] text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A] hover:bg-[color:var(--vn-discovery-accent-hover)] disabled:opacity-40"
                  >
                    {busy === 'buy' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    <Package className="mr-1.5 h-3.5 w-3.5" />
                    Buy now
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
