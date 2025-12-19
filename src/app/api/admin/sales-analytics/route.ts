
import { NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { Order } from '@/lib/types';

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

    if (!userProfileDoc.exists || userProfileDoc.data()?.userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    ordersSnapshot.forEach(doc => {
      const order = doc.data() as Order;
      if (!['delivered', 'shipped', 'processing'].includes(order.orderStatus)) {
          return;
      }
      
      if (order.orderDate && typeof (order.orderDate as any).toDate === 'function') {
        const orderDate = (order.orderDate as any).toDate();
        if (orderDate >= sevenDaysAgo && orderDate <= today) {
            const dateString = orderDate.toISOString().split('T')[0];
            if (salesByDay[dateString] !== undefined) {
                 salesByDay[dateString] += order.totalAmount;
                 ordersByDay[dateString] += 1;
            }
        }
      }
    });

    const chartData = Object.entries(salesByDay).map(([date, revenue]) => ({
      date,
      revenue: revenue || 0,
      orders: ordersByDay[date] || 0,
    })).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json(chartData);

  } catch (error: any) {
    console.error('API Sales Analytics Error:', error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
