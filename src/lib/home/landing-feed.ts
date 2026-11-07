/**
 * HOMEPAGE FEED — real businesses and listings for the public landing page.
 *
 * ## Why this module exists
 *
 * The landing page previously rendered stand-in arrays of invented businesses
 * and products. The homepage brief is explicit: never invent businesses,
 * prices or statistics — show genuine, eligible records or an honest empty
 * state.
 *
 * ## Read order (the platform convention)
 *
 *   1. **PocketBase on the VPS** — `seller_shops` and `products` are mirrored
 *      there, and on the production VPS this is the copy that survives even
 *      when Firestore is unreachable. These helpers never throw; they return
 *      `null` when PocketBase is not configured.
 *   2. **Firestore** — `searchDiscover()`, the same eligibility gate
 *      (`isCompleteBusinessProfile` / `isPublishedListing`) that powers
 *      `/discover`, so the homepage can never show a business the discovery
 *      surface would hide.
 *
 * Nothing here invents a field: no ratings, no review counts, no discounts, no
 * "sold" numbers. Missing data is omitted and the card renders without it.
 */

import { db } from '@/firebase/server';
import { searchDiscover, type DiscoverBusiness, type DiscoverListing } from '@/lib/discover/search';
import { pbListAllProducts } from '@/lib/pocketbase/products';
import { pbListShops } from '@/lib/pocketbase/shops';

/** A stray slow read must never hold the homepage HTML hostage. */
const FEED_TIMEOUT_MS = 2500;
const CARD_LIMIT = 8;
const READ_LIMIT = 48;

export interface LandingBusiness {
  id: string;
  name: string;
  category?: string;
  location?: string;
  description?: string;
  imageUrl?: string;
  href: string;
  verified: boolean;
}

export interface LandingListing {
  id: string;
  kind: 'product' | 'service';
  name: string;
  category?: string;
  imageUrl?: string;
  /** Formatted from the document's own price — never a default. */
  priceLabel?: string;
  sellerName?: string;
  href: string;
  /** Server-provided paid placement label; never a ranking change. */
  sponsored: boolean;
}

export interface LandingFeed {
  businesses: LandingBusiness[];
  listings: LandingListing[];
  /** False when every read failed, so the UI can say "try again" honestly. */
  reachable: boolean;
}

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('landing feed read timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** ISO code or symbol, formatted by Intl; falls back to a plain joined label. */
export function formatPrice(value: number, currency?: string): string | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  const code = (currency ?? 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  } catch {
    return `${code} ${value.toLocaleString('en-US')}`;
  }
}

/** The product page's own convention: `localPrice || price`, `localCurrency || USD`. */
function listingPriceLabel(
  data: Record<string, unknown>,
  price?: number,
): string | undefined {
  if (str(data.priceMode) === 'quote') return 'Get a quote';
  const localPrice = data.localPrice;
  const value = typeof localPrice === 'number' ? localPrice : price;
  if (typeof value !== 'number') return undefined;
  const currency =
    str(data.localCurrency) ?? str(data.currency) ?? undefined;
  return formatPrice(value, currency);
}

function listingKind(data: Record<string, unknown>, column?: string): 'product' | 'service' {
  return (column ?? str(data.listingType)) === 'service' ? 'service' : 'product';
}

/** PocketBase `seller_shops` → cards. Null when the store is off or failed. */
async function businessesFromStore(): Promise<LandingBusiness[] | null> {
  const shops = await pbListShops(READ_LIMIT);
  if (!shops) return null;
  return shops
    .map((shop) => {
      const data = shop.data ?? {};
      const name = shop.shopName ?? str(data.shopName) ?? str(data.name);
      if (!name) return null;
      const location = [shop.cityTown, shop.county]
        .map((part) => str(part))
        .filter((part): part is string => Boolean(part))
        .join(', ');
      const card: LandingBusiness = {
        id: shop.id,
        name,
        category: str(shop.category) ?? str(data.category),
        location: location || str(data.location),
        description: str(data.description) ?? str(data.tagline),
        imageUrl: str(shop.logoUrl) ?? str(data.logoUrl) ?? str(data.bannerUrl),
        href: `/sellers/${shop.id}`,
        // Only a status the document actually carries counts as verified.
        verified: str(data.verificationStatus) === 'verified' || data.verified === true,
      };
      return card;
    })
    .filter((card): card is LandingBusiness => card !== null)
    .slice(0, CARD_LIMIT);
}

