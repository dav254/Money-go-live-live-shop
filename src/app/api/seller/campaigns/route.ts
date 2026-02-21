import { NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import type { BoostRequest, Product } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or malformed token.' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    
    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

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
            createdAt: data.createdAt ? (data.createdAt as any).toDate().toISOString() : null,
            updatedAt: data.updatedAt ? (data.updatedAt as any).toDate().toISOString() : null,
        }
    });

    const products: Product[] = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

    return NextResponse.json({ campaigns, products });

  } catch (error: any) {
    console.error('API Error in /api/seller/campaigns:', error);
    
    let errorMessage = 'An internal server error occurred.';
    let status = 500;

    if (error.code === 'auth/id-token-expired') {
      errorMessage = 'Authentication token has expired. Please log in again.';
      status = 401;
    }

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
