
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/firebase/admin';
import type { Order } from '@/lib/types';

export async function GET(request: Request) {
  // Initialize Firebase Admin SDK within the handler
  try {
    initializeAdminApp();
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK in API route', error);
    return NextResponse.json({ error: 'Internal Server Error', details: 'Could not initialize backend services.' }, { status: 500 });
  }
    
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Verify the token and get the user's UID
    const decodedToken = await getAuth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // Check if the user is an admin
    const db = getFirestore();
    const userProfileDoc = await db.collection('userProfiles').doc(uid).get();

    if (!userProfileDoc.exists || userProfileDoc.data()?.userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // --- Aggregation Logic ---

    // Get the last 7 days
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0); // Beginning of 7 days ago

    const sevenDaysAgoTimestamp = Timestamp.fromDate(sevenDaysAgo);

    const ordersSnapshot = await db
      .collection('orders')
      .where('orderDate', '>=', sevenDaysAgoTimestamp)
      .where('orderStatus', 'in', ['delivered', 'shipped', 'processing'])
      .get();
      
    const salesByDay: Record<string, number> = {};
    const ordersByDay: Record<string, number> = {};
    
    // Initialize the last 7 days with 0 revenue
    for (let i = 0; i < 7; i++) {
        const date = new Date(sevenDaysAgo);
        date.setDate(sevenDaysAgo.getDate() + i);
        const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
        salesByDay[dateString] = 0;
        ordersByDay[dateString] = 0;
    }


    ordersSnapshot.forEach(doc => {
      const order = doc.data() as Order;
      if (order.orderDate) {
        // Correctly convert Firestore Timestamp to JS Date before processing
        const dateString = (order.orderDate as any).toDate().toISOString().split('T')[0];
        if (salesByDay[dateString] !== undefined) {
             salesByDay[dateString] += order.totalAmount;
             ordersByDay[dateString] += 1;
        }
      }
    });

    const chartData = Object.entries(salesByDay).map(([date, revenue]) => ({
      date,
      revenue,
      orders: ordersByDay[date] || 0,
    })).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json(chartData);

  } catch (error: any) {
    console.error('API Sales Analytics Error:', error);
     if (error.code === 'auth/id-token-expired') {
      return NextResponse.json({ error: 'Token expired, please log in again.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
