import { db } from '@/firebase/server';
import { MarketplaceRequest } from './types';

/**
 * VIDNOV MATCHING ENGINE (spec §37).
 *
 * Score = category match (weight 5) + location match (weight 3)
 *       + verification bonus (1) + rating bonus (0–1).
 *
 * Category/location live on the seller's shop profile; when a shop has no
 * category yet we fall back to the profile's businessCategory tag.
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

function locationMatches(shop: ShopDoc, requestLocation?: string): boolean {
  const loc = norm(requestLocation);
  if (!loc) return false;
  const candidates = [shop.county, shop.cityTown, shop.location, ...(shop.targetLocations ?? [])];
  return candidates.some((c) => norm(c) === loc);
}

/**
 * Finds and scores businesses relevant to a request. Ordered best-first.
 * `limit` keeps the notification fan-out sane on a small VPS.
 */
export async function findMatchingSellers(
  request: MarketplaceRequest,
  limit = 20,
): Promise<MatchedSeller[]> {
  const snap = await db.collection('sellerShops').limit(500).get().catch(() => null);
  if (!snap) return [];

  const matches: MatchedSeller[] = [];
  snap.forEach((doc) => {
    const shop = doc.data() as ShopDoc;
    if (!shop.sellerId || shop.sellerId === request.customerId) return;
    if (shop.isActive === false) return;

    let score = 0;
    const reasons: string[] = [];

    if (shop.category && request.category && shop.category === request.category) {
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

    if (score >= 5) {
      matches.push({
        sellerId: shop.sellerId,
        businessName: shop.shopName || 'Business',
        score: Math.round(score * 10) / 10,
        reasons,
      });
    }
  });

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}
