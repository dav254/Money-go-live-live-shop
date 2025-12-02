
import { NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { BoostRequest } from '@/lib/types';
import { uploadVideoToTikTok } from '@/lib/tiktok';

/**
 * GET handler for fetching boost requests.
 * Allows filtering by status (e.g., ?status=pending).
 * Only accessible by admin users.
 */
export async function GET(request: Request) {
  try {
    // Correctly initialize Firebase Admin and get services
    const adminApp = await initializeAdminApp();
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

    let query = db.collection('boost_requests').orderBy('createdAt', 'desc');

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
 * Only accessible by admin users.
 */
export async function POST(request: Request) {
  try {
    // Correctly initialize Firebase Admin and get services
    const adminApp = await initializeAdminApp();
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

    const { boostId, action }: { boostId: string; action: 'approved' | 'rejected' } = await request.json();

    if (!boostId || !action || !['approved', 'rejected'].includes(action)) {
      return NextResponse.json({ message: 'Invalid request body. Requires boostId and action (approved/rejected).' }, { status: 400 });
    }

    const boostRef = db.collection('boost_requests').doc(boostId);
    const boostDoc = await boostRef.get();

    if (!boostDoc.exists) {
      return NextResponse.json({ message: `Boost request with ID ${boostId} not found.` }, { status: 404 });
    }

    const boostData = boostDoc.data() as BoostRequest;

    if (boostData.status !== 'pending') {
      return NextResponse.json({ message: `This boost has already been processed with status: ${boostData.status}.` }, { status: 409 });
    }
    
    if (action === 'approved') {
      const mockAccessToken = 'admin_approval_placeholder_token';

      const uploadResult = await uploadVideoToTikTok(boostData, mockAccessToken);

      if (uploadResult.success) {
        console.log(`Boost ${boostId} approved. Simulated upload to TikTok complete. Video ID: ${uploadResult.videoId}`);
        return NextResponse.json({ message: `Boost request ${boostId} approved and processed successfully.` });
      } else {
        throw new Error(uploadResult.message);
      }

    } else if (action === 'rejected') {
      const sellerProfileRef = db.collection('userProfiles').doc(boostData.sellerId);

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
      
      console.log(`Boost ${boostId} rejected. ${boostData.pointsPaid} points refunded to seller ${boostData.sellerId}.`);
      return NextResponse.json({ message: `Boost request ${boostId} rejected and points refunded.` });
    }

  } catch (error: any) {
    console.error('Error processing boost request:', error);
    return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}
