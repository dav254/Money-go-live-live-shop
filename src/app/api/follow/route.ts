
import { NextRequest, NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Health check function for this API endpoint
export async function healthCheck() {
    try {
        initializeAdminApp();
        return { status: 'operational' };
    } catch (e) {
        console.error("Follow API Health Check Failed:", e);
        return { status: 'outage', message: 'Firebase Admin SDK initialization failed.' };
    }
}

export async function POST(request: NextRequest) {
  try {
    initializeAdminApp(); // Ensure app is initialized
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK in API route', error);
    return NextResponse.json({ error: 'Internal Server Error', details: 'Could not initialize backend services.' }, { status: 500 });
  }

    const body = await request.json();

    if (body.action === 'health_check') {
        const health = await healthCheck();
        return NextResponse.json(health);
    }

    const { sellerId, action } = body;
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }

  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    const buyerId = decodedToken.uid;

    if (!sellerId || !action || (action !== 'follow' && action !== 'unfollow')) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (buyerId === sellerId) {
        return NextResponse.json({ error: 'Users cannot follow themselves' }, { status: 400 });
    }
    
    const db = getFirestore();
    const buyerProfileRef = db.collection('userProfiles').doc(buyerId);
    const sellerShopRef = db.collection('sellerShops').doc(sellerId);
    
    const sellerShopDoc = await sellerShopRef.get();
    if (!sellerShopDoc.exists) {
        return NextResponse.json({ error: 'Seller shop not found' }, { status: 404 });
    }

    const batch = db.batch();

    if (action === 'follow') {
      batch.update(buyerProfileRef, {
        following: FieldValue.arrayUnion(sellerId),
      });
      batch.update(sellerShopRef, {
        followers: FieldValue.increment(1),
      });
    } else { // Unfollow
      batch.update(buyerProfileRef, {
        following: FieldValue.arrayRemove(sellerId),
      });
      batch.update(sellerShopRef, {
        followers: FieldValue.increment(-1),
      });
    }
    
    await batch.commit();

    return NextResponse.json({ success: true, message: `Successfully ${action}ed.` });

  } catch (error: any) {
    console.error('Follow API Error:', error);
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
        return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
