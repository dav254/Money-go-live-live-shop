
'use server';

import { NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import type { Order, UserProfile } from '@/lib/types';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';

interface ManagedOrder extends Order {
    productName?: string;
    productImage?: string;
    buyerName?: string;
    resellerName?: string;
}

// Helper to fetch user profiles in batches to avoid multiple individual reads
async function getParticipantProfiles(userIds: string[]): Promise<Map<string, UserProfile>> {
    const profilesMap = new Map<string, UserProfile>();
    if (userIds.length === 0) {
        return profilesMap;
    }
    
    // Firestore 'in' queries are limited to 30 items. We batch just in case.
    const userChunks: string[][] = [];
    for (let i = 0; i < userIds.length; i += 30) {
        userChunks.push(userIds.slice(i, i + 30));
    }

    for (const chunk of userChunks) {
        const usersQuery = query(collection(db, 'userProfiles'), where('id', 'in', chunk));
        const usersSnapshot = await getDocs(usersQuery);
        usersSnapshot.forEach(doc => {
            profilesMap.set(doc.id, doc.data() as UserProfile);
        });
    }

    return profilesMap;
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const sellerId = decodedToken.uid;

    // 1. Fetch all orders for the seller
    const ordersQuery = query(collection(db, 'orders'), where('sellerId', '==', sellerId));
    const ordersSnapshot = await getDocs(ordersQuery);
    const orders = ordersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Order));

    // 2. Collect all unique participant IDs (buyers and resellers)
    const participantIds = new Set<string>();
    orders.forEach(order => {
        participantIds.add(order.buyerId);
        if (order.resellerId) {
            participantIds.add(order.resellerId);
        }
    });

    // 3. Fetch all participant profiles in one go
    const profilesMap = await getParticipantProfiles(Array.from(participantIds));

    // 4. Augment orders with participant names
    const managedOrders: ManagedOrder[] = orders.map(order => {
        const buyer = profilesMap.get(order.buyerId);
        const reseller = order.resellerId ? profilesMap.get(order.resellerId) : undefined;
        
        return {
            ...order,
            buyerName: buyer?.fullName || 'Unknown Buyer',
            resellerName: reseller?.fullName,
        };
    });

    return NextResponse.json(managedOrders);

  } catch (error: any) {
    console.error('API Error fetching seller orders:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
