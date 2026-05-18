import { NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import jwt from 'jsonwebtoken';

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
 * Generates an internal token for VideoSDK API calls.
 */
function getInternalToken() {
  const API_KEY = process.env.VIDEOSDK_API_KEY;
  const SECRET_KEY = process.env.VIDEOSDK_SECRET_KEY;
  if (!API_KEY || !SECRET_KEY) return null;

  return jwt.sign(
    { apikey: API_KEY, permissions: ['allow_join', 'allow_mod'], version: 2 },
    SECRET_KEY,
    { expiresIn: '10m' }
  );
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

  try {
    const { title } = await request.json();
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

    // --- CREATE VIDEOSDK ROOM ON SERVER ---
    const internalToken = getInternalToken();
    let videosdkMeetingId = null;

    if (internalToken) {
        const videoSdkRes = await fetch("https://api.videosdk.live/v2/rooms", {
            method: "POST",
            headers: { authorization: internalToken, "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        const videoSdkData = await videoSdkRes.json();
        videosdkMeetingId = videoSdkData.roomId;
    }

    if (!videosdkMeetingId) {
        return NextResponse.json({ error: 'Failed to initialize VideoSDK Room.' }, { status: 500 });
    }

    const batch = db.batch();
    
    // 1. Deduct points for new session
    batch.update(userProfileRef, {
        aiPoints: FieldValue.increment(-GO_LIVE_COST)
    });

    // 2. Initialize new session document
    batch.set(sessionRef, {
      id: sellerId,
      sellerId: sellerId,
      title: title || `${sellerName}'s Live Show`,
      status: 'upcoming', 
      productIds: [],
      viewerCount: 0,
      initialStartTime: Timestamp.now(),
      startTime: Timestamp.now(), 
      pointsCharged: GO_LIVE_COST,
      timeRemainingMs: SESSION_LIMIT_MS,
      activeOffer: null,
      videosdkMeetingId: videosdkMeetingId,
      pinnedProductId: null,
    });

    await batch.commit();

    return NextResponse.json({ 
        success: true, 
        liveSessionId: sessionRef.id,
        newBalance: currentPoints - GO_LIVE_COST,
        videosdkMeetingId: videosdkMeetingId
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
  const userId = (verification as { uid: string }).uid;

  const { liveSessionId } = await request.json();

  if (!liveSessionId) {
    return NextResponse.json({ error: 'Live Session ID is required.' }, { status: 400 });
  }

  try {
    const sessionRef = db.collection('liveSessions').doc(liveSessionId);
    const sessionDoc = await sessionRef.get();
    
    if (!sessionDoc.exists) {
        return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    const adminProfile = await db.collection('userProfiles').doc(userId).get();
    const isAdmin = adminProfile.data()?.userRole === 'admin';
    const isOwner = sessionDoc.data()?.sellerId === userId;

    if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: 'Forbidden: Access denied.' }, { status: 403 });
    }

    await sessionRef.update({
      status: 'ended',
      endTime: Timestamp.now(),
      videosdkMeetingId: null,
      pinnedProductId: null,
      activeOffer: null,
      timeRemainingMs: 0,
      terminatedBy: isAdmin ? 'admin' : 'seller'
    });

    return NextResponse.json({ success: true, message: 'Live session ended.' });

  } catch (error: any) {
    console.error('Error ending live session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
