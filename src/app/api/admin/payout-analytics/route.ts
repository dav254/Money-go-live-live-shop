import { NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { pbPendingPayoutTotal } from '@/lib/pocketbase/wallet';
import { pbGetProfile } from '@/lib/pocketbase/profiles';
import type { Payout } from '@/lib/types';
import { cached, ADMIN_CACHE_TTL_MS } from '@/lib/admin/cache';

export const runtime = 'nodejs';

async function computePendingTotal(): Promise<number> {
  /*
   * VPS store first (payout requests are mirrored on creation), Firestore
   * second — the admin money strip keeps its number during a Firestore
   * outage instead of degrading to 0.
   */
  const mirrored = await pbPendingPayoutTotal();
  if (mirrored !== null) return mirrored;

  const snap = await db.collection('payouts').where('status', '==', 'pending').get();
  let total = 0;
  snap.forEach((doc) => {
    const payout = doc.data() as Payout;
    total += payout.amount ?? 0;
  });
  return total;
}

/**
 * GET /api/admin/payout-analytics — total of pending payouts.
 *
 * Cached for a minute; a dashboard refresh should not re-read the payouts
 * collection. On a Firestore read failure (typically RESOURCE_EXHAUSTED once the
 * Spark plan's daily read cap is hit) this returns 0 with a `degraded` flag
 * rather than a 500, because a quota condition is not a server fault.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // Role: VPS profile first (survives a Firestore outage), Firestore second.
    let role = (await pbGetProfile(uid))?.userRole ?? null;
    if (role === null) {
      const userProfileDoc = await db.collection('userProfiles'). doc(uid).get();
      role = userProfileDoc.exists
        ? (userProfileDoc.data()?.userRole ?? userProfileDoc.data()?.role)
        : null;
    }

    // `userRole ?? role`: older profiles only carry `role`, and checking
    // `userRole` alone returned 403 for a genuine admin.
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const totalPending = await cached('admin:payout-analytics:pending', ADMIN_CACHE_TTL_MS, computePendingTotal);

    if (totalPending === null) {
      return NextResponse.json(
        { totalPending: 0, degraded: true },
        { status: 200, headers: { 'X-Vidnov-Degraded': 'firestore-unavailable' } }
      );
    }

    return NextResponse.json(
      { totalPending, degraded: false },
      { headers: { 'Cache-Control': 'private, max-age=30' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[payout-analytics] serving degraded data:', message);
    return NextResponse.json(
      { totalPending: 0, degraded: true },
      { status: 200, headers: { 'X-Vidnov-Degraded': 'firestore-unavailable' } }
    );
  }
}