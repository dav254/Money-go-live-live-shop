/**
 * SERVER-SIDE SEARCH — bounded interface over the EXISTING Firestore data.
 *
 * Why: the live `/search` page downloads the whole `products` collection into
 * the browser and filters there. This module is the shared server-side
 * replacement surface: validated params in, ranked results out, strict bounds
 * on every read.
 *
 * Index posture (zero deployment impact):
 *   • category filter  → equality-only query (Firestore's automatic
 *                        single-field index handles it — no composite index);
 *   • no filter        → single-field orderBy('uploadDate') (automatic);
 *   • sellers          → equality on userRole (automatic);
 *   • ranking/filtering happen in memory over a CAPPED candidate window.
 * Firestore has no substring index; if the window ever becomes a real limit,
 * the documented next step is a `searchTokens: string[]` field + composite
 * index (docs/vidnov-core-engine.md §10) — not a new search engine.
 *
 * The Firestore instance is injected, so tests exercise the whole path with
 * a fake and no credentials are needed to import this module.
 */

import type { Firestore } from 'firebase-admin/firestore';

/** Max candidates considered per request — the hard read bound. */
export const SEARCH_WINDOW = 300;
/** Max sellers scanned for a seller search. */
export const SELLER_WINDOW = 100;

export interface SearchProductDoc {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  tags?: string;
  location?: string;
  vendorLocation?: string;
  price?: number;
  stock?: number;
  availabilityState?: string;
  sellerId?: string;
  imageUrl?: string;
  uploadDate?: unknown;
  /*
   * Display-only fields the existing product card renders. All of them are
   * already public on the product page — the projection just has to keep
   * parity with what the old client-side filter showed, and it still omits
   * anything internal (owner notes, moderation flags, mirrors, counters).
   */
  localCurrency?: string;
  localPrice?: number;
  wasPrice?: number;
  condition?: 'new' | 'used';
  listingType?: 'product' | 'service';
  priceMode?: 'quote' | 'hourly' | 'fixed';
  videoUrl?: string;
  videoUrls?: string[];
  imageUrls?: string[];
}

export interface SearchInput {
  q: string;
  category?: string;
  location?: string;
  inStockOnly?: boolean;
  limit: number;
}

/** Firestore Timestamp | string | number → epoch ms (0 when unknown). */
function toMillis(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const p = Date.parse(value);
    if (Number.isFinite(p)) return p;
  }
  return 0;
}

/**
 * Availability check used by `inStockOnly`:
 * explicit out-of-stock/preorder states are out; stock 0 is out for products
 * (services without stock are kept — availability lives in their state).
 */
export function isAvailable(p: SearchProductDoc): boolean {
  if (p.availabilityState === 'out_of_stock' || p.availabilityState === 'fully_booked') return false;
  if (p.availabilityState) return true;
  return !(typeof p.stock === 'number' && p.stock <= 0);
}

/**
 * AND-of-tokens match with a light field-weight score. Plain `String.includes`
 * on lowercased text — the query is NEVER used to build a regex, so hostile
 * input cannot cause ReDoS or weird matching.
 */
export function scoreProduct(p: SearchProductDoc, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  const fields: Array<[string, number]> = [
    [(p.name ?? '').toLowerCase(), 4],
    [(p.category ?? '').toLowerCase(), 3],
    [(p.tags ?? '').toLowerCase(), 2],
    [`${(p.location ?? '').toLowerCase()} ${(p.vendorLocation ?? '').toLowerCase()}`, 2],
    [(p.description ?? '').toLowerCase(), 1],
  ];
  let total = 0;
  for (const token of tokens) {
    let tokenScore = 0;
    for (const [text, weight] of fields) {
      if (text.includes(token)) tokenScore = Math.max(tokenScore, weight);
    }
    if (tokenScore === 0) return 0; // every token must match somewhere (AND)
    total += tokenScore;
  }
  return total;
}

/** Pure rank: score desc, then newest first, then bounded. */
export function rankProducts(
  candidates: readonly SearchProductDoc[],
  input: SearchInput,
): SearchProductDoc[] {
  const q = input.q.trim().toLowerCase();
  const tokens = q ? q.split(/\s+/).filter(Boolean).slice(0, 8) : [];
  const category = input.category?.trim().toLowerCase();
  const location = input.location?.trim().toLowerCase();
  const limit = Math.min(Math.max(input.limit, 1), 50);

  const scored: Array<{ p: SearchProductDoc; score: number; at: number }> = [];
  for (const p of candidates) {
    if (category && (p.category ?? '').toLowerCase() !== category) continue;
    if (location && !`${p.location ?? ''} ${p.vendorLocation ?? ''}`.toLowerCase().includes(location)) continue;
    if (input.inStockOnly && !isAvailable(p)) continue;
    const score = scoreProduct(p, tokens);
    if (score <= 0) continue;
    scored.push({ p, score, at: toMillis(p.uploadDate) });
  }
  scored.sort((a, b) => b.score - a.score || b.at - a.at);
  return scored.slice(0, limit).map((s) => s.p);
}

