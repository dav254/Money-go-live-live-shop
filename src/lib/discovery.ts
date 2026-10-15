/**
 * DISCOVERY — shared vocabulary.
 *
 * The section at `/buyer/discovery` is one screen wearing nine hats (For You,
 * Products, Services, Businesses, Nearby, Live, New Arrivals, Popular,
 * Sponsored). Each hat is a different *query* over the same `products`
 * collection, so the category list, the filters and the sorting live here and
 * the components stay about rendering.
 *
 * Everything in this file is pure. No Firestore, no hooks, no JSX — which is
 * what lets the same filter run on a product card, in the details sheet and in
 * a test without dragging React along.
 */

import type { LucideIcon } from 'lucide-react';
import {
  BriefcaseBusiness,
  Clock,
  MapPin,
  Megaphone,
  Radio,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
} from 'lucide-react';

import type { Product } from '@/lib/types';
import { isService, listingPriceDisplay } from '@/components/listings/service-badge';

/* ── Categories ─────────────────────────────────────────────────────────── */

export type DiscoveryCategoryId =
  | 'for-you'
  | 'products'
  | 'services'
  | 'businesses'
  | 'nearby'
  | 'live'
  | 'new'
  | 'popular'
  | 'sponsored';

export interface DiscoveryCategory {
  id: DiscoveryCategoryId;
  label: string;
  icon: LucideIcon;
  /** One word of context for the empty state and the section sub-head. */
  blurb: string;
}

/**
 * In the order the spec asks for. The icons are the spec's icons, one-to-one —
 * a category with no icon reads as a filter, not a place.
 */
export const DISCOVERY_CATEGORIES: DiscoveryCategory[] = [
  { id: 'for-you', label: 'For You', icon: Sparkles, blurb: 'Everything sellers have published, newest first.' },
  { id: 'products', label: 'Products', icon: ShoppingBag, blurb: 'Physical goods in stock right now.' },
  { id: 'services', label: 'Services', icon: BriefcaseBusiness, blurb: 'Trades and professionals, bookable or by quote.' },
  { id: 'businesses', label: 'Businesses', icon: Store, blurb: 'The shops and studios behind the listings.' },
  { id: 'nearby', label: 'Nearby', icon: MapPin, blurb: 'Listings around the area you choose.' },
  { id: 'live', label: 'Live', icon: Radio, blurb: 'Businesses broadcasting right now.' },
  { id: 'new', label: 'New Arrivals', icon: Clock, blurb: 'The freshest listings on Vidnov.' },
  { id: 'popular', label: 'Popular', icon: TrendingUp, blurb: 'What everyone is liking and buying.' },
  { id: 'sponsored', label: 'Sponsored', icon: Megaphone, blurb: 'Paid placements, clearly labelled.' },
];

export function categoryById(id: string | null | undefined): DiscoveryCategory {
  return DISCOVERY_CATEGORIES.find((c) => c.id === id) ?? DISCOVERY_CATEGORIES[0];
}

/* ── Media ──────────────────────────────────────────────────────────────── */

export interface DiscoveryMedia {
  url: string;
  type: 'video' | 'image';
  poster?: string;
}

/**
 * True when an `<img>` (or a `<video poster>`) can actually paint this URL.
 *
 * Legacy publishes saved the video file itself into `videoThumbnailUrls` —
 * the upload form fell back to the clip's own URL whenever the real thumbnail
 * was not at hand. An image pointed at an `.mp4` never renders, so the feed
 * showed a broken-image icon over black, which reads as a crashed video.
 */
