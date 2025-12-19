
import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sellerId, action } = body;
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const buyerId = decodedToken.uid;

    if (!sellerId || !action || (action !== 'follow' && action !== 'unfollow')) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (buyerId === sellerId) {
        return NextResponse.json({ error: 'Users cannot follow themselves' }, { status: 400 });
    }
    
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
