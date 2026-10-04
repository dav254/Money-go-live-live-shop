import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { slugifyBusinessName } from './types';

/**
 * ENSURE A BUSINESS EXISTS FOR A SELLER.
 *
 * ## The hole this closes
 *
 * The backfill found a seller with 2 live listings and 3 orders and **no shop
 * document at all** — someone who was selling on Vidnov without ever creating
 * a shop. They are invisible to Nearby, to service areas, to verification and
 * to sponsored, because all of those hang off a business.
 *
 * The fix is not to chase that one seller. It is that a seller who has
 * published a listing has already answered the only question that matters, so
 * the business gets created for them rather than asked for.
 *
 * ## Security
 *
 * `uid` is the caller's verified uid and is NEVER read from a request body. The
 * caller proves which seller to resolve by naming a listing they own; the
 * seller on that listing comes from the listing document. A client cannot
 * therefore attach a business to somebody else's account.
 */

export interface EnsureResult {
  created: boolean;
  businessId: string;
  name: string;
  /** Listings that were stamped during this call. */
  stamped: number;
}

async function slugFree(base: string): Promise<string> {
  if (!base) return `business-${Date.now()}`;
  let candidate = base;
  for (let n = 2; n < 200; n++) {
    const snap = await db.collection('businesses').where('slug', '==', candidate).limit(1).get();
    if (snap.empty) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

export async function ensureBusinessForSeller(uid: string): Promise<EnsureResult | null> {
  if (!uid) return null;

  // Already has one? Then this is a no-op, not an error. Most calls land here.
  const owned = await db
    .collection('businesses')
    .where('ownerId', '==', uid)
    .limit(1)
    .get();
  if (!owned.empty) {
    const existing = owned.docs[0];
    return { created: false, businessId: existing.id, name: (existing.data() as any)?.name ?? '', stamped: 0 };
  }

  const profile = await db.collection('userProfiles').doc(uid).get();
  const p = profile.data() as { fullName?: string; email?: string } | undefined;
  const shop = await db.collection('sellerShops').doc(uid).get();
  const s = shop.data() as { shopName?: string; name?: string } | undefined;

  const name =
    (s?.shopName || s?.name || '').trim() ||
    (p?.fullName || '').trim() ||
    (p?.email || '').split('@')[0]?.trim() ||
    '';

  // No name anywhere: do not invent one. An empty business is worse than none,
  // because it looks real and claims a slug.
  if (!name) return null;

  const slug = await slugFree(slugifyBusinessName(name));
  const businessId = `biz_${slug}`;

  await db.collection('businesses').doc(businessId).set(
    {
      name,
      slug,
      // `individual` + unset kind: we know they sell, not whether they have a
      // registered company or a premises. They set that themselves.
      type: 'individual',
      kind: s?.shopName || s?.name ? 'physical_store' : 'home_based',
      ownerId: uid,
      // ISO string: Firestore rejects a timestamp sentinel inside an array.
      members: [{ uid, role: 'owner', joinedAt: new Date().toISOString() }],
      verificationStatus: 'unverified',
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // Stamp what they already have, so they are findable immediately rather than
  // only on listings created from now on.
  let stamped = 0;
  for (const col of ['products', 'orders']) {
    const docs = await db.collection(col).where('sellerId', '==', uid).get();
    if (docs.empty) continue;
    const batch = db.batch();
    docs.forEach((d) => batch.set(d.ref, { businessId }, { merge: true }));
    await batch.commit();
    stamped += docs.size;
  }

  return { created: true, businessId, name, stamped };
}
