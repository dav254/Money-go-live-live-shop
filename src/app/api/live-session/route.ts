
import { NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const GO_LIVE_COST = 100; // 100 points ($1.00 USD)
const SESSION_LIMIT_MS = 70 * 60 * 1000; // 70 minutes
const EXPIRY_HOURS = 24;

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
 * POST handler to create or resume a live session.
 * Prevents double deduction and handles time reconciliation.
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
    
    const [userProfileDoc, sessionDoc] = await Promise.all([
        userProfileRef.get(),
        sessionRef.get()
    ]);
    
    if (!userProfileDoc.exists) {
        return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }
    
    const userProfile = userProfileDoc.data();
    const currentPoints = userProfile?.aiPoints || 0;
    const sellerName = userProfile?.shopName || userProfile?.fullName || 'Seller';

    // --- SESSION RECOVERY LOGIC (Anti-Theft) ---
    if (sessionDoc.exists) {
        const sessionData = sessionDoc.data();
        const initialStart = sessionData?.initialStartTime?.toDate();
        const now = new Date();
        
        // Check if session is within 24h and has airtime remaining
        const hoursDiff = initialStart ? (now.getTime() - initialStart.getTime()) / (1000 * 60 * 60) : 999;
        
        if (hoursDiff < EXPIRY_HOURS && sessionData?.status !== 'ended' && (sessionData?.timeRemainingMs || 0) > 0) {
            console.log(`[API] Recovering existing session for ${sellerId}. Balance: ${sessionData.timeRemainingMs}ms`);
            
            // Reconcile time if the user left while "Live"
            let reconciledRemaining = sessionData.timeRemainingMs;
            if (sessionData.status === 'live' && sessionData.lastStartedAt) {
                const lastStart = sessionData.lastStartedAt.toDate().getTime();
                const elapsed = now.getTime() - lastStart;
                reconciledRemaining = Math.max(0, reconciledRemaining - elapsed);
                
                // Update Firestore immediately to reflect reconciliation
                await sessionRef.update({
                    timeRemainingMs: reconciledRemaining,
                    status: 'paused' // Set to paused for safety upon recovery
                });
            }

            return NextResponse.json({ 
                success: true, 
                liveSessionId: sessionRef.id,
                resumed: true,
                timeRemainingMs: reconciledRemaining,
                videosdkMeetingId: sessionData.videosdkMeetingId
            });
        }
    }

    // --- NEW SESSION LOGIC ---
    if (currentPoints < GO_LIVE_COST) {
        return NextResponse.json({ 
            error: 'Insufficient AI Points', 
            details: `You need ${GO_LIVE_COST} points to start a 70-minute session. Your balance is ${currentPoints}.`,
            needsPoints: true 
        }, { status: 402 });
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
      title: `${sellerName}'s Live Show`,
      status: 'upcoming', 
      productIds: [],
      viewerCount: 0,
      initialStartTime: Timestamp.now(),
      startTime: Timestamp.now(),
      pointsCharged: GO_LIVE_COST,
      timeRemainingMs: SESSION_LIMIT_MS,
      activeOffer: null,
      videosdkMeetingId: prewarmedMeetingId || null
    }, { merge: true });

    await batch.commit();

    return NextResponse.json({ 
        success: true, 
        liveSessionId: sessionRef.id,
        resumed: false,
        timeRemainingMs: SESSION_LIMIT_MS,
        newBalance: currentPoints - GO_LIVE_COST,
        videosdkMeetingId: prewarmedMeetingId
    });

  } catch (error: any) {
    console.error('Error creating/resuming live session:', error);
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

    await sessionRef.update({
      status: 'ended',
      endTime: Timestamp.now(),
      videosdkMeetingId: null,
      pinnedProductId: null,
      activeOffer: null,
      timeRemainingMs: 0, // Mark as consumed
    });

    return NextResponse.json({ success: true, message: 'Live session ended.' });

  } catch (error: any) {
    console.error('Error ending live session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
