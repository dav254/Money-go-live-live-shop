import { NextResponse, type NextRequest } from 'next/server';
import { auth, db } from '@/firebase/server';
import { pbListOrdersByParty } from '@/lib/pocketbase/orders';
import { toIso } from '@/lib/mobile/public-listing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/mobile/orders — the signed-in buyer's own orders.
 *
 * There was no reader for this on the website: the buyer orders page reads
 * Firestore directly from the browser. The Android app cannot, and should not,
 * carry the Firestore SDK or its rules — so this route is the mobile contract
 * for that same data.
 *
 * Authorization is the verified Bearer token and nothing else: the uid comes
 * from `verifyIdToken`, never from a query parameter, so one buyer cannot ask
 * for another's orders. Every order in `orders` already names its two parties;
 * the filter is applied server-side on both stores.
 *
 * Same read order as the rest of the platform — VPS store first (orders are
 * mirrored at checkout and on every status change), Firestore second — so a
 * Firestore outage cannot hide a purchase a person already paid for.
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
    const mirrored = await pbListOrdersByParty({ buyerId: uid });
    if (mirrored) {
      return NextResponse.json({
        orders: mirrored.map((o) => project(o.id, o.data as Record<string, unknown>)),
        source: 'vps',
      });
    }

    const snap = await db
      .collection('orders')
      .where('buyerId', '==', uid)
      .limit(200)
      .get()
      .catch(() => null);

    const orders = (snap?.docs ?? []).map((doc) =>
      project(doc.id, doc.data() as Record<string, unknown>),
    );

    orders.sort((a, b) => (b.placedAt ? Date.parse(b.placedAt) : 0) - (a.placedAt ? Date.parse(a.placedAt) : 0));

    return NextResponse.json({ orders, source: 'firestore' });
  } catch {
    console.error('[mobile/orders] read failed');
    return NextResponse.json({ error: 'Could not load your orders.' }, { status: 500 });
  }
}

interface MobileOrderItem {
  productId?: string;
  name: string;
  price?: number;
  quantity?: number;
  imageUrl?: string;
}

interface MobileOrder {
  id: string;
  status: string;
  total?: number;
  currency?: string;
  placedAt: string | null;
  items: MobileOrderItem[];
  sellerId?: string;
  shippingAddress?: string;
  paymentMethod?: string;
  trackingNumber?: string;
  /** True when the order is already delivered — the review-eligible state. */
  canReview: boolean;
}

/**
 * Explicit field list. Shipping address and tracking are included because this
 * is the buyer's own order; nothing about the seller's internals is.
 */
function project(id: string, data: Record<string, unknown>): MobileOrder {
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items: MobileOrderItem[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const name = str(item.name) ?? str(item.productName);
    if (!name) continue;
    items.push({
      productId: str(item.productId),
      name,
      price: num(item.price),
      quantity: num(item.quantity),
      imageUrl: str(item.imageUrl) ?? str(item.productImage),
    });
  }

  // Orders written before the cart checkout carry one product and no line
  // items. Synthesise the single line so the list is never blank for them.
  if (items.length === 0 && str(data.productName)) {
    items.push({
      productId: str(data.productId),
      name: str(data.productName) as string,
      price: num(data.productPrice),
      quantity: num(data.quantity),
      imageUrl: str(data.productImage),
    });
  }

  const status = str(data.orderStatus) ?? str(data.status) ?? 'pending';

  return {
    id,
    status,
    total: num(data.totalAmount) ?? num(data.total),
    currency: str(data.currency) ?? str(data.localCurrency),
    placedAt: toIso(data.orderDate) ?? toIso(data.createdAt),
    items,
    sellerId: str(data.sellerId),
    shippingAddress: str(data.shippingAddress),
    paymentMethod: str(data.paymentMethod),
    trackingNumber: str(data.trackingNumber) ?? str(data.trackingCode),
    canReview: status === 'delivered' && data.buyerConfirmed !== false,
  };
}
