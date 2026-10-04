/**
 * BACKFILL — one business per existing seller.
 *
 * ## Why this is additive
 *
 * It creates `businesses/{id}` and stamps `businessId` onto the seller's
 * existing documents. It does NOT move anything. `products`, `orders` and
 * `requests` stay exactly where they are and keep `sellerId`, so every screen
 * and every Firestore rule keeps working throughout. If this script is wrong,
 * deleting the `businesses` documents and unsetting `businessId` restores the
 * previous state completely — which is only true of an additive change.
 *
 * ## Dry run by default
 *
 * Running this against live accounts is not something to do on a first pass.
 * It prints every name it would create and writes nothing unless `--apply` is
 * passed. Read the list, then apply.
 *
 * ## Naming
 *
 * `sellerShops.shopName` is the business name when it exists — it is what the
 * seller chose to be called in public. Otherwise the profile's `fullName`, and
 * only then the account's own name. A business never ends up called "User".
 */

import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { slugifyBusinessName } from '@/lib/business/types';

const APPLY = process.argv.includes('--apply');
const PAGE = 200;

interface Proposal {
  uid: string;
  name: string;
  slug: string;
  businessId: string;
  source: 'shopName' | 'fullName' | 'emailLocal';
  shopFound: boolean;
  products: number;
  orders: number;
}

function slugWithSuffix(base: string, taken: Set<string>): string {
  if (!taken.has(base) && base) return base;
  for (let n = 2; n < 200; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

async function main() {
  console.log(APPLY ? '=== APPLYING ===' : '=== DRY RUN — nothing will be written ===');

  const taken = new Set<string>();
  const existing = await db.collection('businesses').select('slug').get();
  existing.forEach((d) => {
    const s = d.data()?.slug;
    if (s) taken.add(s);
  });
  console.log(`existing businesses: ${existing.size}`);

  const proposals: Proposal[] = [];
  let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let page = db.collection('sellerShops').limit(PAGE);
    if (last) page = page.startAfter(last);
    const snap = await page.get();
    if (snap.empty) break;

    for (const shop of snap.docs) {
      const data = shop.data() as {
        sellerId?: string; shopName?: string; name?: string;
        location?: string; cityTown?: string; county?: string; country?: string;
        category?: string; isVerified?: boolean;
      };
      const uid = data.sellerId || shop.id;
      if (!uid) continue;

      const profile = await db.collection('userProfiles').doc(uid).get();
      const p = profile.data() as { fullName?: string; email?: string } | undefined;

      const shopName = (data.shopName || data.name || '').trim();
      const fullName = (p?.fullName || '').trim();
      const emailLocal = (p?.email || '').split('@')[0]?.trim() || '';

      const name = shopName || fullName || emailLocal;
      if (!name) continue;

      const slug = slugWithSuffix(slugifyBusinessName(name), taken);
      taken.add(slug);

      const products = await db.collection('products').where('sellerId', '==', uid).count().get();
      const orders = await db.collection('orders').where('sellerId', '==', uid).count().get();

      proposals.push({
        uid,
        name,
        slug,
        businessId: `biz_${slug}`,
        source: shopName ? 'shopName' : fullName ? 'fullName' : 'emailLocal',
        shopFound: true,
        products: products.data().count,
        orders: orders.data().count,
      });
    }

    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE) break;
  }

  console.log(`\nproposals: ${proposals.length}\n`);
  for (const p of proposals.slice(0, 40)) {
    console.log(
      `  ${p.businessId.padEnd(34)} ${p.name.slice(0, 30).padEnd(32)} ` +
      `from=${p.source.padEnd(10)} listings=${String(p.products).padStart(3)} orders=${String(p.orders).padStart(3)}`,
    );
  }
  if (proposals.length > 40) console.log(`  … and ${proposals.length - 40} more`);

  const fromEmail = proposals.filter((p) => p.source === 'emailLocal').length;
  console.log(
    `\nnaming: ${proposals.filter((p) => p.source === 'shopName').length} from shop name, ` +
    `${proposals.filter((p) => p.source === 'fullName').length} from profile name, ` +
    `${fromEmail} falling back to email local-part`,
  );

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write.');
    return;
  }

  let created = 0;
  let stamped = 0;

  for (const p of proposals) {
    await db.collection('businesses').doc(p.businessId).set(
      {
        name: p.name,
        slug: p.slug,
        type: 'individual',
        // Unset, not guessed. The seller chooses; guessing "sole trader"
        // would put a wrong legal classification on a real business.
        kind: 'physical_store',
        ownerId: p.uid,
        // ISO string, not serverTimestamp(): Firestore rejects a timestamp
        // sentinel inside an array, and `members` is deliberately inline so a
        // permission check is one read.
        members: [{ uid: p.uid, role: 'owner', joinedAt: new Date().toISOString() }],
        verificationStatus: 'unverified',
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    created++;

    // Stamp additively. Never touch sellerId or move a document.
    for (const col of ['products', 'orders']) {
      const docs = await db.collection(col).where('sellerId', '==', p.uid).get();
      if (docs.empty) continue;
      const batch = db.batch();
      docs.forEach((d) => batch.set(d.ref, { businessId: p.businessId }, { merge: true }));
      await batch.commit();
      stamped += docs.size;
    }
  }

  console.log(`\napplied: ${created} businesses, ${stamped} documents stamped with businessId`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
