/**
 * STAMP `businessId` ONTO `sellerShops`.
 *
 * ## Why the website could not see the business
 *
 * The business documents are keyed by id and carry `ownerId` plus an inline
 * `members` array. Firestore cannot query *inside* an array of objects, so a
 * client asking "which business belongs to this seller?" had exactly one
 * option: download every business and filter. The app solved it with
 * `/api/businesses/mine`; the public website has no signed-in user to run that
 * against, because a visitor looking at someone's shop is not logged in.
 *
 * So the link has to live on the shop document, which is already keyed by the
 * seller's uid. One field, written once, and every surface can get from a
 * seller to their business with a single document read.
 *
 * Additive: nothing is moved, nothing is overwritten.
 *
 * Default is a dry run. Pass `--apply` to write.
 */

import { db } from '../src/firebase/server';

const APPLY = process.argv.includes('--apply');

async function main() {
  const businesses = await db.collection('businesses').get();
  const byOwner = new Map<string, string>();
  for (const d of businesses.docs) {
    const b = d.data() as any;
    if (b.ownerId) byOwner.set(b.ownerId, d.id);
    if (Array.isArray(b.members)) {
      for (const m of b.members) {
        if (m?.uid && !byOwner.has(m.uid)) byOwner.set(m.uid, d.id);
      }
    }
  }

  const shops = await db.collection('sellerShops').get();
  const toWrite: { uid: string; shop: string; businessId: string }[] = [];
  const skipped: { uid: string; shop: string; why: string }[] = [];

  for (const d of shops.docs) {
    const shop = d.data() as any;
    const name = shop.shopName || d.id;
    if (shop.businessId) {
      skipped.push({ uid: d.id, shop: name, why: `already ${shop.businessId}` });
      continue;
    }
    const businessId = byOwner.get(d.id);
    if (!businessId) {
      skipped.push({ uid: d.id, shop: name, why: 'no business for this seller' });
      continue;
    }
    toWrite.push({ uid: d.id, shop: name, businessId });
  }

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${toWrite.length} to write, ${skipped.length} skipped\n`);
  for (const w of toWrite) console.log(`  ${w.shop.padEnd(24)} → ${w.businessId}`);
  for (const s of skipped) console.log(`  skip ${s.shop.padEnd(24)} — ${s.why}`);

  if (!APPLY) {
    console.log('\nNothing written. Re-run with --apply.');
    return;
  }

  const batch = db.batch();
  for (const w of toWrite) {
    batch.set(db.collection('sellerShops').doc(w.uid), { businessId: w.businessId }, { merge: true });
  }
  await batch.commit();
  console.log(`\nStamped ${toWrite.length} shops.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
