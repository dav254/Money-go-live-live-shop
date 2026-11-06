/**
 * VIDNOV DISCOVER — server-side discovery over the EXISTING marketplace data.
 *
 * ## What it reads (and what it deliberately does not)
 *
 *   • `products`      — the only listing collection. A service is a product
 *                       document with `listingType: 'service'`; there is no
 *                       separate services collection to duplicate.
 *   • `businesses`    — the trading entity, already modelled in
 *                       `@/lib/business/types`. Deny-by-default in
 *                       `firestore.rules`, so it is only readable from the
 *                       server (this module, via the Admin SDK).
 *   • `userProfiles`  — the seller account. `userRole` + `status` decide
 *                       eligibility.
 *   • `sellerShops`   — the public shop. Its existence is what makes
 *                       `/sellers/{id}` a real destination, so a business card
 *                       is never a link to nowhere.
 *
 * Nothing here creates a collection, a seller or a listing. It is a read
 * surface with an eligibility gate in front of it.
 *
 * ## Bounds
 *
 * Firestore has no substring index, so search is: bounded candidate window →
 * in-memory rank → page slice. Every read is capped (`DISCOVER_WINDOW`,
 * `BUSINESS_WINDOW`) and the response says so (`scanned`, `windowCapped`)
 * instead of pretending the marketplace is smaller than it is.
 *
 * ## Honesty rules encoded here
 *
 *   • verification ≠ completeness. `verificationStatus` is displayed and never
 *     gates; a complete profile is what makes a business discoverable.
 *   • a sponsored listing gets a LABEL and never a ranking boost, so a paid
 *     placement can never masquerade as relevance.
 *   • no ratings, review counts, customer counts or "popularity" are invented —
 *     only fields that exist on the document are ever returned.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { distanceKmBetween } from '@/lib/business/location';
import { availabilityLabel, canBuyNow } from '@/lib/business/availability';

/** Candidates considered per request — the hard read bound. */
export const DISCOVER_WINDOW = 240;
/** Businesses scanned per request. */
export const BUSINESS_WINDOW = 120;
/** Seller/business lookups resolved per request (deduped by id). */
export const LOOKUP_LIMIT = 80;
/** Page size ceiling and default. */
export const DISCOVER_PAGE_MAX = 24;
export const DISCOVER_PAGE_DEFAULT = 12;
/** Hard ceiling on paging into one ranked window. */
export const DISCOVER_MAX_PAGE = 20;

export type DiscoverKindFilter = 'all' | 'businesses' | 'listings';
export type DiscoverAvailability = 'any' | 'available';
export type DiscoverSort = 'relevance' | 'newest' | 'nearby';
export type DiscoverListingKind = 'product' | 'service';

export interface DiscoverCoords {
  lat: number;
  lng: number;
}

export interface DiscoverBusiness {
  kind: 'business';
  id: string;
  name: string;
  slug: string;
  category?: string;
  description?: string;
  logoUrl?: string;
  location?: string;
  verificationStatus?: string;
  /** True only when the business document itself carries a verified status. */
  verified: boolean;
  distanceKm?: number;
  shopHref: string;
  score: number;
}

export interface DiscoverListing {
  kind: DiscoverListingKind;
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  localPrice?: number;
  localCurrency?: string;
  priceMode?: 'quote' | 'hourly' | 'fixed';
  category?: string;
  location?: string;
  availabilityState?: string;
  availabilityLabel?: string;
  availableNow: boolean;
  /** Server-verified paid placement label — never a ranking boost. */
  sponsored: boolean;
  sellerId: string;
  sellerName?: string;
  shopHref: string;
  href: string;
  distanceKm?: number;
  score: number;
}

export type DiscoverItem = DiscoverBusiness | DiscoverListing;

export interface DiscoverInput {
  q: string;
  kind: DiscoverKindFilter;
  category?: string;
  location?: string;
  availability: DiscoverAvailability;
  sort: DiscoverSort;
  page: number;
  limit: number;
  coords?: DiscoverCoords;
}

export interface DiscoverPage {
  items: DiscoverItem[];
  /** Total ranked matches in this window (not the whole marketplace). */
  total: number;
  businesses: number;
  listings: number;
  page: number;
  limit: number;
  hasMore: boolean;
  scanned: number;
  windowCapped: boolean;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

function millis(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in value) {
    const fn = (value as { toMillis?: unknown }).toMillis;
    if (typeof fn === 'function') return (fn as () => number)();
  }
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const p = Date.parse(value);
    if (Number.isFinite(p)) return p;
  }
  return 0;
}

