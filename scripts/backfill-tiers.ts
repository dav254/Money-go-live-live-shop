/**
 * AWARD TIERS ACROSS THE PLATFORM.
 *
 * ## What this does and does not decide
 *
 * It counts each account's **delivered** orders and applies
 * `tierForCompletedTransactions`. That is the entire decision. This script has
 * no opinion, no thresholds of its own, and no way to award anything the ladder
 * would not award on its own — running it twice, or an admin running it for one
 * person, produces exactly the same answer as the arithmetic.
 *
 * ## Never demotes
 *
 * An account already holding a higher tier keeps it. A slow month is not a
 * retraction.
 *
 * Dry run by default. Pass `--apply` to write.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../src/firebase/server';
import { COUNTED_ORDER_STATUSES, tierForCompletedTransactions, type AccountTier } from '../src/lib/tiers';

const APPLY = process.argv.includes('--apply');
const ORDER = ['none', 'bronze', 'silver', 'gold', 'premium'];

async function main() {
  const orders = await db.collection('orders').get();

  const counts = new Map<string, { sold: number; bought: number }>();
  let countedOrders = 0;
  let skippedOrders = 0;

  for (const d of orders.docs) {
    const o = d.data() as any;
    if (!COUNTED_ORDER_STATUSES.includes(o.orderStatus)) {
      skippedOrders++;
      continue;
    }
    countedOrders++;
    const s = counts.get(o.sellerId) ?? { sold: 0, bought: 0 };
    s.sold++;
    counts.set(o.sellerId, s);
    const b = counts.get(o.buyerId) ?? { sold: 0, bought: 0 };
    b.bought++;
    counts.set(o.buyerId, b);
  }

  const profiles = await db.collection('userProfiles').get();
  const plan: {
    uid: string;
    name: string;
    sold: number;
    bought: number;
    completed: number;
    from: AccountTier;
    to: AccountTier;
  }[] = [];
  let keptHigher = 0;

  for (const d of profiles.docs) {
    const p = d.data() as any;
    const c = counts.get(d.id) ?? { sold: 0, bought: 0 };
    const completed = c.sold + c.bought;
    const earned = tierForCompletedTransactions(completed);
    const stored = (p.accountTier ?? 'none') as AccountTier;

    if (ORDER.indexOf(earned) <= ORDER.indexOf(stored)) {
      if (ORDER.indexOf(earned) < ORDER.indexOf(stored)) keptHigher++;
      continue;
    }
    plan.push({
      uid: d.id,
      name: p.fullName || p.username || d.id,
      sold: c.sold,
      bought: c.bought,
      completed,
      from: stored,
      to: earned,
    });
  }

  console.log(`orders: ${orders.size} total | ${countedOrders} delivered (counted) | ${skippedOrders} not yet delivered (ignored)`);
  console.log(`accounts with activity: ${counts.size} | ${profiles.size} profiles scanned\n`);
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${plan.length} to raise, ${keptHigher} already above their count (kept)\n`);

  for (const r of plan.sort((a, b) => b.completed - a.completed)) {
    console.log(
      `  ${r.name.slice(0, 26).padEnd(26)} sold ${String(r.sold).padStart(3)}  bought ${String(r.bought).padStart(3)}  ${r.from} → ${r.to}`,
    );
  }

  if (!APPLY) {
    console.log('\nNothing written. Re-run with --apply.');
    return;
  }

  const batch = db.batch();
  for (const r of plan) {
    batch.set(
      db.collection('userProfiles').doc(r.uid),
      {
        accountTier: r.to,
        accountTierAwardedAt: FieldValue.serverTimestamp(),
        accountTierCompleted: r.completed,
        accountTierSource: 'automatic',
      },
      { merge: true },
    );
  }
  await batch.commit();
  console.log(`\nAwarded ${plan.length} tier(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
