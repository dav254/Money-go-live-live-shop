

import { NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { BoostRequest, UserProfile } from '@/lib/types';
import { uploadVideoToTikTok } from '@/lib/tiktok';

/**
 * GET handler for fetching boost requests.
 * Allows filtering by status (e.g., ?status=pending).
 * Only accessible by admin users.
 */
export async function GET(request: Request) {
  try {
    // Correctly initialize Firebase Admin and get services
    const adminApp = initializeAdminApp();
    const auth = getAuth(adminApp);
    const db = getFirestore(adminApp);

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userProfileSnap = await db.collection('userProfiles').doc(decodedToken.uid).get();

    if (!userProfileSnap.exists || userProfileSnap.data()?.userRole !== 'admin') {
      return NextResponse.json({ message: 'Forbidden: Access is restricted to administrators.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection('boost_requests').orderBy('createdAt', 'desc');

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    
    // Safely serialize Timestamp objects before sending the response
    const boosts = snapshot.docs.map(doc => {
        const data = doc.data() as BoostRequest;
        const createdAt = data.createdAt;
        const updatedAt = data.updatedAt;

        return {
            ...data,
            id: doc.id, // Make sure to include the document ID
            createdAt: (createdAt && typeof (createdAt as any).toDate === 'function')
                ? (createdAt as any).toDate().toISOString()
                : new Date().toISOString(),
            updatedAt: (updatedAt && typeof (updatedAt as any).toDate === 'function')
                ? (updatedAt as any).toDate().toISOString()
                : new Date().toISOString(),
        };
    });

    return NextResponse.json(boosts);

  } catch (error: any) {
    console.error('Error fetching boost requests:', error);
    return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}

/**
 * POST handler for approving or rejecting a boost request.
 * On approval, it triggers the (mock) TikTok upload process.
 * Can also handle boost creation.
 */
export async function POST(request: Request) {
  try {
    const adminApp = initializeAdminApp();
    const auth = getAuth(adminApp);
    const db = getFirestore(adminApp);

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized: No authentication token provided.' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;
    
    const body = await request.json();

    // Check if it's an admin action (approval/rejection) or a seller action (creation)
    if (body.action && ['approved', 'rejected'].includes(body.action)) {
        // --- ADMIN ACTION ---
        const userProfileSnap = await db.collection('userProfiles').doc(userId).get();
        if (!userProfileSnap.exists() || userProfileSnap.data()?.userRole !== 'admin') {
          return NextResponse.json({ error: 'Forbidden: Access is restricted to administrators.' }, { status: 403 });
        }
        
        return handleAdminAction(db, body);
    } else {
        // --- SELLER ACTION (CREATE BOOST) ---
        return handleCreateBoost(db, userId, body);
    }

  } catch (error: any) {
    console.error('Error processing boost request:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

async function handleCreateBoost(db: FirebaseFirestore.Firestore, sellerId: string, payload: any) {
    const { productId, videoUrl, caption, durationDays, pointsCost, target } = payload;
    
    if (!productId || !videoUrl || !caption || !durationDays || !pointsCost || !target) {
        return NextResponse.json({ error: 'Invalid payload for boost creation.' }, { status: 400 });
    }
    
    const userProfileRef = db.collection('userProfiles').doc(sellerId);
    const newBoostRef = db.collection('boost_requests').doc();

    try {
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

            const newBoostData: Omit<BoostRequest, 'id'> = {
                sellerId: sellerId,
                productId: productId,
                videoUrl: videoUrl,
                caption: caption,
                durationDays: durationDays,
                pointsPaid: pointsCost,
                target: target,
                status: 'pending',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                analytics: { views: 0, likes: 0, clicks: 0, shares: 0, conversions: 0 },
            };

            transaction.update(userProfileRef, { aiPoints: FieldValue.increment(-pointsCost) });
            transaction.set(newBoostRef, newBoostData);
        });

         return NextResponse.json({ success: true, message: 'Boost request submitted successfully.' });

    } catch (error: any) {
        console.error('Boost creation transaction failed:', error);
        // Return a specific error message if it was a custom error from our transaction logic
        if (error.message.startsWith('Insufficient points')) {
            return NextResponse.json({ error: error.message }, { status: 402 }); // 402 Payment Required
        }
        return NextResponse.json({ error: 'Failed to create boost request.', details: error.message }, { status: 500 });
    }
}


async function handleAdminAction(db: FirebaseFirestore.Firestore, body: { boostId: string; action: 'approved' | 'rejected' }) {
    const { boostId, action } = body;

    const boostRef = db.collection('boost_requests').doc(boostId);
    const boostDoc = await boostRef.get();

    if (!boostDoc.exists) {
      return NextResponse.json({ message: `Boost request with ID ${boostId} not found.` }, { status: 404 });
    }

    const boostData = { id: boostDoc.id, ...boostDoc.data() } as BoostRequest;

    if (boostData.status !== 'pending') {
      return NextResponse.json({ message: `This boost has already been processed with status: ${boostData.status}.` }, { status: 409 });
    }
    
    if (action === 'approved') {
      // Simulate getting the seller's access token.
      // In a real app, this would be fetched securely from the user's profile.
      const mockAccessToken = 'admin_approval_placeholder_token_for_seller_' + boostData.sellerId;
      const uploadResult = await uploadVideoToTikTok(boostData, mockAccessToken);

      if (uploadResult.success) {
        await boostRef.update({
            tiktokVideoId: uploadResult.videoId,
            status: 'approved',
            updatedAt: Timestamp.now()
        });
        return NextResponse.json({ message: `Boost request ${boostId} approved and processed successfully.` });
      } else {
         // If upload fails, reject the request and refund points
         await boostRef.update({
            status: 'rejected',
            rejectionReason: `TikTok API Error: ${uploadResult.message}`,
            updatedAt: Timestamp.now()
        });
        // Refund points
        const sellerProfileRef = db.collection('userProfiles').doc(boostData.sellerId);
        await sellerProfileRef.update({ aiPoints: FieldValue.increment(boostData.pointsPaid) });
        
        throw new Error(uploadResult.message);
      }

    } else if (action === 'rejected') {
      const sellerProfileRef = db.collection('userProfiles').doc(boostData.sellerId);

      // Use a transaction to ensure both operations succeed or fail together.
      await db.runTransaction(async (transaction) => {
        transaction.update(sellerProfileRef, {
          aiPoints: FieldValue.increment(boostData.pointsPaid)
        });
        transaction.update(boostRef, {
          status: 'rejected',
          rejectionReason: 'Content did not meet guidelines', // Example reason
          updatedAt: Timestamp.now()
        });
      });
      return NextResponse.json({ message: `Boost request ${boostId} rejected and points refunded.` });
    }
    
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
}
