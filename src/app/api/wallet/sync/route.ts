import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyRequestUser } from '@/lib/media/api-auth';
import { pbMirrorPayout, pbMirrorPayment } from '@/lib/pocketbase/wallet';
import { scrubForPocketBase } from '@/lib/pocketbase/server';
import { pbGetProfile } from '@/lib/pocketbase/profiles';

export const runtime = 'nodejs';

/**
 * POST /api/wallet/sync { kind: 'payout' | 'payment', id }
 *
 * Called (fire-and-forget) by the client after every wallet record it creates
 * in Firestore: a seller's payout REQUEST (`payouts`) and the checkout points
 * simulation's payment row (`payments`). The payload is only the id — the
 * server reads the authoritative Firestore document itself, so a tampered
 * request cannot push a forged ledger row into the VPS store. The caller must
 * own the record (payout sellerId / payment userId) or be an admin.
 *
 * Mirror failures never fail the caller's real write: the response is always
 * 200 once the ownership check passes, with `mirrored: false` when the VPS
 * write did not happen. (Payment rows created by the payment webhooks are
 * mirrored inside those webhooks — this route covers the client-written ones.)
 */
export async function POST(request: NextRequest) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    kind?: string;
    id?: string;
  };
  const kind = body.kind === 'payment' ? 'payment' : 'payout';
  const id = (body.id ?? '').toString();
  if (!id || id.length > 128) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const collection = kind === 'payment' ? 'payments' : 'payouts';
  const snap = await db
    .collection(collection)
    .doc(id)
    .get()
    .catch(() => null);
  if (!snap) return NextResponse.json({ mirrored: false, reason: 'read-failed' });
  if (!snap.exists) return NextResponse.json({ mirrored: false, reason: 'missing' });

  const data = (snap.data() ?? {}) as Record<string, unknown>;
  const owner = kind === 'payment' ? data.userId : data.sellerId;
  if (owner !== user.uid && !(await isAdmin(user.uid))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const clean = scrubForPocketBase(data) as Record<string, unknown>;
  const mirrored =
    kind === 'payment' ? await pbMirrorPayment(id, clean) : await pbMirrorPayout(id, clean);
  return NextResponse.json({ ok: true, mirrored });
}

async function isAdmin(uid: string): Promise<boolean> {
  // VPS profile first (survives a Firestore outage), Firestore second.
  const mirrored = await pbGetProfile(uid);
  if (mirrored?.userRole) return mirrored.userRole === 'admin';
  try {
    const profile = await db.collection('userProfiles'). doc(uid).get();
    return profile.data()?.userRole === 'admin';
  } catch {
    return false;
  }
}
