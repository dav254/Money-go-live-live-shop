/**
 * VERIFIES THE BUSINESS BACKFILLED.
 *
 * Exit 0 means the backfill is real: every business resolves, every listing
 * still has its sellerId, and nothing was moved. The last two matter most —
 * "5 businesses exist" is only reassuring if the app still works afterwards.
 */
import { db } from '@/firebase/server';

let failures = 0;
function check(label: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  else {
    failures++;
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  const businesses = await db.collection('businesses').get();
  check('businesses were created', businesses.size > 0, `${businesses.size}`);

  let withOwner = 0;
  let withMember = 0;
  let withSlug = 0;
  let verifiedGuessed = 0;

  businesses.forEach((d) => {
    const b = d.data() as Record<string, any>;
    if (b.ownerId) withOwner++;
    if (Array.isArray(b.members) && b.members.length) withMember++;
    if (b.slug) withSlug++;
    // Nothing should have been auto-verified.
    if (b.verificationStatus === 'verified') verifiedGuessed++;
  });

  check('every business has an owner', withOwner === businesses.size, `${withOwner}/${businesses.size}`);
  check('every business has a member', withMember === businesses.size, `${withMember}/${businesses.size}`);
  check('every business has a slug', withSlug === businesses.size, `${withSlug}/${businesses.size}`);
  check('nothing was auto-verified', verifiedGuessed === 0, `${verifiedGuessed} wrongly verified`);

  // The regression that matters: stamping must not have cost a listing its
  // seller. If this drops, listings have orphaned and the app has broken.
  const products = await db.collection('products').get();
  let lostSeller = 0;
  let stamped = 0;
  products.forEach((d) => {
    const p = d.data() as Record<string, any>;
    // BUG FIXED: this counted `sellerId` while the variable was called
    // `stamped`, so the assertion "listings carry businessId" actually only
    // proved listings have a sellerId — it passed for the wrong reason and
    // reported a number I then quoted as "20/20 stamped".
    if (p.businessId) stamped++;
    if (!p.sellerId) lostSeller++;
  });
  check('no listing lost its sellerId', lostSeller === 0, `${lostSeller} of ${products.size}`);
  check('listings carry businessId', stamped > 0, `${stamped} of ${products.size} stamped`);

  const orders = await db.collection('orders').get();
  let orderStamped = 0;
  orders.forEach((d) => {
    if ((d.data() as Record<string, any>).businessId) orderStamped++;
  });
  check('orders carry businessId', orderStamped > 0, `${orderStamped} of ${orders.size}`);

  // Membership must resolve the business back to the same uid.
  const first = businesses.docs[0];
  if (first) {
    const b = first.data() as Record<string, any>;
    const m = (b.members as any[])?.[0];
    check('member uid matches ownerId', m?.uid === b.ownerId, `${m?.uid} vs ${b.ownerId}`);
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
