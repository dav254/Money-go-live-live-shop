import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyRequestUser } from '@/lib/media/api-auth';
import { pbMirrorShop } from '@/lib/pocketbase/shops';
import { scrubForPocketBase } from '@/lib/pocketbase/server';
import { pbGetProfile } from '@/lib/pocketbase/profiles';
import { pingIndexNow } from '@/lib/seo/indexnow';

export const runtime = 'nodejs';

/**
 * POST /api/shops/sync { shopId? }
 *
 * Called (fire-and-forget) by the seller settings / branding screens after
 * every write to `sellerShops/{uid}`. The payload carries only the shop id —
 * the server reads the authoritative Firestore document itself, so a tampered
 * request cannot push a forged storefront into the VPS store. `shopId`
 * defaults to the caller's own uid (the doc id IS the owner); naming another
 * seller's shop requires admin.
 *
 * Mirror failures never fail the seller's real write: the response is always
 * 200 once the ownership check passes, with `mirrored: false` when the VPS
 * write did not happen.
 */
export async function POST(request: NextRequest) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { shopId?: string };
  const shopId = (body.shopId ?? user.uid).toString();
  if (!shopId || shopId.length > 128) {
    return NextResponse.json({ error: 'Invalid shopId' }, { status: 400 });
  }
  if (shopId !== user.uid && !(await isAdmin(user.uid))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const snap = await db.collection('sellerShops').doc(shopId).get().catch(() => null);
  if (!snap) return NextResponse.json({ mirrored: false, reason: 'read-failed' });
  if (!snap.exists) return NextResponse.json({ mirrored: false, reason: 'missing' });

  const data = (snap.data() ?? {}) as Record<string, unknown>;
  const mirrored = await pbMirrorShop(shopId, scrubForPocketBase(data) as Record<string, unknown>);
  // Shop create/edit: the public storefront URL changed — tell the search
  // index right now (own opt-in flag inside `pingIndexNow`; fire-and-forget,
  // never blocks the mirror, never throws). The URL is the PUBLIC shop page;
  // no seller data is sent anywhere but the index receiver.
  void pingIndexNow([`/sellers/${shopId}`]);
  return NextResponse.json({ ok: true, mirrored });
}

async function isAdmin(uid: string): Promise<boolean> {
  // VPS profile first (survives a Firestore outage), Firestore second.
  const mirrored = await pbGetProfile(uid);
  if (mirrored?.userRole) return mirrored.userRole === 'admin';
  try {
    const profile = await db.collection('userProfiles').doc(uid).get();
    return profile.data()?.userRole === 'admin';
  } catch {
    return false;
  }
}
