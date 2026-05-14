import { NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const GO_LIVE_COST = 100; // 100 points ($1.00 USD)
const SESSION_LIMIT_MS = 70 * 60 * 1000; // 70 minutes

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
 * POST handler to create a fresh live session.
 */
export async function POST(request: Request) {
  const verification = await verifyUser(request);
  if ('error' in verification) {
    return NextResponse.json({ error: (verification as any).error }, { status: (verification as any).status });
  }
  const sellerId = (verification as { uid: string }).uid;
  const { prewarmedMeetingId } = await request.json();

  try {
    const userProfileRef = db.collection('userProfiles').doc(sellerId);
    const sessionRef = db.collection('liveSessions').doc(sellerId);
    
    const userProfileDoc = await userProfileRef.get();
    
    if (!userProfileDoc.exists) {
        return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }
    
    const userProfile = userProfileDoc.data();
    const currentPoints = userProfile?.aiPoints || 0;
    const sellerName = userProfile?.shopName || userProfile?.fullName || 'Seller';

    if (currentPoints < GO_LIVE_COST) {
        return NextResponse.json({ 
            error: 'Insufficient AI Points', 
            details: `You need ${GO_LIVE_COST} points to start a 70-minute session.`,
            needsPoints: true 
        }, { status: 402 });
    }

    const batch = db.batch();
    
    // 1. Deduct points for new session
    batch.update(userProfileRef, {
        aiPoints: FieldValue.increment(-GO_LIVE_COST)
    });

    // 2. Initialize new session document (Always overwrites for a fresh start)
    // We set status to upcoming. It only becomes 'live' when the seller clicks Broadcast.
    // The startTime is set to now, but it will be moved forward again when the broadcast starts.
    batch.set(sessionRef, {
      id: sellerId,
      sellerId: sellerId,
      title: `${sellerName}'s Live Show`,
      status: 'upcoming', 
      productIds: [],
      viewerCount: 0,
      initialStartTime: Timestamp.now(),
      startTime: Timestamp.now(), 
      pointsCharged: GO_LIVE_COST,
      timeRemainingMs: SESSION_LIMIT_MS,
      activeOffer: null,
      videosdkMeetingId: prewarmedMeetingId || null,
      pinnedProductId: null,
    });

    await batch.commit();

    return NextResponse.json({ 
        success: true, 
        liveSessionId: sessionRef.id,
        newBalance: currentPoints - GO_LIVE_COST,
        videosdkMeetingId: prewarmedMeetingId
    });

  } catch (error: any) {
    console.error('Error creating live session:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

/**
 * PUT handler to end a live session permanently.
 */
export async function PUT(request: Request) {
  const verification = await verifyUser(request);
  if ('error' in verification) {
    return NextResponse.json({ error: (verification as any).error }, { status: (verification as any).status });
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

    // CRITICAL: End status and clear meeting ID to kick buyers out instantly.
    // We reset the startTime to a future date or essentially clear interactive states
    // so the chat vanishes and doesn't leak into the next show.
    await sessionRef.update({
      status: 'ended',
      endTime: Timestamp.now(),
      videosdkMeetingId: null,
      pinnedProductId: null,
      activeOffer: null,
      timeRemainingMs: 0,
    });

    return NextResponse.json({ success: true, message: 'Live session ended.' });

  } catch (error: any) {
    console.error('Error ending live session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}