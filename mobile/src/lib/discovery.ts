import type { Product } from './types';

/**
 * DISCOVERY — the rules the feed and the shop panel share.
 *
 * Every helper here mirrors one in the website's `lib/discovery.ts`, because
 * the Android Discover tab is supposed to be the SAME section, not a lookalike:
 * the same catalogue, the same ordering, the same "is this really a service"
 * question answered the same way. Anything that is unknown stays empty rather
 * than being filled with a plausible-looking default.
 */

export type DiscoveryTab = 'discover' | 'themes' | 'shop';

/** What a Themes tile hands to Shop. Category values match the seller form. */
export type ThemeSeed = { category?: string; kind?: 'all' | 'product' | 'service' };

export type MediaItem = { key: string; type: 'video' | 'image'; url: string };

/** Firestore timestamps, ISO strings and epoch numbers all land here. */
export function toMs(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object') {
    const candidate = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
    if (typeof candidate.toMillis === 'function') {
      const ms = candidate.toMillis();
      return Number.isFinite(ms) ? ms : 0;
    }
    const seconds = candidate.seconds ?? candidate._seconds;
    if (typeof seconds === 'number') return seconds * 1000;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Newest first. Listings are written by the website, the seller dashboard and
 * older upload forms, so `uploadDate` may be a Timestamp, an ISO string or
 * absent — a listing with no date sorts last instead of vanishing.
 */
export function newestFirst(a: Product, b: Product): number {
  return toMs(b.uploadDate) - toMs(a.uploadDate);
}

export function isService(product: Product): boolean {
  return product.listingType === 'service' || product.priceMode === 'quote';
}

export function isOutOfStock(product: Product): boolean {
  if (product.availabilityState === 'out_of_stock' || product.availabilityState === 'fully_booked') {
    return true;
  }
  if (product.availabilityState) return false;
  return typeof product.stock === 'number' && product.stock <= 0 && !isService(product);
}

/** Videos first (they are what a feed is for), then the photos, deduped. */
export function mediaOf(product: Product): MediaItem[] {
  const items: MediaItem[] = [];
  const seen = new Set<string>();

  const push = (type: MediaItem['type'], url?: string | null) => {
    const value = (url ?? '').trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    items.push({ key: `${type}:${value}`, type, url: value });
  };

  for (const url of product.videoUrls ?? []) push('video', url);
  push('video', product.videoUrl);
  push('image', product.imageUrl);
  for (const url of product.imageUrls ?? []) push('image', url);

  return items;
}

/** The still image that stands in for a post while its video is not playing. */
export function coverOf(product: Product): string | undefined {
  return product.imageUrl || product.imageUrls?.[0] || undefined;
}

/** Real price only — a listing without one reads as a quote request. */
export function priceLabel(product: Product): string {
  if (product.priceMode === 'quote') return 'Ask for a quote';
  const amount = product.localPrice ?? product.price;
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return 'Ask for a quote';
  const currency = (product.localCurrency ?? '').toUpperCase();
  const value = amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return currency ? `${currency} ${value}` : value;
}

/** Percentage off, only when `wasPrice` is genuinely above the shown price. */
export function discountPercent(product: Product): number {
  const price = Number(product.localPrice ?? product.price ?? 0);
  const was = Number(product.wasPrice ?? 0);
  if (price > 0 && was > price) return Math.round(((was - price) / was) * 100);
  return 0;
}

export function availabilityLabel(product: Product): string {
  if (isService(product)) {
    return product.availabilityState === 'fully_booked' ? 'Fully booked' : '';
  }
  if (isOutOfStock(product)) return 'Out of stock';
  if (typeof product.stock === 'number' && product.stock > 0) {
    return product.stock <= 5 ? `Only ${product.stock} left` : 'In stock';
  }
  return '';
}

/** Categories the seller form actually writes — no invented taxonomy. */
export const EDITORIAL_THEMES: Array<{
  category: string;
  kicker: string;
  title: string;
  blurb: string;
  kind: 'product' | 'service';
}> = [
  {
    category: 'Fashion & Apparel',
    kicker: 'The new wardrobe',
    title: 'Fashion & Apparel',
    blurb: 'Pieces from sellers who photograph what they actually stock.',
    kind: 'product',
  },
  {
    category: 'Electronics & Gadgets',
    kicker: 'Built to last',
    title: 'Electronics & Gadgets',
    blurb: 'Phones, audio and accessories with real stock counts.',
    kind: 'product',
  },
  {
    category: 'Home & Living',
    kicker: 'Make it home',
    title: 'Home & Living',
    blurb: 'Furniture, decor and the small things that finish a room.',
    kind: 'product',
  },
  {
    category: 'Beauty & Personal Care',
    kicker: 'Rituals',
    title: 'Beauty & Personal Care',
    blurb: 'Everyday care from shops that ship.',
    kind: 'product',
  },
  {
    category: 'Art & Collectibles',
    kicker: 'Made by hand',
    title: 'Art & Collectibles',
    blurb: 'Original work, listed by the person who made it.',
    kind: 'product',
  },
  {
    category: 'Food & Groceries',
    kicker: 'Kitchen to table',
    title: 'Food & Groceries',
    blurb: 'Pantry staples and fresh produce from local sellers.',
    kind: 'product',
  },
  {
    category: 'plumbing',
    kicker: 'Fix it now',
    title: 'Trades & repairs',
    blurb: 'Plumbing, electrical and repairs',
    kind: 'service',
  },
  {
    category: 'cleaning',
    kicker: 'Reset the space',
    title: 'Cleaning & painting',
    blurb: 'Deep cleans, movers and painters',
    kind: 'service',
  },
  {
    category: 'tutoring',
    kicker: 'Learn something',
    title: 'Lessons & tutoring',
    blurb: 'Tutors for school, language and skills',
    kind: 'service',
  },
  {
    category: 'catering',
    kicker: 'Host it well',
    title: 'Catering & events',
    blurb: 'Food, decor and event crews',
    kind: 'service',
  },
];
