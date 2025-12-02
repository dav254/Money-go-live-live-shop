
'use server';

import { NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/admin';
import type { AdCampaign, Product } from '@/lib/types';

// Do NOT import firebase-admin services at the top level.
// They will be imported dynamically after initialization.

export async function GET(request: Request) {
  try {
    // 1. Initialize Firebase Admin App. This is idempotent and safe to call every time.
    initializeAdminApp();

    // 2. Dynamically import services ONLY AFTER initialization
    const { getAuth } = await import('firebase-admin/auth');
    const { getFirestore } = await import('firebase-admin/firestore');
    
    // 3. Authenticate the user from the request header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or malformed token.' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    
    const decodedToken = await getAuth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const db = getFirestore();

    // 4. Fetch campaigns and products for the authenticated seller in parallel
    const campaignsRef = db.collection('adCampaigns');
    const campaignsQuery = campaignsRef.where('sellerId', '==', uid).orderBy('startDate', 'desc');
    
    const productsRef = db.collection('products');
    const productsQuery = productsRef.where('sellerId', '==', uid);

    const [campaignsSnapshot, productsSnapshot] = await Promise.all([
        campaignsQuery.get(),
        productsQuery.get()
    ]);

    const campaigns: AdCampaign[] = campaignsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdCampaign));
    // The products are used on the frontend to populate the "Create Ad" dialog
    const products: Product[] = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

    // 5. Return the fetched data
    return NextResponse.json({ campaigns, products });

  } catch (error: any) {
    // Log the detailed error on the server for debugging
    console.error('API Error in /api/seller/campaigns:', error);
    
    // Provide a more informative error response to the frontend
    let errorMessage = 'An internal server error occurred.';
    let status = 500;

    if (error.code === 'auth/id-token-expired') {
      errorMessage = 'Authentication token has expired. Please log in again.';
      status = 401;
    } else if (error.message.includes('The default Firebase app does not exist')) {
        errorMessage = `Firebase Admin SDK error: ${error.message}`;
        status = 503; // Service Unavailable
    } else if (error.message) {
        errorMessage = error.message;
    }

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