function isDisplayableImage(url: string): boolean {
  if (!url || url.startsWith('blob:')) return false;
  return !/\.(mp4|webm|mov|m4v|avi|mkv)(\?|#|$)/i.test(url);
}

/**
 * Every piece of media a listing owns, de-duplicated, videos first.
 *
 * A listing with no media at all still returns one entry — the placeholder —
 * so no card can ever render as a blank rectangle.
 */
export function listingMedia(product: Product | null | undefined): DiscoveryMedia[] {
  if (!product) return [];
  const media: DiscoveryMedia[] = [];
  const posters = product.videoThumbnailUrls ?? [];
  const push = (url: string | undefined | null, type: DiscoveryMedia['type'], poster?: string) => {
    const clean = typeof url === 'string' ? url.trim() : '';
    if (!clean) return;
    if (media.some((m) => m.url === clean)) return;
    media.push({ url: clean, type, poster });
  };

  push(product.videoUrl, 'video', posters[0]);
  (product.videoUrls ?? []).forEach((url, i) => push(url, 'video', posters[i]));
  push(product.imageUrl, 'image');
  (product.imageUrls ?? []).forEach((url) => push(url, 'image'));

  // A poster survives only if it is a real image that is not one of the
  // clips: a poster pointing at the video itself made the feed mark the
  // video as failed (they share one URL), blanking the whole post.
  const videoUrls = new Set(media.filter((m) => m.type === 'video').map((m) => m.url));
  for (const item of media) {
    if (item.type !== 'video' || !item.poster) continue;
    const poster = item.poster.trim();
    item.poster =
      poster && poster !== item.url && !videoUrls.has(poster) && isDisplayableImage(poster)
        ? poster
        : undefined;
  }

  if (media.length === 0) {
    // Local, always-served placeholder: discovery must never depend on an
    // external image host (picsum) that can be blocked or rate-limited.
    media.push({
      url: '/placeholder-image.svg',
      type: 'image',
    });
  }
  return media;
}

/** The single cover image a card should show. */
export function listingCover(product: Product | null | undefined): string {
  const media = listingMedia(product);
  const image = media.find((m) => m.type === 'image');
  if (image) return image.url;
  // Never hand an `<img>` a video URL — a video-only listing without a
  // poster falls back to the local placeholder instead of a broken icon.
  return media[0]?.poster ?? '/placeholder-image.svg';
}

/**
 * Cover image for a seller-facing view of their own listings.
 *
 * A seller looking at their own feed must never see the demo/picsum placeholder
 * on a product they have not yet photographed — that reads as if they uploaded a
 * stock image, which is the exact confusion this helper prevents.
 *
 * It returns the same real uploaded cover `listingCover` does, but when a listing
 * has no images at all it returns an empty string so the card renders a clean
 * "no image" state instead of a demo picture.
 */
export function sellerListingCover(product: Product | null | undefined): string {
  const media = listingMedia(product);
  const image = media.find((m) => m.type === 'image');
  if (image) return image.url;
  // Same rule as listingCover: a clip is never an image source. '' keeps the
  // seller-facing "no image yet" state this helper exists for.
  return media[0]?.poster ?? '';
}

/** True when this listing should be rendered as an immersive video post. */
export function hasPlayableVideo(product: Product | null | undefined): boolean {
  return listingMedia(product).some((m) => m.type === 'video');
}

/* ── Price & availability ───────────────────────────────────────────────── */

export interface PriceTag {
  /** A quote-based service must never render a number — see `service-badge`. */
  quote: boolean;
  primary: string;
  /** `/hr` and the like. */
  secondary?: string;
}

export function listingPriceTag(product: Product | null | undefined): PriceTag {
  const display = listingPriceDisplay(product);
  if (!display) return { quote: false, primary: 'Price on request' };
  if (display.kind === 'quote') return { quote: true, primary: display.label };

  const amount = display.amount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
  if (display.kind === 'hourly') {
    return { quote: false, primary: `${display.currency} ${amount}`, secondary: '/hr' };
  }
  return { quote: false, primary: `${display.currency} ${amount}` };
}

/** Numeric price used by the price-range filter. Quote listings are excluded. */
export function listingPriceValue(product: Product): number | null {
  const display = listingPriceDisplay(product);
  if (!display || display.kind === 'quote') return null;
  return Number(display.amount) || null;
}

/**
 * "Available" means a customer can actually act on it.
 *
 * A service is never out of stock — it has no stock — but it can be fully
 * booked, which is the one service state that blocks a booking.
 */
export function isPurchasable(product: Product): boolean {
  if (isService(product)) return product.availabilityState !== 'fully_booked';
  if (product.availabilityState === 'out_of_stock') return false;
  return Number(product.stock ?? 0) > 0;
}

export function availabilityLabel(product: Product): string | null {
  if (product.availabilityState) {
    return product.availabilityState.replace(/_/g, ' ');
  }
  if (isService(product)) return null;
  const stock = Number(product.stock ?? 0);
  if (stock <= 0) return 'out of stock';
  if (stock <= 5) return `only ${stock} left`;
  return 'in stock';
}

/* ── Seller & place ─────────────────────────────────────────────────────── */

/**
 * Where a listing is, for the Nearby filter.
 *
 * Three fields because sellers fill in three different ones depending on
 * whether they think of themselves as a shop, a delivery radius or a trade.
 * A service's `serviceArea` counts: "covers Nairobi West" is a place a buyer
 * can be near.
 */
export function listingPlace(product: Product): string {
  return (
    product.location?.trim()
    || product.vendorLocation?.trim()
    || product.serviceArea?.trim()
    || ''
  );
}

export function isNearPlace(product: Product, place: string): boolean {
  const wanted = place.trim().toLowerCase();
  if (!wanted) return true;
  const own = listingPlace(product).toLowerCase();
  if (!own) return false;
  return own.includes(wanted) || wanted.includes(own);
}

/* ── Time ───────────────────────────────────────────────────────────────── */

/** Epoch ms of a listing's creation, or 0 when it cannot be resolved. */
export function createdMs(product: Product): number {
  const value: unknown = product.uploadDate ?? (product as { createdAt?: unknown }).createdAt;
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const maybe = value as { toMillis?: () => number };
  if (typeof maybe.toMillis === 'function') {
    try {
      return maybe.toMillis();
    } catch {
      return 0;
    }
  }
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function timeAgo(ms: number): string {
  if (!ms) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/* ── Sponsored ──────────────────────────────────────────────────────────── */

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Is this placement still paid for?
 *
 * A campaign that has lapsed must stop appearing as sponsored immediately —
 * showing an expired placement as an ad is lying to the customer about who
 * paid for their attention. An absent `promotedUntil` deliberately never
 * expires, so a placement bought before the field existed does not silently
 * revert to organic.
 */
export function isSponsoredNow(product: Product, now = Date.now()): boolean {
  if (!product.sponsored) return false;
  const until = product.promotedUntil;
  if (until === null || until === undefined || until === '') return true;
  const ms = until instanceof Date
    ? until.getTime()
    : typeof until === 'number'
      ? until
      : typeof until === 'object' && until !== null && 'toMillis' in until
        ? (until as { toMillis: () => number }).toMillis()
        : Date.parse(String(until));
  if (!Number.isFinite(ms)) return true;
  return ms > now;
}

/* ── Filters ────────────────────────────────────────────────────────────── */

export type DiscoverySort = 'newest' | 'popular';

export interface DiscoveryFilters {
  /** Free text over name, brand, description, tags and seller name. */
  query: string;
  /** '' means anywhere. */
  location: string;
  minPrice: number | null;
  maxPrice: number | null;
  /** Hide listings a customer cannot buy right now. */
  availableOnly: boolean;
  sort: DiscoverySort;
}

export const EMPTY_FILTERS: DiscoveryFilters = {
  query: '',
  location: '',
  minPrice: null,
  maxPrice: null,
  availableOnly: false,
  sort: 'newest',
};

export function hasActiveFilters(filters: DiscoveryFilters): boolean {
  return (
    filters.query.trim() !== ''
    || filters.location.trim() !== ''
    || filters.minPrice !== null
    || filters.maxPrice !== null
    || filters.availableOnly
    || filters.sort !== 'newest'
  );
}

export function activeFilterCount(filters: DiscoveryFilters): number {
  let n = 0;
  if (filters.query.trim()) n += 1;
  if (filters.location.trim()) n += 1;
  if (filters.minPrice !== null || filters.maxPrice !== null) n += 1;
  if (filters.availableOnly) n += 1;
  if (filters.sort !== 'newest') n += 1;
  return n;
}

export function matchesQuery(product: Product, sellerName: string, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    product.name,
    product.brand,
    product.description,
    product.tags,
    product.category,
    product.serviceCategory,
    listingPlace(product),
    sellerName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

export interface FilterContext {
  /** sellerId → business name, so search can match on the shop, not just the listing. */
  sellerNames: Map<string, string>;
}

/**
 * The single filter/sort pipeline. Every category runs through it, so two
 * screens can never disagree about what "in stock" or "newest" means.
 */
export function filterListings(
  listings: Product[],
  filters: DiscoveryFilters,
  category: DiscoveryCategoryId,
  ctx: FilterContext,
): Product[] {
  const now = Date.now();
  const weekAgo = now - FOURTEEN_DAYS_MS;

  const out = listings.filter((product) => {
    if (!product?.id || !product.name) return false;

    switch (category) {
      case 'products':
        if (isService(product)) return false;
        break;
      case 'services':
        if (!isService(product)) return false;
        break;
      case 'nearby':
        if (!listingPlace(product)) return false;
        if (!isNearPlace(product, filters.location)) return false;
        break;
      case 'new':
        if (createdMs(product) < weekAgo) return false;
        break;
      case 'sponsored':
        if (!isSponsoredNow(product, now)) return false;
        break;
      default:
        break;
    }

    if (!matchesQuery(product, ctx.sellerNames.get(product.sellerId) ?? '', filters.query)) {
      return false;
    }
    if (filters.location.trim() && !isNearPlace(product, filters.location)) return false;
    if (filters.availableOnly && !isPurchasable(product)) return false;

    const price = listingPriceValue(product);
    if (filters.minPrice !== null && (price === null || price < filters.minPrice)) return false;
    if (filters.maxPrice !== null && (price === null || price > filters.maxPrice)) return false;

    return true;
  });

  const sponsoredFirst = (a: Product, b: Product) =>
    Number(isSponsoredNow(b, now)) - Number(isSponsoredNow(a, now));

  if (category === 'popular' || filters.sort === 'popular') {
    return out.sort((a, b) => {
      const byEngagement =
        (b.likes ?? 0) + (b.salesCount ?? 0) * 5 + (b.viewCount ?? 0) / 10
        - ((a.likes ?? 0) + (a.salesCount ?? 0) * 5 + (a.viewCount ?? 0) / 10);
      return byEngagement || sponsoredFirst(a, b) || createdMs(b) - createdMs(a);
    });
  }

  return out.sort((a, b) => sponsoredFirst(a, b) || createdMs(b) - createdMs(a));
}

/**
 * Cover image for a seller-facing view of their own listings (example usage).
 *
 * @example
 * ```ts
 * import { sellerListingCover } from '@/lib/discovery';
 * const cover = sellerListingCover(listing); // '' when nothing uploaded yet
 * ```
 */

/**
 * Drop a listing the same session has already shown.
 *
 * A seller with one product promoted in two categories, or a feed that reloads
 * after a filter change, would otherwise repeat the same card down the page —
 * which is the single most obvious way a feed looks broken.
 */
export function dedupeById(listings: Product[]): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const listing of listings) {
    if (seen.has(listing.id)) continue;
    seen.add(listing.id);
    out.push(listing);
  }
  return out;
}
