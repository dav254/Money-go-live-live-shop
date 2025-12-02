
import { NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/admin';
import type { AdCampaign, Product } from '@/lib/types';

export async function GET(request: Request) {
  try {
    // 1. Initialize Firebase Admin and get services dynamically
    initializeAdminApp();
    const { getAuth } = await import('firebase-admin/auth');
    const { getFirestore } = await import('firebase-admin/firestore');
    
    // 2. Authenticate the user from the request header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token.' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const db = getFirestore();

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
    console.error('API Error fetching seller campaigns:', error);
    // Provide more specific error messages based on the type of error
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
      return NextResponse.json({ error: 'Unauthorized: Invalid token provided.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