/* ── Parameter validation ─────────────────────────────────────────────────── */

export type ParseResult = { ok: true; value: DiscoverInput } | { ok: false; error: string };

function boundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null || raw.trim() === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function coord(raw: string | null, limit: number): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || Math.abs(n) > limit) return undefined;
  return n;
}

/**
 * Validate every input. Anything unrecognised falls back to the safe default
 * rather than throwing — a discovery URL with a junk `sort` must still render.
 * Only genuinely hostile sizes are rejected outright.
 */
export function parseDiscoverQuery(params: URLSearchParams): ParseResult {
  const q = (params.get('q') ?? '').trim();
  if (q.length > 120) return { ok: false, error: 'Search text is too long.' };

  const categoryRaw = (params.get('category') ?? '').trim();
  if (categoryRaw.length > 60) return { ok: false, error: 'Category filter is too long.' };

  const locationRaw = (params.get('location') ?? '').trim();
  if (locationRaw.length > 80) return { ok: false, error: 'Location filter is too long.' };

  const kindRaw = (params.get('kind') ?? 'all').trim().toLowerCase();
  const kind: DiscoverKindFilter =
    kindRaw === 'businesses' || kindRaw === 'business'
      ? 'businesses'
      : kindRaw === 'listings' || kindRaw === 'products' || kindRaw === 'services'
        ? 'listings'
        : 'all';

  const sortRaw = (params.get('sort') ?? '').trim().toLowerCase();
  const sort: DiscoverSort =
    sortRaw === 'newest' ? 'newest' : sortRaw === 'nearby' ? 'nearby' : 'relevance';

  const availability: DiscoverAvailability =
    (params.get('availability') ?? '').trim().toLowerCase() === 'available' ? 'available' : 'any';

  const lat = coord(params.get('lat'), 90);
  const lng = coord(params.get('lng'), 180);
  // Half a coordinate pair is useless and would silently skew "nearby" ordering.
  const coords = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;

  return {
    ok: true,
    value: {
      q,
      kind: kindRaw === 'products' ? 'listings' : kindRaw === 'services' ? 'listings' : kind,
      category: categoryRaw || undefined,
      location: locationRaw || undefined,
      availability,
      // "nearby" without a position is not a sort, it is a wish.
      sort: sort === 'nearby' && !coords ? 'relevance' : sort,
      page: boundedInt(params.get('page'), 1, 1, DISCOVER_MAX_PAGE),
      limit: boundedInt(params.get('limit'), DISCOVER_PAGE_DEFAULT, 1, DISCOVER_PAGE_MAX),
      coords,
    },
  };
}

/* ── Eligibility ──────────────────────────────────────────────────────────── */

interface SellerState {
  /** The account may trade: a seller, not suspended. */
  eligible: boolean;
  /** The public shop exists, so `/sellers/{id}` is a real page. */
  hasShop: boolean;
  sellerName?: string;
  shopName?: string;
  county?: string;
  area?: string;
  location?: string;
}

/**
 * A seller is eligible when the profile is a seller account that is not
 * suspended. `status` is absent on older profiles — absence is not a
 * suspension, so those stay eligible.
 */
export function isEligibleSellerProfile(
  profile: Record<string, unknown> | undefined | null,
): boolean {
  if (!profile) return false;
  if (profile.userRole !== 'seller') return false;
  if (profile.status === 'suspended') return false;
  return true;
}

export interface BusinessEligibilityInput {
  name?: string;
  slug?: string;
  category?: string;
  categories?: string[];
  description?: string;
  logoUrl?: string;
  isActive?: boolean;
}

/**
 * A business is discoverable when it is active AND its public profile is
 * complete enough for a customer to act on: a name, a slug (so a URL exists),
 * a category, and at least one piece of substance.
 *
 * `verificationStatus` is deliberately NOT part of this. An unverified but
 * complete business is a legitimate result; conflating the two would hide
 * every new business and make verification a toll gate rather than a signal.
 */
export function isCompleteBusinessProfile(business: BusinessEligibilityInput): boolean {
  if (business.isActive === false) return false;
  if (!business.name?.trim()) return false;
  if (!business.slug?.trim()) return false;
  const hasCategory = Boolean(business.category?.trim()) || (business.categories?.length ?? 0) > 0;
  if (!hasCategory) return false;
  return Boolean(business.description?.trim()) || Boolean(business.logoUrl?.trim());
}

