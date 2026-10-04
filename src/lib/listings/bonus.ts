import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { bonusForListing } from './limits';

/**
 * BONUS PAYOUT — the one place points are minted for reach.
 *
 * ## The invariant that makes this safe
 *
 * A listing must never pay the same milestone twice. Two devices refreshing a
 * seller's dashboard at the same moment, or a cron and a dashboard both
 * running, would otherwise both read "not yet paid" and both pay. So:
 *
 *   - the read of `bonusPointsPaid` and the write of the new value happen in
 *     ONE Firestore transaction, which serialises them;
 *   - only the DELTA is paid, so a listing that jumps three tiers at once gets
 *     the sum once, and a later call pays nothing.
 *
 * ## Why views and likes are read from the document
 *
 * Never from the caller. A client able to POST its own view count could mint
 * points from nothing.
 */

export interface BonusOutcome {
  paid: number;
  total: number;
  tier: string | null;
  nextTier: string | null;
}

export type BonusResult =
  | BonusOutcome
  | { error: 'Listing not found' | 'Listing has no seller' | 'Not your seller' };

/**
 * Reconciles one listing's bonus.
 *
 * Idempotent by construction — call it as often as you like.
 */
export async function reconcileListingBonus(
  listingId: string,
  actingUid: string,
  opts: { isAdmin?: boolean } = {},
): Promise<BonusResult> {
  return db.runTransaction(async (tx) => {
    const listingRef = db.collection('products').doc(listingId);
    const snap = await tx.get(listingRef);
    if (!snap.exists) return { error: 'Listing not found' };

    const listing = snap.data() as {
      sellerId?: string;
      viewCount?: number;
      likes?: number;
      bonusPointsPaid?: number;
    };
    const sellerId = listing.sellerId || '';
    if (!sellerId) return { error: 'Listing has no seller' };
    if (!opts.isAdmin && actingUid !== sellerId) return { error: 'Not your seller' };

    const earned = bonusForListing(Number(listing.viewCount) || 0, Number(listing.likes) || 0);
    const alreadyPaid = Number(listing.bonusPointsPaid) || 0;
    const delta = earned.points - alreadyPaid;

    if (delta <= 0) {
      return {
        paid: 0,
        total: earned.points,
        tier: earned.tier?.label ?? null,
        nextTier: earned.nextTier?.label ?? null,
      };
    }

    tx.update(listingRef, {
      bonusPointsPaid: earned.points,
      bonusTierReached: earned.tier?.label ?? null,
      bonusCheckedAt: FieldValue.serverTimestamp(),
    });
    tx.set(
      db.collection('userProfiles').doc(sellerId),
      {
        bonusPoints: FieldValue.increment(delta),
        bonusPointsUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    tx.set(
      db.collection('listingBonuses').doc(listingId),
      {
        sellerId,
        totalPoints: earned.points,
        views: Number(listing.viewCount) || 0,
        likes: Number(listing.likes) || 0,
        tier: earned.tier?.label ?? null,
        paidAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return {
      paid: delta,
      total: earned.points,
      tier: earned.tier?.label ?? null,
      nextTier: earned.nextTier?.label ?? null,
    };
  });
}
