import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyRequestUser } from '@/lib/media/api-auth';
import { pbListOrdersByParty } from '@/lib/pocketbase/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/mobile/seller/wallet — the seller's real money records.
 *
 * There is deliberately no "balance" field in the response. Vidnov does not
 * hold a spendable seller balance in this backend: payouts are requested
 * against delivered orders and recorded in `payouts`. Computing a number and
 * calling it a balance would be an invented figure, which is exactly what this
 * screen must not show. What is returned is what actually exists:
 *
 *   • delivered / in-transit order value (from the same orders the seller
 *     dashboard counts, VPS store first, Firestore second);
 *   • the seller's own `payouts` records, with their real statuses;
 *   • how many payout methods the account has saved.
 *
 * Every read is scoped to the verified uid.
 */

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: Request) {
  const user = await verifyRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // ── orders (VPS first) ──────────────────────────────────────────────────
    let orders: Array<{ status: string; total: number }> = [];
    const mirrored = await pbListOrdersByParty({ sellerId: user.uid });
    if (mirrored) {
      orders = mirrored.map((order) => {
        const data = (order.data ?? {}) as Record<string, unknown>;
        return {
          status: str(data.orderStatus ?? data.status) || 'pending',
          total: num(data.totalAmount ?? data.total),
        };
      });
    } else {
      const snap = await db
        .collection('orders')
        .where('sellerId', '==', user.uid)
        .limit(300)
        .get()
        .catch(() => null);
      orders = (snap?.docs ?? []).map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        return {
          status: str(data.orderStatus ?? data.status) || 'pending',
          total: num(data.totalAmount ?? data.total),
        };
      });
    }

    const deliveredSales = orders
      .filter((order) => order.status === 'delivered')
      .reduce((sum, order) => sum + order.total, 0);
    const inTransitSales = orders
      .filter((order) => ['shipped', 'delivery'].includes(order.status))
      .reduce((sum, order) => sum + order.total, 0);

    // ── payouts (seller's own records only) ─────────────────────────────────
    const payoutSnap = await db
      .collection('payouts')
      .where('sellerId', '==', user.uid)
      .limit(100)
      .get()
      .catch(() => null);

    const payouts = (payoutSnap?.docs ?? [])
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        return {
          id: doc.id,
          amount: num(data.amount ?? data.total),
          currency: str(data.currency) || 'USD',
          status: str(data.status) || 'pending',
          method: str(data.method ?? data.methodName),
          createdAt:
            typeof data.createdAt === 'string'
              ? data.createdAt
              : typeof data.requestDate === 'string'
                ? data.requestDate
                : null,
        };
      })
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

    const paidOut = payouts
      .filter((payout) => ['paid', 'completed', 'approved'].includes(payout.status))
      .reduce((sum, payout) => sum + payout.amount, 0);
    const pendingPayouts = payouts
      .filter((payout) => ['pending', 'processing', 'requested'].includes(payout.status))
      .reduce((sum, payout) => sum + payout.amount, 0);

    // ── payout methods (count only — no account numbers cross the wire) ─────
    let payoutMethods = 0;
    try {
      const methods = await db
        .collection('userProfiles')
        .doc(user.uid)
        .collection('payoutMethods')
        .limit(20)
        .get();
      payoutMethods = methods.size;
    } catch {
      // A missing subcollection is a valid state: no methods saved yet.
    }

    const round = (value: number) => Math.round(value * 100) / 100;

    return NextResponse.json({
      deliveredSales: round(deliveredSales),
      inTransitSales: round(inTransitSales),
      paidOut: round(paidOut),
      pendingPayouts: round(pendingPayouts),
      payouts,
      payoutMethods,
      orderCount: orders.length,
    });
  } catch (error) {
    console.error('[mobile/seller/wallet] read failed:', error);
    return NextResponse.json({ error: 'Could not load your wallet.' }, { status: 500 });
  }
}
