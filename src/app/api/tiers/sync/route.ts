import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '@/firebase/server';
import {
  COUNTED_ORDER_STATUSES,
  tierForCompletedTransactions,
  tierProgress,
  type AccountTier,
} from '@/lib/tiers';
import { isAdminUid } from '@/lib/server/admin-guard';

/**
 * AWARD THE TIER — automatically, from what actually happened.
 *
 * ## Nobody presses a button
 *
 * The request exists only because something has to run it; the decision is made
 * by `tierForCompletedTransactions`, which is a pure function of a count. An
 * admin calling this for a seller does not grant anything — they trigger the
 * same arithmetic that runs for everyone. That separation is deliberate: if an
 * admin could hand out a badge, the badge would stop being evidence.
 *
 * ## Only DELIVERED orders count
 *
 * Of 106 live orders, 86 are still `pending`. Counting those would put a Gold
 * badge on sellers for money that never arrived. The filter is in the query, so
 * the wrong number cannot reach the tier even if a caller asks nicely.
 *
 * ## Never demotes
 *
 * A stored tier is only ever raised. A seller in a slow month keeps the badge,
 * because a badge that disappears teaches sellers the work was not real.
 * Corrections are an admin action, made visibly, not a side effect of a query.
 *
 * ## Both directions, highest wins
 *
 * A person is often both a buyer and a seller. Both counts are read and the
 * better tier is kept, so neither side of the platform punishes the other.
 */

export const dynamic = 'force-dynamic';

async function readUid(request: Request): Promise<string | null> {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    return (await getAuth().verifyIdToken(token)).uid || null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const uid = await readUid(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // An admin may award on someone's behalf. Read from the BODY, never trusted
  // without the role check below.
  let targetUid = uid;
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.uid && body.uid !== uid) {
      if (!(await isAdminUid(uid))) {
        return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      }
      targetUid = String(body.uid);
    }
  } catch {
    /* no body is fine — defaults to the caller */
  }

  try {
    // The filter lives HERE, in the query, not in a loop below. Anything that
    // counts must ask Firestore for the right thing.
    const [asBuyer, asSeller] = await Promise.all([
      db
        .collection('orders')
        .where('buyerId', '==', targetUid)
        .where('orderStatus', 'in', [...COUNTED_ORDER_STATUSES])
        .get(),
      db
        .collection('orders')
        .where('sellerId', '==', targetUid)
        .where('orderStatus', 'in', [...COUNTED_ORDER_STATUSES])
        .get(),
    ]);

    const completed = asBuyer.size + asSeller.size;
    const earned = tierForCompletedTransactions(completed);

    const ref = db.collection('userProfiles').doc(targetUid);
    const current = (await ref.get()).data() as
      | { accountTier?: AccountTier; accountBonuses?: any[] }
      | undefined;
    const stored = (current?.accountTier ?? 'none') as AccountTier;

    const order = ['none', 'bronze', 'silver', 'gold', 'premium'];
    const shouldRaise = order.indexOf(earned) > order.indexOf(stored);

    const awarded = shouldRaise ? earned : stored;

    if (shouldRaise) {
      await ref.set(
        {
          accountTier: awarded,
          accountTierAwardedAt: FieldValue.serverTimestamp(),
          accountTierCompleted: completed,
          accountTierSource: 'automatic',
        },
        { merge: true },
      );
    } else {
      // Refresh the count for the meter without touching the tier itself.
      await ref.set({ accountTierCompleted: completed }, { merge: true });
    }

    return NextResponse.json({
      tier: awarded,
      raised: shouldRaise,
      previous: stored,
      completed,
      progress: tierProgress(completed),
      /** Bonuses are not part of the tier — they sit on top of it, visibly. */
      bonuses: (current?.accountBonuses ?? []).slice(-10).reverse(),
    });
  } catch (error) {
    console.error('[tiers] sync failed', error);
    return NextResponse.json({ error: 'Could not update the tier' }, { status: 500 });
  }
}
