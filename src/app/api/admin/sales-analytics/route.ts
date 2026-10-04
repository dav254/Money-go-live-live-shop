import { NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import type { Order } from '@/lib/types';
import { cached, ADMIN_CACHE_TTL_MS } from '@/lib/admin/cache';

export const runtime = 'nodejs';

/** Empty 7-day series so the chart has a stable shape even when data is unavailable. */
function emptyWeek(): Array<{ date: string; revenue: number; orders: number }> {
  const out: Array<{ date: string; revenue: number; orders: number }> = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - 6);
  for (let i = 0; i < 7; i++) {
    out.push({ date: cursor.toISOString().split('T')[0], revenue: 0, orders: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

async function computeWeek(): Promise<Array<{ date: string; revenue: number; orders: number }>> {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const sevenDaysAgoTimestamp = Timestamp.fromDate(sevenDaysAgo);

  const ordersSnapshot = await db
    .collection('orders')
    .where('orderDate', '>=', sevenDaysAgoTimestamp)
    .get();

  const salesByDay: Record<string, number> = {};
  const ordersByDay: Record<string, number> = {};

  for (let i = 0; i < 7; i++) {
    const date = new Date(sevenDaysAgo);
    date.setDate(sevenDaysAgo.getDate() + i);
    const dateString = date.toISOString().split('T')[0];
    salesByDay[dateString] = 0;
    ordersByDay[dateString] = 0;
  }

  ordersSnapshot.forEach((doc) => {
    const order = doc.data() as Order;
    if (!['delivered', 'shipped', 'processing'].includes(order.orderStatus)) {
      return;
    }

    if (order.orderDate && typeof (order.orderDate as any).toDate === 'function') {
      const orderDate = (order.orderDate as any).toDate() as Date;
      if (orderDate >= sevenDaysAgo && orderDate <= today) {
        const dateString = orderDate.toISOString().split('T')[0];
        if (salesByDay[dateString] !== undefined) {
          // `totalAmount` is absent on older request-marketplace orders; fall
          // back to productPrice so the chart does not under-report.
          salesByDay[dateString] += order.totalAmount ?? order.productPrice ?? 0;
          ordersByDay[dateString] += 1;
        }
      }
    }
  });

  return Object.entries(salesByDay)
    .map(([date, revenue]) => ({
      date,
      revenue: revenue || 0,
      orders: ordersByDay[date] || 0,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * GET /api/admin/sales-analytics — 7-day revenue + order counts.
 *
 * Cached for a minute so a dashboard refresh does not re-scan the orders
 * collection on every mount.
 *
 * On a Firestore read failure (most often RESOURCE_EXHAUSTED when the Spark
 * plan's daily read cap is hit) this returns an empty-but-valid week with
 * `degraded: true` rather than a 500. A quota condition is not a server fault,
 * and the dashboard should show an empty chart instead of an error overlay.
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
    }

    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const userProfileDoc = await db.collection('userProfiles').doc(uid).get();
    const role = userProfileDoc.exists
      ? (userProfileDoc.data()?.userRole ?? userProfileDoc.data()?.role)
      : null;

    // Accept `role` as well as `userRole`: profiles written before the rename
    // only carry `role`, and the strict check silently locked real admins out.
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const chartData = await cached('admin:sales-analytics:week', ADMIN_CACHE_TTL_MS, computeWeek);

    if (chartData === null) {
      return NextResponse.json(emptyWeek(), {
        status: 200,
        headers: { 'X-Vidnov-Degraded': 'firestore-unavailable' },
      });
    }

    return NextResponse.json(chartData, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    // Logged rather than thrown: an exhausted read quota is expected
    // operational behaviour, not a crash.
    console.warn('[sales-analytics] serving degraded data:', message);
    return NextResponse.json(emptyWeek(), {
      status: 200,
      headers: { 'X-Vidnov-Degraded': 'firestore-unavailable' },
    });
  }
}