/** PocketBase `products` → cards, honouring the same published gate as discovery. */
async function listingsFromStore(): Promise<LandingListing[] | null> {
  const rows = await pbListAllProducts(READ_LIMIT);
  if (!rows) return null;

  const shops = (await pbListShops(READ_LIMIT)) ?? [];
  const shopNames = new Map<string, string>();
  for (const shop of shops) {
    const name = shop.shopName ?? str(shop.data?.shopName) ?? str(shop.data?.name);
    if (name) shopNames.set(shop.id, name);
  }

  const seen = new Set<string>();
  const cards: LandingListing[] = [];
  for (const row of rows) {
    const data = row.data ?? {};
    // An admin-unpublished listing is not discoverable anywhere on the site.
    if (data.unpublished === true) continue;
    const name = row.name ?? str(data.name);
    if (!name || seen.has(row.id)) continue;
    seen.add(row.id);
    const kind = listingKind(data, row.listingType);
    cards.push({
      id: row.id,
      kind,
      name,
      category: str(row.category) ?? str(data.category),
      imageUrl: str(row.imageUrl) ?? str(data.imageUrl),
      priceLabel: listingPriceLabel(data, row.price),
      sellerName: row.sellerId ? shopNames.get(row.sellerId) : undefined,
      href: `/products/${row.id}`,
      sponsored: data.sponsored === true,
    });
    if (cards.length >= CARD_LIMIT) break;
  }
  return cards;
}

function businessFromDiscover(item: DiscoverBusiness): LandingBusiness {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    location: item.location,
    description: item.description,
    imageUrl: item.logoUrl,
    href: item.shopHref,
    verified: item.verified,
  };
}

function listingFromDiscover(item: DiscoverListing): LandingListing {
  const price =
    item.priceMode === 'quote'
      ? 'Get a quote'
      : typeof (item.localPrice ?? item.price) === 'number'
        ? formatPrice(
            (item.localPrice ?? item.price) as number,
            item.localCurrency,
          )
        : undefined;
  return {
    id: item.id,
    kind: item.kind,
    name: item.name,
    category: item.category,
    imageUrl: item.imageUrl,
    priceLabel: price,
    sellerName: item.sellerName,
    href: item.href,
    sponsored: item.sponsored,
  };
}

async function fromFirestore(): Promise<{
  businesses: LandingBusiness[];
  listings: LandingListing[];
}> {
  const [businessPage, listingPage] = await withTimeout(
    Promise.all([
      searchDiscover(db, {
        q: '',
        kind: 'businesses',
        availability: 'any',
        sort: 'relevance',
        page: 1,
        limit: CARD_LIMIT,
      }),
      searchDiscover(db, {
        q: '',
        kind: 'listings',
        availability: 'any',
        sort: 'newest',
        page: 1,
        limit: CARD_LIMIT,
      }),
    ]),
    FEED_TIMEOUT_MS,
  );

  return {
    businesses: businessPage.items
      .filter((item): item is DiscoverBusiness => item.kind === 'business')
      .map(businessFromDiscover),
    listings: listingPage.items
      .filter((item): item is DiscoverListing => item.kind !== 'business')
      .map(listingFromDiscover),
  };
}

/**
 * Real businesses and listings for the landing page.
 *
 * Never throws: a failed read renders the designed empty state with an
 * invitation to register, never fabricated cards.
 */
export async function loadLandingFeed(): Promise<LandingFeed> {
  let reachable = false;

  try {
    const [storedBusinesses, storedListings] = await withTimeout(
      Promise.all([businessesFromStore(), listingsFromStore()]),
      FEED_TIMEOUT_MS,
    );

    if (storedBusinesses !== null || storedListings !== null) {
      reachable = true;
      const businesses = storedBusinesses ?? [];
      const listings = storedListings ?? [];
      // The VPS answered, but a mirror can lag. Only consult Firestore for the
      // half that came back empty, so a healthy VPS never pays for a second read.
      if (businesses.length === 0 || listings.length === 0) {
        try {
          const firestore = await fromFirestore();
          return {
            businesses: businesses.length > 0 ? businesses : firestore.businesses,
            listings: listings.length > 0 ? listings : firestore.listings,
            reachable: true,
          };
        } catch {
          return { businesses, listings, reachable };
        }
      }
      return { businesses, listings, reachable };
    }
  } catch {
    // Fall through to Firestore.
  }

  try {
    const firestore = await fromFirestore();
    return { ...firestore, reachable: true };
  } catch {
    return { businesses: [], listings: [], reachable };
  }
}