/** An admin-unpublished listing is not discoverable. Absent means published. */
export function isPublishedListing(listing: { unpublished?: unknown }): boolean {
  return listing.unpublished !== true;
}

/* ── Scoring ──────────────────────────────────────────────────────────────── */

export function textTokens(q: string): string[] {
  return q
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * AND-of-tokens with field weights. `String.includes` only — the query never
 * becomes a regex, so hostile input cannot cause ReDoS.
 */
export function scoreFields(fields: Array<[string | undefined, number]>, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  let total = 0;
  for (const token of tokens) {
    let best = 0;
    for (const [text, weight] of fields) {
      if (text && text.toLowerCase().includes(token)) best = Math.max(best, weight);
    }
    if (best === 0) return 0; // every token must appear somewhere
    total += best;
  }
  return total;
}

/** A location match is a relevance signal, never a filter (except when filtered). */
function locationBoost(haystack: string, location: string | undefined): number {
  if (!location) return 0;
  return haystack.toLowerCase().includes(location.toLowerCase()) ? 2 : 0;
}

/* ── Collection reads ─────────────────────────────────────────────────────── */

interface RawProduct {
  id: string;
  data: Record<string, unknown>;
}

async function readProducts(db: Firestore, input: DiscoverInput): Promise<{ rows: RawProduct[]; capped: boolean }> {
  const collection = db.collection('products');
  // Equality on a single field is covered by Firestore's automatic index — no
  // composite index is needed. Services keep their trade in `serviceCategory`,
  // so a category filter has to look in both places or silently drop them.
  const queries = input.category
    ? [
        collection.where('category', '==', input.category).limit(DISCOVER_WINDOW),
        collection.where('serviceCategory', '==', input.category).limit(DISCOVER_WINDOW),
      ]
    : [collection.orderBy('uploadDate', 'desc').limit(DISCOVER_WINDOW)];

  const snaps = await Promise.all(queries.map((q) => q.get()));
  const seen = new Set<string>();
  const rows: RawProduct[] = [];
  let capped = false;
  for (const snap of snaps) {
    if (snap.docs.length >= DISCOVER_WINDOW) capped = true;
    for (const doc of snap.docs) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      rows.push({ id: doc.id, data: (doc.data() ?? {}) as Record<string, unknown> });
    }
  }
  return { rows, capped };
}

async function readBusinesses(db: Firestore): Promise<{ rows: RawProduct[]; capped: boolean }> {
  // No orderBy: `createdAt` is optional on older documents and an orderBy would
  // silently drop every business that predates it. A bounded scan keeps them.
  const snap = await db.collection('businesses').limit(BUSINESS_WINDOW).get();
  const rows = snap.docs.map((doc) => ({
    id: doc.id,
    data: (doc.data() ?? {}) as Record<string, unknown>,
  }));
  return { rows, capped: rows.length >= BUSINESS_WINDOW };
}

/**
 * Resolve the accounts behind the results in one bounded batch.
 *
 * Only ids that actually appear in this page's candidates are fetched, and the
 * whole set is capped — a hostile query string cannot make this read more than
 * `LOOKUP_LIMIT` documents.
 */
async function loadSellerStates(
  db: Firestore,
  sellerIds: string[],
  businessOwnerIds: string[],
): Promise<Map<string, SellerState>> {
  const ids = Array.from(new Set([...sellerIds, ...businessOwnerIds])).slice(0, LOOKUP_LIMIT);
  const states = new Map<string, SellerState>();

  await Promise.all(
    ids.map(async (id) => {
      const [profileSnap, shopSnap] = await Promise.all([
        db.collection('userProfiles').doc(id).get(),
        db.collection('sellerShops').doc(id).get(),
      ]);
      const profile = (profileSnap.exists ? profileSnap.data() : undefined) as
        | Record<string, unknown>
        | undefined;
      const shop = (shopSnap.exists ? shopSnap.data() : undefined) as
        | Record<string, unknown>
        | undefined;
      states.set(id, {
        eligible: isEligibleSellerProfile(profile),
        // The public shop route renders from `sellerShops`; without the document
        // there is no shop page to open.
        hasShop: Boolean(shop && str(shop.shopName)),
        sellerName: str(shop?.shopName) ?? str(profile?.shopName) ?? str(profile?.fullName),
        shopName: str(shop?.shopName),
        county: str(shop?.county),
        area: str(shop?.area),
        location: str(shop?.location) ?? str(profile?.location),
      });
    }),
  );

  return states;
}

