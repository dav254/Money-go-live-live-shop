
'use server';

import { NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/admin';
// Do NOT import firebase-admin services at the top level.
// We will import them dynamically after ensuring the app is initialized.
import type { BoostRequest, UserProfile } from '@/lib/types';


/**
 * GET handler for fetching all boost requests belonging to the authenticated seller.
 */
export async function GET(request: Request) {
  try {
    // Initialize Firebase Admin on each request
    const adminApp = initializeAdminApp();
    const { getAuth } = await import('firebase-admin/auth');
    const { getFirestore } = await import('firebase-admin/firestore');
    
    const auth = getAuth(adminApp);
    const db = getFirestore(adminApp);

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized: Missing or malformed token.' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    
    const decodedToken = await auth.verifyIdToken(token);
    const sellerId = decodedToken.uid;

    const boostsRef = db.collection('boost_requests');
    const boostsQuery = boostsRef.where('sellerId', '==', sellerId).orderBy('createdAt', 'desc');

    const snapshot = await boostsQuery.get();
    
    // Safely serialize Timestamp objects before sending the response
    const boosts = snapshot.docs.map(doc => {
        const data = doc.data() as BoostRequest;
        const createdAt = data.createdAt as any;
        const updatedAt = data.updatedAt as any;

        return {
            ...data,
            createdAt: (createdAt && typeof createdAt.toDate === 'function')
                ? createdAt.toDate().toISOString()
                : new Date().toISOString(),
            updatedAt: (updatedAt && typeof updatedAt.toDate === 'function')
                ? updatedAt.toDate().toISOString()
                : new Date().toISOString(),
        };
    });

    return NextResponse.json(boosts);

  } catch (error: any) {
    console.error('API Error in GET /api/seller/boosts:', error);
    if (error.code === 'auth/id-token-expired') {
      return NextResponse.json({ message: 'Authentication token has expired.' }, { status: 401 });
    }
    return NextResponse.json({ message: 'An internal server error occurred.', error: error.message }, { status: 500 });
  }
}

/**
 * POST handler for creating a new boost request.
 */
export async function POST(request: Request) {
  try {
    // Initialize Firebase Admin on each request
    const adminApp = initializeAdminApp();
    const { getAuth } = await import('firebase-admin/auth');
    const { getFirestore, FieldValue, Timestamp } = await import('firebase-admin/firestore');
    
    const auth = getAuth(adminApp);
    const db = getFirestore(adminApp);


    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const sellerId = decodedToken.uid;

    const payload = await request.json();
    const { videoUrl, caption, durationDays, pointsCost, target } = payload;
    if (!videoUrl || !caption || durationDays <= 0 || !pointsCost) {
        return NextResponse.json({ message: 'Invalid campaign data provided.' }, { status: 400 });
    }

    const userProfileRef = db.collection('userProfiles').doc(sellerId);
    const newBoostRef = db.collection('boost_requests').doc();

    await db.runTransaction(async (transaction) => {
      const userProfileSnap = await transaction.get(userProfileRef);
      if (!userProfileSnap.exists) {
        throw new Error('User profile not found.');
      }
      const userProfile = userProfileSnap.data() as UserProfile;

      const currentPoints = userProfile.aiPoints || 0;
      if (currentPoints < pointsCost) {
        throw new Error(`Insufficient points. You need ${pointsCost}, but have ${currentPoints}.`);
      }

      const newBoostData: BoostRequest = {
        id: newBoostRef.id,
        sellerId: sellerId,
        videoUrl: videoUrl,
        caption: caption,
        durationDays: durationDays,
        target: target,
        pointsPaid: pointsCost,
        status: 'pending',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        analytics: { views: 0, likes: 0, clicks: 0, shares: 0, conversions: 0 }
      };

      transaction.update(userProfileRef, { aiPoints: FieldValue.increment(-pointsCost) });
      transaction.set(newBoostRef, newBoostData);
    });

    return NextResponse.json({ success: true, message: 'Boost request submitted successfully.', boostId: newBoostRef.id });

  } catch (error: any) {
    console.error('Error creating TikTok boost request:', error);
    return NextResponse.json({ message: error.message || 'An unknown server error occurred.' }, { status: 500 });
  }
}
