/**
 * CLOSES THE ONBOARDING HOLE.
 *
 * The first backfill only looked at `sellerShops`, so a seller who was trading
 * without ever creating a shop got no business — and is therefore invisible to
 * Nearby, service areas, verification and Sponsored.
 *
 * This finds every seller with listings or orders and NO business, creates one
 * from the best name available, and stamps their documents. Dry run by default.
 */
import { db } from '@/firebase/server';
import { ensureBusinessForSeller } from '@/lib/business/ensure';

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(APPLY ? '=== APPLYING ===' : '=== DRY RUN — nothing will be written ===');

  const businesses = await db.collection('businesses').get();
  const owners = new Set(businesses.docs.map((d) => (d.data() as { ownerId?: string }).ownerId));
  console.log(`businesses: ${businesses.size}, owners: ${owners.size}`);

  // Every seller who has ever traded, from both sides of the marketplace.
  const sellers = new Map<string, { products: number; orders: number }>();
  for (const col of ['products', 'orders'] as const) {
    const snap = await db.collection(col).get();
    snap.forEach((d) => {
      const sid = (d.data() as Record<string, any>).sellerId;
      if (!sid || owners.has(sid)) return;
      const cur = sellers.get(sid) ?? { products: 0, orders: 0 };
      cur[col] += 1;
      sellers.set(sid, cur);
    });
  }

  console.log(`sellers with listings/orders but no business: ${sellers.size}\n`);
  if (sellers.size === 0) {
    console.log('nothing to do.');
    return;
  }

  for (const [uid, counts] of sellers) {
    const shop = await db.collection('sellerShops').doc(uid).get();
    const profile = await db.collection('userProfiles').doc(uid).get();
    const s = shop.data() as { shopName?: string; name?: string } | undefined;
    const p = profile.data() as { fullName?: string; email?: string } | undefined;

    const name =
      (s?.shopName || s?.name || '').trim() ||
      (p?.fullName || '').trim() ||
      (p?.email || '').split('@')[0]?.trim() ||
      '(no name)';

    console.log(
      `  ${uid.slice(0, 14).padEnd(16)} listings=${String(counts.products).padStart(2)} ` +
        `orders=${String(counts.orders).padStart(3)}  name="${name}"`,
    );

    if (APPLY) {
      const result = await ensureBusinessForSeller(uid);
      console.log(
        result
          ? `      -> ${result.created ? 'created' : 'already had one'}: ${result.businessId} (stamped ${result.stamped})`
          : '      -> SKIPPED: no usable name',
      );
    }
  }

  if (!APPLY) console.log('\nDry run only. Re-run with --apply to write.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