/* ── Mapping ──────────────────────────────────────────────────────────────── */

function listingImage(data: Record<string, unknown>): string | undefined {
  const thumbs = Array.isArray(data.thumbnailUrls) ? data.thumbnailUrls : [];
  const images = Array.isArray(data.imageUrls) ? data.imageUrls : [];
  const first = (list: unknown[]) => list.find((u): u is string => typeof u === 'string' && !!u);
  return first(thumbs) ?? first(images) ?? str(data.imageUrl);
}

function isSponsoredNow(data: Record<string, unknown>): boolean {
  if (data.sponsored !== true) return false;
  if (data.promotedUntil === undefined || data.promotedUntil === null) return true;
  const until = millis(data.promotedUntil);
  return until === 0 ? true : until > Date.now();
}

function listingPlace(data: Record<string, unknown>, seller: SellerState | undefined): string {
  const own = str(data.location) ?? str(data.vendorLocation) ?? str(data.serviceArea);
  if (own) return own;
  const fromShop = [seller?.area, seller?.county].filter(Boolean).join(', ');
  // An empty join is not a location — fall through to the free-text field.
  return fromShop || seller?.location || 'Location not provided';
}

/* ── The query ────────────────────────────────────────────────────────────── */

export async function searchDiscover(db: Firestore, input: DiscoverInput): Promise<DiscoverPage> {
  const tokens = textTokens(input.q);
  const location = input.location?.toLowerCase();

  const wantBusinesses = input.kind === 'all' || input.kind === 'businesses';
  const wantListings = input.kind === 'all' || input.kind === 'listings';

  const [productResult, businessResult] = await Promise.all([
    wantListings ? readProducts(db, input) : Promise.resolve({ rows: [], capped: false }),
    wantBusinesses ? readBusinesses(db) : Promise.resolve({ rows: [], capped: false }),
  ]);

  const businessRows = businessResult.rows.filter((row) =>
    isCompleteBusinessProfile({
      name: str(row.data.name),
      slug: str(row.data.slug),
      category: str(row.data.category),
      categories: Array.isArray(row.data.categories)
        ? row.data.categories.filter((c): c is string => typeof c === 'string')
        : undefined,
      description: str(row.data.description),
      logoUrl: str(row.data.logoUrl),
      isActive: row.data.isActive === true ? true : row.data.isActive === false ? false : undefined,
    }),
  );

  const listingRows = productResult.rows.filter((row) => isPublishedListing(row.data));

  const sellerStates = await loadSellerStates(
    db,
    listingRows.map((row) => str(row.data.sellerId)).filter((v): v is string => !!v),
    businessRows.map((row) => str(row.data.ownerId)).filter((v): v is string => !!v),
  );

  const items: DiscoverItem[] = [];

  for (const row of businessRows) {
    const data = row.data;
    const ownerId = str(data.ownerId);
    if (!ownerId) continue;
    const seller = sellerStates.get(ownerId);
    // "Valid registered seller account" + "valid public shop route" — both are
    // required, and both are checked against real documents.
    if (!seller?.eligible || !seller.hasShop) continue;

    const primary = (data.primaryLocation ?? {}) as Record<string, unknown>;
    // A home-based business publishes an area, not a point. Only coordinates
    // the document marks public are ever used for distance.
    const publicPoint =
      primary.publicPrecision === 'area_only'
        ? undefined
        : { lat: num(primary.lat), lng: num(primary.lng) };

    const fromBusiness =
      str(primary.areaName) ?? str(primary.cityName) ?? str(primary.countyName);
    const fromShop = [seller.area, seller.county].filter(Boolean).join(', ');
    const place = fromBusiness ?? (fromShop || seller.location || undefined);

    const haystack = [
      str(data.name),
      str(data.description),
      str(data.category),
      Array.isArray(data.categories) ? data.categories.join(' ') : '',
      place,
      primary.countyName,
      seller.shopName,
    ]
      .filter(Boolean)
      .join(' ');

    if (location && !haystack.toLowerCase().includes(location)) continue;
    // Business categories are free text, so the filter is a contains-match. It
    // is enforced here as well as in the query so a service key ("plumbing")
    // and a product label ("Fashion & Apparel") can share one control.
    if (input.category && !haystack.toLowerCase().includes(input.category.toLowerCase())) continue;

    const score =
      scoreFields(
        [
          [str(data.name), 5],
          [str(data.category), 3],
          [Array.isArray(data.categories) ? data.categories.join(' ') : undefined, 3],
          [place, 2],
          [str(data.description), 1],
        ],
        tokens,
      ) + locationBoost(haystack, input.location);
    if (tokens.length > 0 && score <= 0) continue;

    const distanceKm = input.coords
      ? distanceKmBetween(input.coords, publicPoint ?? null) ?? undefined
      : undefined;

    items.push({
      kind: 'business',
      id: row.id,
      name: str(data.name) ?? '',
      slug: str(data.slug) ?? '',
      category: str(data.category) ?? (Array.isArray(data.categories) ? str(data.categories[0]) : undefined),
      description: str(data.description),
      logoUrl: str(data.logoUrl),
      location: place,
      verificationStatus: str(data.verificationStatus),
      verified: data.verificationStatus === 'verified',
      distanceKm,
      shopHref: `/sellers/${ownerId}`,
      score,
    });
  }

  for (const row of listingRows) {
    const data = row.data;
    const sellerId = str(data.sellerId);
    if (!sellerId) continue;
    const seller = sellerStates.get(sellerId);
    if (!seller?.eligible) continue;

    const availableNow = canBuyNow(
      (str(data.availabilityState) as Parameters<typeof canBuyNow>[0]) ?? undefined,
    );
    if (input.availability === 'available' && !availableNow) continue;

    const place = listingPlace(data, seller);
    const category = str(data.serviceCategory) ?? str(data.category);
    const haystack = [
      str(data.name),
      str(data.description),
      category,
      str(data.tags),
      place,
      str(data.includes),
      seller.sellerName,
    ]
      .filter(Boolean)
      .join(' ');

    if (location && !haystack.toLowerCase().includes(location)) continue;
    if (input.category && !haystack.toLowerCase().includes(input.category.toLowerCase())) continue;

    const score =
      scoreFields(
        [
          [str(data.name), 5],
          [category, 3],
          [str(data.tags), 2],
          [place, 2],
          [str(data.description), 1],
          [seller.sellerName, 1],
        ],
        tokens,
      ) + locationBoost(haystack, input.location);
    if (tokens.length > 0 && score <= 0) continue;

    const listingKind: DiscoverListingKind =
      data.listingType === 'service' ? 'service' : 'product';
    const state = str(data.availabilityState);

    items.push({
      kind: listingKind,
      id: row.id,
      name: str(data.name) ?? '',
      description: str(data.description),
      imageUrl: listingImage(data),
      price: num(data.price),
      localPrice: num(data.localPrice),
      localCurrency: str(data.localCurrency),
      priceMode:
        data.priceMode === 'quote' || data.priceMode === 'hourly' || data.priceMode === 'fixed'
          ? data.priceMode
          : undefined,
      category,
      location: place,
      availabilityState: state,
      availabilityLabel: availabilityLabel(state as Parameters<typeof availabilityLabel>[0]),
      availableNow,
      sponsored: isSponsoredNow(data),
      sellerId,
      sellerName: seller.sellerName,
      shopHref: `/sellers/${sellerId}`,
      href: `/products/${row.id}`,
      score,
    });
  }

  // Ranking. A sponsored placement is labelled in the card and gets NO boost —
  // paid visibility may not outrank relevance.
  const recency = new Map<string, number>();
  for (const row of [...businessRows, ...listingRows]) {
    recency.set(row.id, millis(row.data.uploadDate ?? row.data.createdAt ?? row.data.updatedAt));
  }

  items.sort((a, b) => {
    if (input.sort === 'nearby') {
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db2 = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (da !== db2) return da - db2;
      return b.score - a.score;
    }
    if (input.sort === 'newest') {
      return (recency.get(b.id) ?? 0) - (recency.get(a.id) ?? 0);
    }
    if (b.score !== a.score) return b.score - a.score;
    const ra = recency.get(a.id) ?? 0;
    const rb = recency.get(b.id) ?? 0;
    if (rb !== ra) return rb - ra;
    return a.name.localeCompare(b.name);
  });

  const total = items.length;
  const offset = (input.page - 1) * input.limit;
  const pageItems = items.slice(offset, offset + input.limit);

  return {
    items: pageItems,
    total,
    businesses: items.filter((i) => i.kind === 'business').length,
    listings: items.filter((i) => i.kind !== 'business').length,
    page: input.page,
    limit: input.limit,
    hasMore: offset + pageItems.length < total,
    scanned: productResult.rows.length + businessResult.rows.length,
    windowCapped: productResult.capped || businessResult.capped,
  };
}
