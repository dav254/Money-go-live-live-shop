/**
 * VERIFIES THE VIEW/LIKE BONUS AGAINST LIVE FIRESTORE.
 *
 * Runs the real `reconcileListingBonus` — the same function the route calls —
 * against a throwaway listing, and asserts the two properties that matter:
 *
 *   1. Crossing a milestone PAYS.
 *   2. Calling it again pays NOTHING, ever.
 *
 * The second is the one that matters. A seller refreshing their dashboard on
 * two devices, or a dashboard and a cron running together, must not mint
 * points twice for the same views. Everything is cleaned up afterwards.
 */
import { db } from '@/firebase/server';
import { reconcileListingBonus } from '@/lib/listings/bonus';

/*
 * PRODUCTION GUARD — this script writes SYNTHETIC viewCount/likes values into
 * Firestore (then cleans them up). It is a verification harness, never a
 * migration, and running it against a real listing — or against production —
 * would fabricate engagement data the Growth Engine now treats as real.
 *
 * It therefore refuses to run unless the operator explicitly opts in with
 *   VIDNOV_FAKE_STATS_TEST=ALLOW
 * (e.g. in a dev sandbox: VIDNOV_FAKE_STATS_TEST=ALLOW npx tsx
 * scripts/verify-listing-bonus.ts). Never set this against the live project.
 */
if (process.env.VIDNOV_FAKE_STATS_TEST !== 'ALLOW') {
  console.error(
    'REFUSED: verify-listing-bonus.ts writes fake engagement counters.\n' +
      'Run it only in a dev sandbox with VIDNOV_FAKE_STATS_TEST=ALLOW.\n' +
      'It must never run against production data.',
  );
  process.exit(1);
}

let failures = 0;

function check(label: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function cleanup(ids: { listing: string; seller: string }) {
  await db.collection('products').doc(ids.listing).delete().catch(() => undefined);
  await db.collection('listingBonuses').doc(ids.listing).delete().catch(() => undefined);
  await db.collection('userProfiles').doc(ids.seller).delete().catch(() => undefined);
}

async function main() {
  const stamp = Date.now();
  const listingId = `__verify_bonus_${stamp}`;
  const sellerId = `__verify_bonus_seller_${stamp}`;
  const ids = { listing: listingId, seller: sellerId };

  try {
    // Not yet at any tier.
    await db.collection('products').doc(listingId).set({
      sellerId,
      viewCount: 10,
      likes: 1,
      name: 'verify bonus listing',
    });
    await db.collection('userProfiles').doc(sellerId).set({ bonusPoints: 0 });

    console.log('=== below the first tier ===');
    const below = await reconcileListingBonus(listingId, sellerId);
    check('pays nothing below 100 views', !('error' in below) && below.paid === 0, `paid ${('paid' in below ? below.paid : '?')}`);
    check('a stranger cannot claim it', 'error' in (await reconcileListingBonus(listingId, `${sellerId}_other`)));

    console.log('\n=== crossing the first tier ===');
    await db.collection('products').doc(listingId).update({ viewCount: 150, likes: 8 });
    const first = await reconcileListingBonus(listingId, sellerId);
    check('pays the first tier once', !('error' in first) && first.paid === 50, `paid ${('paid' in first ? first.paid : '?')}`);

    const balance = await db.collection('userProfiles').doc(sellerId).get();
    check('the seller balance moved by exactly that', Number(balance.data()?.bonusPoints) === 50, `balance ${balance.data()?.bonusPoints}`);

    console.log('\n=== calling it again must pay nothing ===');
    const second = await reconcileListingBonus(listingId, sellerId);
    check('second call pays 0', !('error' in second) && second.paid === 0, `paid ${('paid' in second ? second.paid : '?')}`);
    const third = await reconcileListingBonus(listingId, sellerId);
    check('third call still pays 0', !('error' in third) && third.paid === 0);

    const balanceAfter = await db.collection('userProfiles').doc(sellerId).get();
    check('the balance did not drift', Number(balanceAfter.data()?.bonusPoints) === 50, `balance ${balanceAfter.data()?.bonusPoints}`);

    console.log('\n=== more views pay only the new difference ===');
    await db.collection('products').doc(listingId).update({ viewCount: 900, likes: 40 });
    const grown = await reconcileListingBonus(listingId, sellerId);
    // 100/5 = 50, 500/25 = 150  →  total 200, minus the 50 already paid.
    check('pays only the delta', !('error' in grown) && grown.paid === 150 && grown.total === 200, `paid ${('paid' in grown ? grown.paid : '?')}, total ${('total' in grown ? grown.total : '?')}`);

    const finalBalance = await db.collection('userProfiles').doc(sellerId).get();
    check('balance equals the total earned', Number(finalBalance.data()?.bonusPoints) === 200, `balance ${finalBalance.data()?.bonusPoints}`);

    console.log('\n=== views without likes earn nothing ===');
    await db.collection('products').doc(listingId).update({ viewCount: 500_000, likes: 0 });
    const noLikes = await reconcileListingBonus(listingId, sellerId);
    check('no bonus without likes', !('error' in noLikes) && noLikes.paid === 0, `paid ${('paid' in noLikes ? noLikes.paid : '?')}`);
  } finally {
    await cleanup(ids);
    const left = await db.collection('products').doc(listingId).get();
    check('probe cleaned up', !left.exists);
  }

  if (failures) {
    console.error(`\n${failures} CHECK(S) FAILED`);
    process.exit(1);
  }
  console.log('\nALL CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
