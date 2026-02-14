
import { NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const GO_LIVE_COST = 100; // 100 points ($1.00 USD)

// Helper to verify user token and get UID
async function verifyUser(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized: Missing or malformed token.', status: 401 };
  }
  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(token);
    return { uid: decodedToken.uid };
  } catch (error) {
    return { error: 'Unauthorized: Invalid token.', status: 403 };
  }
}

/**
 * POST handler to create a new live session.
 * Deducts 100 points AT THE START to secure the 68-minute session.
 */
export async function POST(request: Request) {
  const verification = await verifyUser(request);
  if ('error' in verification) {
    return NextResponse.json({ error: verification.error }, { status: verification.status });
  }
  const sellerId = (verification as { uid: string }).uid;

  try {
    const userProfileRef = db.collection('userProfiles').doc(sellerId);
    const userProfileDoc = await userProfileRef.get();
    
    if (!userProfileDoc.exists) {
        return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }
    
    const userProfile = userProfileDoc.data();
    const currentPoints = userProfile?.aiPoints || 0;

    if (currentPoints < GO_LIVE_COST) {
        return NextResponse.json({ 
            error: 'Insufficient AI Points', 
            details: `You need ${GO_LIVE_COST} points ($1.00) to start a 68-minute show. Your balance is ${currentPoints}.`,
            needsPoints: true 
        }, { status: 402 });
    }

    const sellerName = userProfile?.shopName || userProfile?.fullName || 'Seller';
    const newSessionRef = db.collection('liveSessions').doc(sellerId);

    const batch = db.batch();
    
    // 1. Deduct points IMMEDIATELY to secure the session
    batch.update(userProfileRef, {
        aiPoints: FieldValue.increment(-GO_LIVE_COST)
    });

    // 2. Initialize or reset the session document
    batch.set(newSessionRef, {
      id: sellerId,
      sellerId: sellerId,
      title: `${sellerName}'s Live Show`,
      status: 'upcoming', // Starts as upcoming during setup/preview
      productIds: [],
      viewerCount: 0,
      startTime: Timestamp.now(),
      pointsCharged: GO_LIVE_COST,
      sessionLimitMs: 68 * 60 * 1000, // Store limit for reference
    }, { merge: true });

    await batch.commit();

    return NextResponse.json({ 
        success: true, 
        liveSessionId: newSessionRef.id,
        newBalance: currentPoints - GO_LIVE_COST
    });

  } catch (error: any) {
    console.error('Error creating live session:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

/**
 * PUT handler to end a live session.
 */
export async function PUT(request: Request) {
  const verification = await verifyUser(request);
  if ('error' in verification) {
    return NextResponse.json({ error: verification.error }, { status: verification.status });
  }
  const sellerId = (verification as { uid: string }).uid;

  const { liveSessionId } = await request.json();

  if (!liveSessionId) {
    return NextResponse.json({ error: 'Live Session ID is required.' }, { status: 400 });
  }

  try {
    const sessionRef = db.collection('liveSessions').doc(liveSessionId);
    const sessionDoc = await sessionRef.get();
    
    if (!sessionDoc.exists || sessionDoc.data()?.sellerId !== sellerId) {
        return NextResponse.json({ error: 'Forbidden: Access denied.' }, { status: 403 });
    }

    await sessionRef.update({
      status: 'ended',
      endTime: Timestamp.now(),
      videosdkMeetingId: null,
      pinnedProductId: null,
    });

    return NextResponse.json({ success: true, message: 'Live session ended.' });

  } catch (error: any) {
    console.error('Error ending live session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
