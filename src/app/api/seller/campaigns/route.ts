
'use server';

import { NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/admin';
import type { AdCampaign, Product } from '@/lib/types';

export async function GET(request: Request) {
  try {
    // 1. Initialize Firebase Admin and get services
    const adminApp = initializeAdminApp();
    const { getAuth } = await import('firebase-admin/auth');
    const { getFirestore } = await import('firebase-admin/firestore');
    
    const auth = getAuth(adminApp);
    const db = getFirestore(adminApp);

    // 2. Authenticate the user from the request header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or malformed token.' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    
    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // 3. Fetch campaigns and products for the authenticated seller in parallel
    const campaignsRef = db.collection('adCampaigns');
    const campaignsQuery = campaignsRef.where('sellerId', '==', uid).orderBy('startDate', 'desc');
    
    const productsRef = db.collection('products');
    const productsQuery = productsRef.where('sellerId', '==', uid);

    const [campaignsSnapshot, productsSnapshot] = await Promise.all([
        campaignsQuery.get(),
        productsQuery.get()
    ]);

    const campaigns: AdCampaign[] = campaignsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdCampaign));
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
