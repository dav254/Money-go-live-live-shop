import { NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { pbGetLiveSession } from '@/lib/pocketbase/live-sessions';
import {
  livekitConfigured,
  livekitUrl,
  livekitUrlProblem,
  createViewerToken,
  viewerIdentity,
} from '@/lib/live/service';

export const runtime = 'nodejs';

/**
 * GET /api/live-session/token?sessionId=<id>
 *
 * Mints a subscribe-only LiveKit token for watching one specific live
 * session (spec §3):
 *
 *  - The room name is read from the SERVER's session record — the client
 *    never supplies it — so a buyer cannot ask for a token to an arbitrary
 *    room.
 *  - Viewer tokens are minted with `canPublish: false` / `canPublishData:
 *    false`, so buyers physically cannot publish audio or video.
 *  - The buyer live page is guest-allowed, so an absent/invalid Firebase
 *    token degrades to an anonymous viewer identity rather than blocking
 *    public streams; that is exactly the access Firestore rules already
 *    grant (`liveSessions` is world-readable).
 *  - Missing LiveKit configuration returns a clear 503 — never a fake
 *    "live" stream. (VideoSDK, the old fallback transport, is removed.)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 });
  }

  if (!livekitConfigured()) {
    return NextResponse.json(
      {
        error: 'CONFIG_MISSING',
        message:
          'Live streaming is not configured on this server. LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set.',
      },
      { status: 503 },
    );
  }

  // Same diagnosis the seller's Go live flow runs: a URL that is set but
  // unreachable from a phone must be reported as configuration, not left to
  // surface later as an opaque "Failed to fetch" in the player.
  const urlProblem = livekitUrlProblem();
  if (urlProblem) {
    return NextResponse.json(
      { error: 'CONFIG_MISSING', message: urlProblem },
      { status: 503 },
    );
  }

  try {
    /*
     * VPS store first (the session was mirrored there when the seller went
     * live), Firestore second — a buyer can fetch a viewer token even when
     * Firestore is the thing that is down.
     */
    const mirrored = await pbGetLiveSession(sessionId);
    let session: Record<string, unknown> | null =
      mirrored && Object.keys(mirrored.data).length > 0 ? mirrored.data : null;
    if (!session) {
      try {
        const snap = await db.collection('liveSessions').doc(sessionId).get();
        session = snap.exists ? ((snap.data() ?? {}) as Record<string, unknown>) : null;
      } catch (error) {
        // Neither store had it and Firestore errored — the outer catch keeps
        // today's answer (500, retryable) instead of a misleading 404.
        throw error;
      }
    }
    if (!session) {
      return NextResponse.json({ error: 'Live session not found.' }, { status: 404 });
    }

    if (session.status !== 'live') {
      return NextResponse.json(
        { error: 'SESSION_INACTIVE', message: 'This live session is not active.' },
        { status: 410 },
      );
    }

    if (session.provider !== 'livekit' || !session.livekitRoomName) {
      // Legacy session with no LiveKit room: nothing watchable remains (the
      // VideoSDK transport was removed) — report it as gone, not joinable.
      return NextResponse.json(
        {
          error: 'LEGACY_TRANSPORT',
          message: 'This session runs on a retired transport and cannot be watched.',
        },
        { status: 409 },
      );
    }

    const roomName = session.livekitRoomName as string;

    // Viewer identity: signed-in uid when a valid token is presented,
    // anonymous otherwise. The room comes ONLY from the record above.
    let viewerId = `guest_${cryptoRandomHex(8)}`;
    let displayName = 'Viewer';
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = await auth.verifyIdToken(authHeader.split('Bearer ')[1]);
        viewerId = decoded.uid;
        displayName =
          decoded.name || decoded.email?.split('@')[0] || decoded.uid.slice(0, 8);
      } catch {
        // Invalid/expired token on a guest-allowed page: stay anonymous.
      }
    }

    let token: string;
    try {
      token = await createViewerToken(viewerId, roomName, displayName);
    } catch (error) {
      console.error('[live-session/token] LiveKit token minting failed:', error);
      return NextResponse.json(
        {
          error: 'CONFIG_MISSING',
          message: 'LiveKit rejected the server credentials.',
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      provider: 'livekit',
      sessionId,
      livekitRoomName: roomName,
      wsUrl: livekitUrl(),
      token,
      identity: viewerIdentity(viewerId),
    });
  } catch (error: any) {
    console.error('[live-session/token]', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Could not join the live session.' },
      { status: 500 },
    );
  }
}

function cryptoRandomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}