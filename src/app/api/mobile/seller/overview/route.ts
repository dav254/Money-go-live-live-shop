import { NextResponse, type NextRequest } from 'next/server';
import { auth, db } from '@/firebase/server';
import { pbListOrdersByParty } from '@/lib/pocketbase/orders';
import { pbListProductsBySeller } from '@/lib/pocketbase/products';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/mobile/seller/overview — the seller dashboard numbers, in one call.
 *
 * The Android dashboard needs four counts and one money figure on open. The
 * website's seller home composes them in the browser from several Firestore
 * reads; a phone should not open six connections and a cold Firestore query to
 * render a header, so this route answers them together from the VPS mirror and
 * falls back to Firestore only when the mirror is unavailable.
 *
 * Everything is scoped to the verified uid. The money figure is deliberately
 * labelled `deliveredRevenue` and counts only delivered orders — it is not an
 * available balance, and the app does not present it as one.
 */
export async function GET(request: NextRequest) {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let uid: string;
  try {
    uid = (await auth.verifyIdToken(token)).uid;
  } catch {
    return NextResponse.json({ error: 'Your session has expired. Sign in again.' }, { status: 401 });
  }

  try {
    // ── orders ──────────────────────────────────────────────────────────────
    let orders: Array<{ status: string; total: number }> = [];

    const mirrored = await pbListOrdersByParty({ sellerId: uid });
    if (mirrored) {
      orders = mirrored.map((o) => ({
        status: String((o.data as Record<string, unknown>).orderStatus ?? o.orderStatus ?? 'pending'),
        total: Number((o.data as Record<string, unknown>).totalAmount ?? o.totalAmount ?? 0) || 0,
      }));
    } else {
      const snap = await db
        .collection('orders')
        .where('sellerId', '==', uid)
        .limit(300)
        .get()
        .catch(() => null);
      orders = (snap?.docs ?? []).map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        return {
          status: String(data.orderStatus ?? data.status ?? 'pending'),
          total: Number(data.totalAmount ?? 0) || 0,
        };
      });
    }

    const needsAction = orders.filter((o) =>
      ['pending', 'paid', 'processing', 'packed'].includes(o.status),
    ).length;
    const deliveredRevenue = orders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + o.total, 0);

    // ── listings ────────────────────────────────────────────────────────────
    let listings = 0;
    let outOfStock = 0;

    const products = await pbListProductsBySeller(uid, 300);
    if (products) {
      listings = products.length;
      outOfStock = products.filter((p) => typeof p.stock === 'number' && p.stock <= 0).length;
    } else {
      const snap = await db
        .collection('products')
        .where('sellerId', '==', uid)
        .limit(300)
        .get()
        .catch(() => null);
      const docs = (snap?.docs ?? []).filter(
        (doc) => (doc.data() as Record<string, unknown>).status !== 'deleted',
      );
      listings = docs.length;
      outOfStock = docs.filter((doc) => {
        const stock = (doc.data() as Record<string, unknown>).stock;
        return typeof stock === 'number' && stock <= 0;
      }).length;
    }

    return NextResponse.json({
      orders: {
        total: orders.length,
        needsAction,
        delivered: orders.filter((o) => o.status === 'delivered').length,
        cancelled: orders.filter((o) => o.status === 'cancelled').length,
      },
      listings: { total: listings, outOfStock },
      deliveredRevenue: Math.round(deliveredRevenue * 100) / 100,
    });
  } catch {
    console.error('[mobile/seller/overview] read failed');
    return NextResponse.json({ error: 'Could not load your dashboard.' }, { status: 500 });
  }
}
