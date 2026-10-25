import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyRequestUser } from '@/lib/media/api-auth';
import { pbMirrorOrder } from '@/lib/pocketbase/orders';
import { scrubForPocketBase } from '@/lib/pocketbase/server';
import { pbGetProfile } from '@/lib/pocketbase/profiles';

export const runtime = 'nodejs';

/**
 * POST /api/orders/sync { orderId }
 *
 * Called (fire-and-forget) by the client after every order it creates or
 * updates in Firestore — checkout, payment success, cancellation. The payload
 * is only the order id: the server reads the authoritative Firestore document
 * itself, so a tampered request cannot push a forged order into the VPS
 * store. The caller must be a party to the order (buyer / seller / reseller)
 * or an admin.
 *
 * Mirror failures never fail the caller's real write: the response is always
 * 200 once the ownership check passes, with `mirrored: false` when the VPS
 * write did not happen.
 */
export async function POST(request: NextRequest) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { orderId?: string };
  const orderId = (body.orderId ?? '').toString();
  if (!orderId || orderId.length > 128) {
    return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 });
  }

  const snap = await db
    .collection('orders')
    .doc(orderId)
    .get()
    .catch(() => null);
  if (!snap) return NextResponse.json({ mirrored: false, reason: 'read-failed' });
  if (!snap.exists) return NextResponse.json({ mirrored: false, reason: 'missing' });

  const data = (snap.data() ?? {}) as Record<string, unknown>;
  const parties = [data.buyerId, data.sellerId, data.resellerId];
  if (!parties.includes(user.uid) && !(await isAdmin(user.uid))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const mirrored = await pbMirrorOrder(orderId, scrubForPocketBase(data) as Record<string, unknown>);
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
