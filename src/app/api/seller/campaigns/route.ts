
'use server';

import { NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import type { BoostRequest, Product } from '@/lib/types';

export async function GET(request: Request) {
  try {
    // 2. Authenticate the user from the request header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or malformed token.' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    
    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // 3. Fetch campaigns and products for the authenticated seller in parallel
    const campaignsQuery = db.collection('boost_requests').where('sellerId', '==', uid).orderBy('createdAt', 'desc');
    const productsQuery = db.collection('products').where('sellerId', '==', uid);

    const [campaignsSnapshot, productsSnapshot] = await Promise.all([
        campaignsQuery.get(),
        productsQuery.get()
    ]);

    const campaigns = campaignsSnapshot.docs.map(doc => {
        const data = doc.data() as BoostRequest;
        return {
            ...data,
            id: doc.id,
            // Convert Firestore Timestamps to serializable ISO strings
            createdAt: data.createdAt ? (data.createdAt as any).toDate().toISOString() : null,
            updatedAt: data.updatedAt ? (data.updatedAt as any).toDate().toISOString() : null,
        }
    });

    const products: Product[] = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

    // 4. Return the fetched data
    return NextResponse.json({ campaigns, products });

  } catch (error: any) {
    // Log the detailed error on the server for debugging
    console.error('API Error in /api/seller/campaigns:', error);
    
    let errorMessage = 'An internal server error occurred.';
    let status = 500;

    if (error.code === 'auth/id-token-expired') {
      errorMessage = 'Authentication token has expired. Please log in again.';
      status = 401;
    } else if (error.code === 'failed-precondition' || error.code === 'invalid-argument') {
      errorMessage = 'A database query error occurred. This might be due to a missing index.';
      status = 400; // Bad Request, as the client's request can't be fulfilled by the DB
    } else if (error.message) {
        errorMessage = error.message;
    }

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
