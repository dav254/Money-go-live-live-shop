import { db } from '@/firebase/server';
import { MarketplaceRequest } from './types';

/**
 * VIDNOV MATCHING ENGINE (spec §37).
 *
 * Score = category match (weight 5) + location match (weight 3)
 *       + verification bonus (1) + rating bonus (0–1).
 *
 * ## Every same-category seller gets in — always
 *
 * The point of the marketplace is that a buyer's brief reaches the businesses
 * that actually do that work. So the FIRST stage here is a direct
 * `category ==` query over `sellerShops`, not a scan of whatever shops happen
 * to fall inside a 500-document read: a request in "Furniture & Decor" must
 * reach **every** shop that picked "Furniture & Decor", and a single equality
 * filter needs no composite index (this project has no provisioned indexes —
 * see `notification-sort.ts` for what happens when a query assumes one).
 *
 * The scored scan then runs alongside it to add the location/verified/rating
 * matches the score is good for. Results are deduped, and category matches are
 * ordered first so the `limit` can never starve them out — the cap exists to
 * keep the notification fan-out sane on a 2 GB VPS, not to pick winners.
 *
 * Category strings come from `REQUEST_CATEGORIES` on both sides (the buyer's
 * request form and the seller's shop settings), but the comparison is still
 * trimmed and case-insensitive: one free-typed value must not silently mute an
 * entire category.
 */

export interface MatchedSeller {
  sellerId: string;
  businessName: string;
  score: number;
  reasons: string[];
}

interface ShopDoc {
  sellerId: string;
  shopName: string;
  category?: string;
  county?: string;
  cityTown?: string;
  location?: string;
  targetLocations?: string[];
  isVerified?: boolean;
  rating?: number;
  isActive?: boolean;
}

function norm(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

/** Category equality that tolerates case/whitespace drift between the two selects. */
function sameCategory(a?: string | null, b?: string | null): boolean {
  const left = norm(a);
  const right = norm(b);
  return Boolean(left && right && left === right);
}

function locationMatches(shop: ShopDoc, requestLocation?: string): boolean {
  const loc = norm(requestLocation);
  if (!loc) return false;
  const candidates = [shop.county, shop.cityTown, shop.location, ...(shop.targetLocations ?? [])];
  return candidates.some((c) => norm(c) === loc);
}

/** Returns null when the shop clears no rule worth notifying about. */
function scoreShop(shop: ShopDoc, request: MarketplaceRequest): MatchedSeller | null {
  let score = 0;
  const reasons: string[] = [];

  if (sameCategory(shop.category, request.category)) {
    score += 5;
    reasons.push('category');
  }
  if (locationMatches(shop, request.location)) {
    score += 3;
    reasons.push('location');
  }
  if (shop.isVerified) {
    score += 1;
    reasons.push('verified');
  }
  const rating = Number(shop.rating ?? 0);
  if (rating >= 4) {
    score += Math.min(1, (rating - 4) / 2);
    reasons.push('top-rated');
  }

  // Category alone is exactly 5, so a same-category shop always passes; the
  // cut-off only decides which NON-category shops (location + trust signals)
  // are worth interrupting someone for.
  if (score < 5) return null;

  return {
    sellerId: shop.sellerId,
    businessName: shop.shopName || 'Business',
    score: Math.round(score * 10) / 10,
    reasons,
  };
}

/**
 * Finds and scores businesses relevant to a request. Ordered
 * best-category-match-first. `limit` keeps the notification fan-out sane on a
 * small VPS.
 */
export async function findMatchingSellers(
  request: MarketplaceRequest,
  limit = 20,
): Promise<MatchedSeller[]> {
  const category = (request.category ?? '').trim();

  // Stage 1 — every shop in this exact category (index-free equality filter).
  const categorySnap = category
    ? await db
        .collection('sellerShops')
        .where('category', '==', category)
        .limit(200)
        .get()
        .catch(() => null)
    : null;

  // Stage 2 — the scored scan, for location/verification/rating matches.
  const scanSnap = await db.collection('sellerShops').limit(500).get().catch(() => null);
  if (!categorySnap && !scanSnap) return [];

  const bySeller = new Map<string, MatchedSeller>();
  const consider = (docId: string, data: unknown) => {
    const shop = data as ShopDoc;
    // Doc id IS the owner's uid (seller settings write sellerShops/{uid}); the
    // field is the older shape — accept either rather than dropping a shop.
    const sellerId = shop.sellerId || docId;
    if (!sellerId || sellerId === request.customerId) return;
    if (shop.isActive === false) return;

    const match = scoreShop({ ...shop, sellerId }, request);
    if (!match) return;

    const existing = bySeller.get(match.sellerId);
    if (!existing || match.score > existing.score) bySeller.set(match.sellerId, match);
  };
  categorySnap?.forEach((doc) => consider(doc.id, doc.data()));
  scanSnap?.forEach((doc) => consider(doc.id, doc.data()));

  const all = [...bySeller.values()];
  const byScore = (a: MatchedSeller, b: MatchedSeller) => b.score - a.score;

  // Category matches first — the guarantee. Within each group, best score wins.
  const categoryMatches = all.filter((m) => m.reasons.includes('category')).sort(byScore);
  const others = all.filter((m) => !m.reasons.includes('category')).sort(byScore);

  return [...categoryMatches, ...others].slice(0, limit);
}
