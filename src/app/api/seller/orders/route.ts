
import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import type { Order } from '@/lib/types';

/**
 * API route to fetch all orders for the authenticated seller.
 * Uses Firebase Admin SDK for server-side processing.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized: Missing token' }, { status: 401 });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const ordersSnapshot = await db.collection('orders')
        .where('sellerId', '==', uid)
        .orderBy('orderDate', 'desc')
        .get();
    
    const orders = ordersSnapshot.docs.map(doc => {
        const data = doc.data() as Order;
        return {
            ...data,
            id: doc.id,
            // Convert Firestore Timestamp to ISO string for serializability
            orderDate: data.orderDate ? (data.orderDate as any).toDate().toISOString() : null,
        };
    });

    return NextResponse.json(orders);

  } catch (error: any) {
    console.error('API Error fetching seller orders:', error);
    if (error.code === 'auth/id-token-expired') {
        return NextResponse.json({ message: 'Unauthorized: Token expired' }, { status: 401 });
    }
    return NextResponse.json({ message: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