function mapDoc(id: string, data: Record<string, unknown>): SearchProductDoc {
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const strList = (v: unknown) =>
    Array.isArray(v) ? v.filter((u): u is string => typeof u === 'string').slice(0, 12) : undefined;
  return {
    id,
    name: str(data.name),
    description: str(data.description),
    category: str(data.category),
    tags: str(data.tags),
    location: str(data.location),
    vendorLocation: str(data.vendorLocation),
    price: num(data.price),
    stock: num(data.stock),
    availabilityState: str(data.availabilityState),
    sellerId: str(data.sellerId),
    imageUrl: str(data.imageUrl),
    uploadDate: data.uploadDate,
    localCurrency: str(data.localCurrency),
    localPrice: num(data.localPrice),
    wasPrice: num(data.wasPrice),
    condition: data.condition === 'used' || data.condition === 'new' ? data.condition : undefined,
    listingType: data.listingType === 'service' || data.listingType === 'product' ? data.listingType : undefined,
    priceMode:
      data.priceMode === 'quote' || data.priceMode === 'hourly' || data.priceMode === 'fixed'
        ? data.priceMode
        : undefined,
    videoUrl: str(data.videoUrl),
    videoUrls: strList(data.videoUrls),
    imageUrls: strList(data.imageUrls),
  };
}

export interface SearchResult {
  items: SearchProductDoc[];
  /** How many candidates were scanned (≤ SEARCH_WINDOW). */
  scanned: number;
  /** True when the window was filled — results may be incomplete by design. */
  windowCapped: boolean;
}

/**
 * Bounded product search. Two Firestore shapes, both index-safe:
 *   • with a category → equality filter, window capped;
 *   • without → newest-first single-field order.
 */
export async function searchProducts(db: Firestore, input: SearchInput): Promise<SearchResult> {
  const collection = db.collection('products');
  const query = input.category?.trim()
    ? collection.where('category', '==', input.category.trim()).limit(SEARCH_WINDOW)
    : collection.orderBy('uploadDate', 'desc').limit(SEARCH_WINDOW);

  const snap = await query.get();
  const candidates = snap.docs.map((d) => mapDoc(d.id, (d.data() ?? {}) as Record<string, unknown>));
  return {
    items: rankProducts(candidates, input),
    scanned: candidates.length,
    windowCapped: candidates.length >= SEARCH_WINDOW,
  };
}

export interface SellerSearchDoc {
  id: string;
  fullName?: string;
  shopName?: string;
  username?: string;
  location?: string;
  userRole?: string;
  /** Public avatar used by the seller result card. */
  profilePictureUrl?: string;
}

export function rankSellers(candidates: readonly SellerSearchDoc[], q: string, limit: number): SellerSearchDoc[] {
  const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  const capped = Math.min(Math.max(limit, 1), 50);
  if (tokens.length === 0) return candidates.slice(0, capped);
  return candidates
    .filter((s) => {
      const haystack = `${s.fullName ?? ''} ${s.shopName ?? ''} ${s.username ?? ''} ${s.location ?? ''}`.toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    })
    .slice(0, capped);
}

/** Bounded seller search (equality query on userRole — index-safe). */
export async function searchSellers(db: Firestore, q: string, limit = 12): Promise<SellerSearchDoc[]> {
  const snap = await db
    .collection('userProfiles')
    .where('userRole', '==', 'seller')
    .limit(SELLER_WINDOW)
    .get();
  const candidates = snap.docs.map((d) => {
    const data = (d.data() ?? {}) as Record<string, unknown>;
    return {
      id: d.id,
      fullName: data.fullName ? String(data.fullName) : undefined,
      shopName: data.shopName ? String(data.shopName) : undefined,
      username: data.username ? String(data.username) : undefined,
      location: data.location ? String(data.location) : undefined,
      profilePictureUrl: data.profilePictureUrl ? String(data.profilePictureUrl) : undefined,
      userRole: 'seller',
    } satisfies SellerSearchDoc;
  });
  return rankSellers(candidates, q, limit);
}
