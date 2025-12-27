
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/server';
import type { Order } from '@/lib/types';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

/**
 * API route to fetch all orders for the authenticated seller.
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

    const ordersQuery = query(
      collection(db, 'orders'),
      where('sellerId', '==', uid),
      orderBy('orderDate', 'desc')
    );

    const querySnapshot = await getDocs(ordersQuery);
    
    const orders = querySnapshot.docs.map(doc => {
        const data = doc.data() as Order;
        // Convert Firestore Timestamp to a serializable format (ISO string)
        return {
            ...data,
            id: doc.id,
            orderDate: data.orderDate.toDate().toISOString(),
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
