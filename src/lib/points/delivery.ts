/**
 * DELIVERY POINTS — the reward that makes the loop close.
 *
 * A successful delivery is the one moment both sides did what they promised:
 * the seller shipped, the buyer received. Crediting both of them there is
 * what turns a single purchase into a habit — the balance is visible in the
 * points screens, spent in AI Studio, and shown on the seller's points page.
 *
 * The award lives in the API routes that mark an order delivered (seller and
 * admin), not in the Cloud Function that settles money, for one reason: the
 * routes run inside the deployed Next server and take effect immediately,
 * while a function edit only takes effect after a separate Firebase deploy.
 * Money settlement stays where it was.
 */

import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { Order } from '@/lib/types';

/** Points both the seller and the buyer earn for one confirmed delivery. */
export const DELIVERY_POINTS_PER_PARTY = 5;

/**
 * Credits both parties `DELIVERY_POINTS_PER_PARTY` and marks the order so the
 * reward can never be paid twice.
 *
 * The guard is a flag ON THE ORDER, read and written inside one transaction:
 * the seller route only allows a one-way transition to `delivered`, but the
 * admin route can re-set the status freely, and any re-run — an admin fixing
 * a typo, a retried request — must not print points twice. The balance lands
 * on `userProfiles/{uid}.aiPoints`, the single field every points screen
 * already reads.
 *
 * Returns true when the award was actually paid.
 */
export async function awardDeliveryPoints(
  db: Firestore,
  order: Order,
  orderId: string,
): Promise<boolean> {
  if (order.deliveryPointsAwarded) return false;
  const parties = [order.sellerId, order.buyerId].filter(Boolean);
  if (parties.length === 0) return false;

  return db.runTransaction(async (tx) => {
    const orderRef = db.collection('orders').doc(orderId);
    const snap = await tx.get(orderRef);
    if (!snap.exists || snap.data()?.deliveryPointsAwarded) return false;

    tx.update(orderRef, { deliveryPointsAwarded: true });
    for (const uid of parties) {
      tx.set(
        db.collection('userProfiles').doc(uid),
        { aiPoints: FieldValue.increment(DELIVERY_POINTS_PER_PARTY) },
        { merge: true },
      );
    }
    return true;
  });
}
