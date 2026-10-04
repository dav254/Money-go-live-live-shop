/**
 * MIGRATE LEGACY PRODUCT REVIEWS.
 *
 * ## What went wrong
 *
 * The website's order page wrote reviews with a client-side `addDoc` into
 * `products/{productId}/reviews`. Everything built since — the reviews API, the
 * rating summary, the shop page — reads the `reviews` collection keyed by order.
 *
 * Two systems, one product. The one buyers could reach was the one nothing
 * displayed, which is why the platform had reviews and still showed a hardcoded
 * zero everywhere. The write path has been repointed at `/api/reviews`; this
 * moves the orphans across so no review is silently lost in the process.
 *
 * ## Why the id is synthetic
 *
 * A review document is keyed by ORDER id, because one review per order per
 * direction is the rule that stops a buyer reviewing the same purchase fifty
 * times. Legacy reviews have no order id — the old dialog never stored one — so
 * there is nothing to key them by. `legacy_…` cannot collide with a real order
 * id, and the doc is marked so it can be identified and excluded from any future
 * "one review per order" check.
 *
 * Dry run by default. Pass `--apply` to write.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../src/firebase/server';

const APPLY = process.argv.includes('--apply');

async function main() {
  const products = await db.collection('products').get();
  const orders = await db.collection('orders').get();

  // Legacy docs record sellerId + buyerId but no orderId. Find the order that
  // links them so the migrated review can point at a real transaction.
  const orderByPair = new Map<string, string>();
  for (const o of orders.docs) {
    const d = o.data() as any;
    if (d?.buyerId && d?.sellerId) {
      const key = `${d.sellerId}|${d.buyerId}`;
      if (!orderByPair.has(key)) orderByPair.set(key, o.id);
    }
  }

  const existing = await db.collection('reviews').get();
  // Ids, NOT booleans. Building this from `d.id.startsWith('legacy_')` produced
  // a Set of `true`, so `has(syntheticId)` was always false and a second run
  // would migrate every review again — double-counting ratings and duplicating
  // text on the public page.
  const alreadyMigrated = new Set(
    existing.docs.map((d) => d.id).filter((id) => id.startsWith('legacy_')),
  );

  const plan: {
    id: string;
    product: string;
    orderId: string | null;
    sellerId: string | null;
    rating: number;
    text: string;
    authorName: string;
  }[] = [];

  for (const p of products.docs) {
    const product = p.data() as any;
    const sub = await db.collection('products').doc(p.id).collection('reviews').get();
    for (const r of sub.docs) {
      const d = r.data() as any;
      const syntheticId = `legacy_${p.id}_${r.id}`;
      if (alreadyMigrated.has(syntheticId)) continue;

      const text = String(d?.comment ?? '').trim();
      if (!text) continue;

      const sellerId = d?.sellerId ?? product?.sellerId ?? null;

      plan.push({
        id: syntheticId,
        product: product?.title ?? p.id,
        orderId: sellerId && d?.buyerId ? orderByPair.get(`${sellerId}|${d.buyerId}`) ?? null : null,
        sellerId,
        rating: Number(d?.rating ?? 0),
        text,
        authorName: d?.authorName || d?.buyerName || 'A customer',
      });
    }
  }

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${plan.length} to migrate\n`);
  for (const p of plan) {
    console.log(
      `  ${p.product.slice(0, 30).padEnd(30)} ${p.rating}★ seller=${p.sellerId?.slice(0, 8) ?? 'NONE'} ${p.orderId ? `order ${p.orderId}` : 'no matching order'}`,
    );
  }

  if (!APPLY) {
    console.log('\nNothing written. Re-run with --apply.');
    return;
  }

  const batch = db.batch();
  const totals = new Map<string, { total: number; count: number }>();

  for (const p of plan) {
    const sellerId = p.sellerId;

    batch.set(db.collection('reviews').doc(p.id), {
      orderId: p.orderId,
      legacy: true,
      sellerId,
      byCustomer: {
        rating: p.rating,
        text: p.text,
        authorName: p.authorName,
        createdAt: FieldValue.serverTimestamp(),
        status: 'published',
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    if (sellerId) {
      const cur = totals.get(sellerId) ?? { total: 0, count: 0 };
      cur.total += p.rating;
      cur.count += 1;
      totals.set(sellerId, cur);
    }
  }

  for (const [sellerId, t] of totals) {
    batch.set(
      db.collection('ratingSummaries').doc(sellerId),
      { sellerRatingTotal: FieldValue.increment(t.total), sellerRatingCount: FieldValue.increment(t.count), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }

  await batch.commit();
  console.log(`\nMigrated ${plan.length} review(s) across ${totals.size} business(es).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
