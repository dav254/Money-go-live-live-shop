import { NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  livekitConfigured,
  livekitUrl,
  createSellerToken,
  generateRoomName,
} from '@/lib/live/service';
import { activeSessionRemainingMs } from '@/lib/live/session-window';

const GO_LIVE_COST = 100; // 100 points ($1.00 USD)
const SESSION_LIMIT_MS = 70 * 60 * 1000; // 70 minutes

async function verifyUser(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized: Missing or malformed token.', status: 401 } as const;
  }
  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(token);
    return { uid: decodedToken.uid } as const;
  } catch {
    return { error: 'Unauthorized: Invalid token.', status: 403 } as const;
  }
}

/**
 * POST handler to create a fresh live session.
 *
 * LiveKit is now the ONLY transport for new sessions (migration): the room
 * name is generated here, the seller's publish token is minted server-side,
 * and both are written onto the existing `liveSessions/{sellerId}` document
 * with `provider: "livekit"` — every other field this document has always
 * carried is preserved untouched.
 *
 * Ordering matters (spec §9): configuration is validated and the token is
 * minted BEFORE anything is charged or marked live, so a broken LiveKit
 * setup can never cost points or leave a false "live" session behind.
 */
export async function POST(request: Request) {
  const verification = await verifyUser(request);
  if ('error' in verification) {
    return NextResponse.json({ error: verification.error }, { status: verification.status });
  }
  const sellerId = verification.uid;

  try {
    // No silent VideoSDK fallback (spec §3): a missing LiveKit config is a
    // clear, safe error — existing/legacy sessions keep working through the
    // buyer page's provider routing and /api/videosdk/token.
    if (!livekitConfigured()) {
      return NextResponse.json(
        {
          error: 'CONFIG_MISSING',
          message:
            'Live streaming is not configured on this server. LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set before a new broadcast can start.',
        },
        { status: 503 },
      );
    }

    const { title, status = 'upcoming' } = await request.json();
    const userProfileRef = db.collection('userProfiles').doc(sellerId);
    const sessionRef = db.collection('liveSessions').doc(sellerId);

    const userProfileDoc = await userProfileRef.get();
    if (!userProfileDoc.exists) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }
    const sellerName =
      userProfileDoc.data()?.shopName || userProfileDoc.data()?.fullName || 'Seller';

    const roomName = generateRoomName();

    // Mint BEFORE charging: purely local HMAC signing, so if this throws the
    // configuration is invalid and no points may be taken.
    let sellerToken: string;
    try {
      sellerToken = await createSellerToken(sellerId, roomName, sellerName);
    } catch (error) {
      console.error('[live-session] LiveKit token minting failed:', error);
      return NextResponse.json(
        {
          error: 'CONFIG_MISSING',
          message:
            'LiveKit rejected the server credentials. Check LIVEKIT_API_KEY / LIVEKIT_API_SECRET. No points were charged.',
        },
        { status: 503 },
      );
    }

    /*
     * ONE TRANSACTION — replica of the old batch, plus two guards:
     *
     * 1. Duplicate-session / double-charge guard (spec §2): the retry of a
     *    request whose first attempt already succeeded (or a double-submit)
     *    sees `status: 'live'` with a LiveKit room and returns the existing
     *    session instead of charging 100 points again. Session documents are
     *    keyed by sellerId, so a duplicate document can never be created.
     * 2. Charge + session write commit atomically: a failed commit charges
     *    nothing.
     */
    type TxResult =
      | { kind: 'retry'; roomName: string; newBalance: number }
      | { kind: 'created'; newBalance: number }
      | {
          kind: 'already-live';
          meetingId: string;
          title: string;
          remainingMs: number;
        }
      | { kind: 'no-points'; error: string; message: string; needsPoints: true; newBalance: number }
      | { kind: 'no-profile' };

    const result: TxResult = await db.runTransaction(async (tx) => {
      const [profileSnap, sessionSnap] = await Promise.all([
        tx.get(userProfileRef),
        tx.get(sessionRef),
      ]);
      if (!profileSnap.exists) return { kind: 'no-profile' } as const;

      const profile = profileSnap.data()!;
      const currentPoints = profile.aiPoints || 0;
      const existing = sessionSnap.exists ? sessionSnap.data() : undefined;

      if (existing?.status === 'live' && existing?.livekitRoomName) {
        return {
          kind: 'retry',
          roomName: existing.livekitRoomName as string,
          newBalance: currentPoints,
        } as const;
      }
      if (existing?.status === 'live' && existing?.videosdkMeetingId) {
        // Legacy session still live. Two professional outcomes instead of a
        // blocking error (spec: never strand the seller):
        //  • inside its paid 70-minute window → report "already live" so the
        //    studio shows the active-broadcast panel with direct actions,
        //    no charge, no dead end;
        //  • window expired (or startTime unusable) → fall through: the fresh
        //    session overwrites the stale document — same single-charge rule
        //    as any new go-live, and the seller is unblocked forever.
        const remainingMs = activeSessionRemainingMs(
          existing as { startTime?: unknown; timeRemainingMs?: unknown },
          Date.now(),
          SESSION_LIMIT_MS,
        );
        if (remainingMs > 0) {
          return {
            kind: 'already-live',
            meetingId: existing.videosdkMeetingId as string,
            title: (existing.title as string) || '',
            remainingMs,
          } as const;
        }
      }
      if (currentPoints < GO_LIVE_COST) {
        return {
          kind: 'no-points',
          error: 'Insufficient AI Points',
          message: `You need ${GO_LIVE_COST} points to start a 70-minute session.`,
          needsPoints: true as const,
          newBalance: currentPoints,
        } as const;
      }

      tx.update(userProfileRef, {
        aiPoints: FieldValue.increment(-GO_LIVE_COST),
      });

      tx.set(sessionRef, {
        id: sessionIdOf(sellerId),
        sellerId: sellerId,
        title: title || `${sellerName}'s Live Show`,
        status: status,
        productIds: [],
        viewerCount: 0, // Reset viewers
        initialStartTime: Timestamp.now(),
        startTime: Timestamp.now(), // New Start Time clears chat history
        pointsCharged: GO_LIVE_COST,
        timeRemainingMs: SESSION_LIMIT_MS,
        activeOffer: null, // Clear old offers
        pinnedProductId: null, // Clear pinned products
        provider: 'livekit',
        livekitRoomName: roomName,
        // Legacy field kept (nulled) so old readers and the transition
        // period both see an honest value instead of a stale room.
        videosdkMeetingId: null,
      });

      return { kind: 'created', newBalance: currentPoints - GO_LIVE_COST } as const;
    });

    switch (result.kind) {
      case 'no-profile':
        return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
      case 'no-points':
        return NextResponse.json(
          { error: result.error, details: result.message, needsPoints: result.needsPoints },
          { status: 402 },
        );
      case 'already-live':
        // 200, not an error: the studio renders the "already live" panel.
        return NextResponse.json({
          success: true,
          alreadyLive: true,
          liveSessionId: sessionRef.id,
          provider: 'videosdk',
          videosdkMeetingId: result.meetingId,
          title: result.title,
          remainingMs: result.remainingMs,
        });
      case 'retry': {
        // Reconnecting to the session that is already live — no charge, and a
        // fresh token for the stored room (config was proven above).
        const token = await createSellerToken(sellerId, result.roomName, sellerName).catch(
          () => null,
        );
        if (!token) {
          return NextResponse.json(
            { error: 'CONFIG_MISSING', message: 'LiveKit rejected the server credentials.' },
            { status: 503 },
          );
        }
        return NextResponse.json({
          success: true,
          liveSessionId: sessionRef.id,
          newBalance: result.newBalance,
          provider: 'livekit',
          livekitRoomName: result.roomName,
          wsUrl: livekitUrl(),
          token,
          reused: true,
        });
      }
      case 'created':
        return NextResponse.json({
          success: true,
          liveSessionId: sessionRef.id,
          newBalance: result.newBalance,
          provider: 'livekit',
          livekitRoomName: roomName,
          wsUrl: livekitUrl(),
          token: sellerToken,
        });
    }
  } catch (error: any) {
    console.error('Error creating live session:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 },
    );
  }
}

/** The session document is keyed by seller id. */
function sessionIdOf(sellerId: string): string {
  return sellerId;
}

/**
 * PUT handler to end a live session permanently.
 *
 * Idempotent (spec §9): ending an already-ended session returns success
 * without rewriting anything, so repeated cleanup calls from a flaky client
 * never error — and this route never charges points, so no duplicate charge
 * is possible here either.
 */
export async function PUT(request: Request) {
  const verification = await verifyUser(request);
  if ('error' in verification) {
    return NextResponse.json({ error: verification.error }, { status: verification.status });
  }
  const userId = verification.uid;

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

    if (sessionDoc.data()?.status === 'ended') {
      // Already ended — repeat cleanup requests are a no-op.
      return NextResponse.json({ success: true, message: 'Live session already ended.' });
    }

    await sessionRef.update({
      status: 'ended',
      endTime: Timestamp.now(),
      videosdkMeetingId: null,
      livekitRoomName: null,
      pinnedProductId: null,
      activeOffer: null,
      timeRemainingMs: 0,
      terminatedBy: isAdmin ? 'admin' : 'seller',
    });

    return NextResponse.json({ success: true, message: 'Live session ended.' });
  } catch (error: any) {
    console.error('Error ending live session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}