import { NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  livekitConfigured,
  livekitUrl,
  livekitUrlProblem,
  createSellerToken,
  generateRoomName,
} from '@/lib/live/service';
import { pocketBaseEnabled } from '@/lib/pocketbase/server';
import { pbGetProfile, pbUpsertProfile, pbAdjustAiPoints } from '@/lib/pocketbase/profiles';
import {
  pbMirrorLiveSession,
  pbGetLiveSession,
  pbEndLiveSession,
} from '@/lib/pocketbase/live-sessions';


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
 * LiveKit is the only transport: the room name is generated here, the
 * seller's publish token is minted server-side, and both are written onto the
 * existing `liveSessions/{sellerId}` document with `provider: "livekit"` —
 * every other field this document has always carried is preserved untouched.
 * (VideoSDK, the original transport, has been removed; the server runs
 * LiveKit — self-hosted on the VPS — and refuses with a clear CONFIG_MISSING
 * error when LIVEKIT_* is not configured.)
 *
 * Ordering matters (spec §9): configuration is validated and the token is
 * minted BEFORE anything is charged or marked live, so a broken setup can
 * never cost points or leave a false "live" session behind.
 */
export async function POST(request: Request) {
  const verification = await verifyUser(request);
  if ('error' in verification) {
    return NextResponse.json({ error: verification.error }, { status: verification.status });
  }
  const sellerId = verification.uid;

  try {
    if (!livekitConfigured()) {
      return NextResponse.json(
        {
          error: 'CONFIG_MISSING',
          message:
            'Live streaming is not configured on this server. Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET before a new broadcast can start.',
        },
        { status: 503 },
      );
    }

    // A set-but-unreachable LIVEKIT_URL passes the check above and then dies
    // inside the client as "could not establish signal connection: Failed to
    // fetch". Catch it HERE, where the seller can read what to change.
    const urlProblem = livekitUrlProblem();
    if (urlProblem) {
      return NextResponse.json(
        { error: 'CONFIG_MISSING', message: urlProblem },
        { status: 503 },
      );
    }

    // A malformed body must be a 400, not an unhandled throw that surfaces
    // to the seller as a blank "Connection problem".
    let body: { title?: string; status?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const { title, status = 'upcoming' } = body;
    const userProfileRef = db.collection('userProfiles').doc(sellerId);
    const sessionRef = db.collection('liveSessions').doc(sellerId);

    /*
     * Profile + balance: VPS store first, Firestore second (see
     * loadProfileSnapshot). A MISSING profile is still a data gap — create
     * it and ask for a retry; an UNREADABLE profile is a store outage, and
     * saying "just created" there would be a lie, so it gets its own answer.
     */
    const profile = await loadProfileSnapshot(sellerId);
    if (!profile.found) {
      if (profile.unreadable) {
        return NextResponse.json(
          {
            error: 'STORE_UNREACHABLE',
            message:
              'Your profile could not be read right now. No points were charged — wait a moment and press Go live again.',
          },
          { status: 503 },
        );
      }
      await ensureProfile(sellerId);
      return NextResponse.json(
        {
          error: 'PROFILE_NOT_READY',
          message: 'Your seller profile was just created. Press Go live again to continue.',
        },
        { status: 409 },
      );
    }
    const sellerName = profile.shopName || profile.fullName || 'Seller';

    // Mint BEFORE charging: a rejected configuration must cost nothing.
    const roomName = generateRoomName();
    let sellerToken: string | null = null;
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
     * VPS-FIRST STATE — the session and the balance are read from the store
     * on this machine first, so going live depends on the VPS, not on
     * Firestore being reachable.
     */
    const existing = await loadSessionSnapshot(sellerId);

    // Duplicate-session guard (spec §2): a retry whose first attempt already
    // succeeded reconnects to the existing room instead of charging again.
    if (existing?.data.status === 'live' && existing.data.livekitRoomName) {
      const room = String(existing.data.livekitRoomName);
      const token = await createSellerToken(sellerId, room, sellerName).catch(() => null);
      if (!token) {
        return NextResponse.json(
          { error: 'CONFIG_MISSING', message: 'LiveKit rejected the server credentials.' },
          { status: 503 },
        );
      }
      return NextResponse.json({
        success: true,
        liveSessionId: sessionRef.id,
        newBalance: profile.points ?? 0,
        provider: 'livekit',
        livekitRoomName: room,
        wsUrl: livekitUrl(),
        token,
        reused: true,
      });
    }

    if (profile.points === null) {
      // Balance unknown in BOTH stores — never charge what cannot be read.
      return NextResponse.json(
        {
          error: 'BALANCE_UNREADABLE',
          message:
            'Could not read your points balance right now. No points were charged — wait a moment and press Go live again.',
        },
        { status: 503 },
      );
    }
    if (profile.points < GO_LIVE_COST) {
      return NextResponse.json(
        {
          error: 'Insufficient AI Points',
          details: `You need ${GO_LIVE_COST} points to start a 70-minute session.`,
          needsPoints: true,
        },
        { status: 402 },
      );
    }

    /*
     * The session document — built ONCE so whichever store persists it (the
     * VPS path below or the Firestore transaction as fallback) writes exactly
     * the same fields the studio and buyer pages expect.
     */
    const sessionDoc = buildSessionDoc({ sellerId, title, status, sellerName, roomName });

    /*
     * VPS-PRIMARY WRITE (PocketBase configured): charge first, then the
     * session; a failed session write refunds the charge, so a broken store
     * can never cost points or leave a false "live" session behind. The two
     * Firestore writes then follow best-effort — their failure must not fail
     * a broadcast. PocketBase has no cross-document transaction, so these two
     * writes are less atomic than the transaction below; the studio disabling
     * Go live while `starting` covers the practical double-submit case.
     */
    if (pocketBaseEnabled()) {
      const newBalance = await pbAdjustAiPoints(sellerId, -GO_LIVE_COST);
      if (newBalance !== null && (await pbMirrorLiveSession(sellerId, sessionDoc))) {
        try {
          await sessionRef.set(sessionDoc);
          await userProfileRef.update({ aiPoints: FieldValue.increment(-GO_LIVE_COST) });
        } catch (error) {
          console.error('[live-session] Firestore mirror failed (broadcast kept on VPS):', error);
        }
        return NextResponse.json({
          success: true,
          liveSessionId: sessionRef.id,
          newBalance,
          provider: 'livekit',
          livekitRoomName: roomName,
          wsUrl: livekitUrl(),
          token: sellerToken,
        });
      }
      if (newBalance !== null) {
        // Session write failed — give the charge back before falling through.
        await pbAdjustAiPoints(sellerId, GO_LIVE_COST);
      }
      // VPS unavailable → fall through to the original Firestore transaction.
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
      | { kind: 'no-points'; error: string; message: string; needsPoints: true; newBalance: number }
      | { kind: 'no-profile' };

    /*
     * The charge transaction is the ONE step left that requires Firestore.
     * When it fails (store outage, credentials, network) this used to fall
     * through to the generic 500 → the studio's blank "Connection problem"
     * toast. A store outage is a 503 with a message a seller can act on, and
     * points are never charged (the transaction never committed).
     */
    let result: TxResult;
    try {
      result = await db.runTransaction(async (tx) => {
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
      // A still-"live" legacy session without a LiveKit room carries no
      // watchable transport anymore (VideoSDK was removed) — it falls through
      // and the fresh session overwrites it: same single-charge rule, seller
      // never stranded.
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

      // Built once above (buildSessionDoc) — identical fields whichever
      // store persists it.
      tx.set(sessionRef, sessionDoc);

      return { kind: 'created', newBalance: currentPoints - GO_LIVE_COST } as const;
      });
    } catch (error) {
      console.error(
        `[live-session] charge transaction failed — store unreachable (pocketBaseEnabled=${pocketBaseEnabled()}):`,
        error,
      );
      return NextResponse.json(
        {
          error: 'STORE_UNREACHABLE',
          message:
            'The server could not confirm your points balance right now, so nothing was charged. Wait a moment and press Go live again.',
        },
        { status: 503 },
      );
    }

    switch (result.kind) {
      case 'no-profile':
        // Profile vanished between pre-check and transaction — retryable.
        await ensureProfile(sellerId);
        return NextResponse.json(
          {
            error: 'PROFILE_NOT_READY',
            message: 'Your seller profile was just created. Press Go live again to continue.',
          },
          { status: 409 },
        );
      case 'no-points':
        return NextResponse.json(
          { error: result.error, details: result.message, needsPoints: result.needsPoints },
          { status: 402 },
        );
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
      case 'created': {
        /*
         * Best-effort VPS copy of what the transaction just committed — this
         * path only runs when the VPS write was unavailable a moment ago, so
         * the copy may fail too (never throws, and ignoring its result here
         * is correct: the broadcast already exists in Firestore).
         */
        await pbMirrorLiveSession(sellerId, sessionDoc);
        await pbAdjustAiPoints(sellerId, -GO_LIVE_COST);
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
    }
  } catch (error: any) {
    console.error('Error creating live session:', error);
    // Friendly text + the technical detail, so a screenshot of the toast
    // shows the real cause instead of a bare "Internal Server Error".
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message:
          'Something went wrong starting the broadcast and no points were charged. Try again in a moment.',
        details: typeof error?.message === 'string' ? error.message.slice(0, 300) : undefined,
      },
      { status: 500 },
    );
  }
}

/**
 * The session document go-live writes — ONE builder so the VPS path and the
 * Firestore fallback transaction persist byte-for-byte equivalent sessions
 * (studio, buyer watch and chat all read these fields).
 */
function buildSessionDoc(args: {
  sellerId: string;
  title?: string;
  status: string;
  sellerName: string;
  roomName: string;
}): Record<string, unknown> {
  return {
    id: args.sellerId,
    sellerId: args.sellerId,
    title: args.title || `${args.sellerName}'s Live Show`,
    status: args.status,
    productIds: [],
    viewerCount: 0, // Reset viewers
    initialStartTime: Timestamp.now(),
    startTime: Timestamp.now(), // New Start Time clears chat history
    pointsCharged: GO_LIVE_COST,
    timeRemainingMs: SESSION_LIMIT_MS,
    activeOffer: null, // Clear old offers
    pinnedProductId: null, // Clear pinned products
    // Transport: LiveKit only. The legacy videosdkMeetingId field is nulled
    // so no reader mistakes an old session for a watchable one.
    provider: 'livekit',
    livekitRoomName: args.roomName,
    videosdkMeetingId: null,
  };
}

/**
 * Profile snapshot for the charge — VPS store first, Firestore second:
 *  - `found`      a profile exists in a store we could actually read.
 *  - `unreadable` a store FAILED and nothing was found anywhere, so the
 *    caller reports an outage instead of "your profile was just created".
 *  - `points`     the balance from the VPS copy when it knows it, else
 *    Firestore, else null — never invented: null blocks the charge with a
 *    clear message rather than guessing (0 would lock real balances out).
 */
async function loadProfileSnapshot(uid: string): Promise<{
  found: boolean;
  unreadable: boolean;
  shopName: string;
  fullName: string;
  points: number | null;
}> {
  const pb = await pbGetProfile(uid); // null = off / missing / error (logged)

  // Fast path: the VPS copy knows the profile AND its balance — no Firestore.
  if (pb && typeof pb.aiPoints === 'number') {
    return {
      found: true,
      unreadable: false,
      shopName: pb.shopName ?? '',
      fullName: pb.fullName ?? '',
      points: pb.aiPoints,
    };
  }

  try {
    const snap = await db.collection('userProfiles').doc(uid).get();
    const fsData = snap.exists ? snap.data()! : null;
    if (!fsData) {
      return {
        found: pb !== null,
        unreadable: false,
        shopName: pb?.shopName ?? '',
        fullName: pb?.fullName ?? '',
        points: pb?.aiPoints ?? null,
      };
    }
    return {
      found: true,
      unreadable: false,
      shopName:
        pb?.shopName ?? (typeof fsData.shopName === 'string' ? fsData.shopName : ''),
      fullName:
        pb?.fullName ?? (typeof fsData.fullName === 'string' ? fsData.fullName : ''),
      points:
        typeof pb?.aiPoints === 'number'
          ? pb.aiPoints
          : typeof fsData.aiPoints === 'number'
            ? fsData.aiPoints
            : 0, // Firestore profile without a balance field == 0 (as before)
    };
  } catch (error) {
    console.error('[live-session] profile read failed:', error);
    return {
      found: pb !== null,
      unreadable: pb === null,
      shopName: pb?.shopName ?? '',
      fullName: pb?.fullName ?? '',
      points: pb?.aiPoints ?? null,
    };
  }
}

/**
 * The seller's session — VPS store first, Firestore second. Null = no session
 * in any store that answered (callers treat it as "not live anywhere").
 */
async function loadSessionSnapshot(
  sellerId: string,
): Promise<{ source: 'vps' | 'firestore'; data: Record<string, unknown> } | null> {
  const mirrored = await pbGetLiveSession(sellerId);
  if (mirrored && Object.keys(mirrored.data).length > 0) {
    return { source: 'vps', data: mirrored.data };
  }
  try {
    const snap = await db.collection('liveSessions').doc(sellerId).get();
    if (!snap.exists) return null;
    return { source: 'firestore', data: (snap.data() ?? {}) as Record<string, unknown> };
  } catch (error) {
    console.error('[live-session] Firestore session read failed:', error);
    return null;
  }
}

/**
 * The seller's profile document may not exist yet (older accounts, OAuth
 * signups). Create a minimal one instead of 404-ing — a missing profile is a
 * data gap, not a reason to block going live or to charge anything.
 */
async function ensureProfile(sellerId: string): Promise<{ found: boolean }> {
  // VPS copy first: if the row is already here, nothing to create.
  const mirrored = await pbGetProfile(sellerId);
  if (mirrored) return { found: true };

  let found = false;
  let fsData: Record<string, unknown> | null = null;
  try {
    const ref = db.collection('userProfiles').doc(sellerId);
    const snap = await ref.get();
    if (snap.exists) {
      fsData = (snap.data() ?? {}) as Record<string, unknown>;
      found = true;
    } else {
      await ref.set({
        uid: sellerId,
        aiPoints: 0,
        createdAt: Timestamp.now(),
      }, { merge: true });
      fsData = { uid: sellerId, aiPoints: 0 };
    }
  } catch (error) {
    console.error('[live-session] Firestore profile ensure failed:', error);
  }

  /*
   * VPS row: copy exactly what we KNOW — never a guessed balance (an absent
   * `aiPoints` stays absent so the charge path keeps asking Firestore rather
   * than treating "unknown" as zero; the backfill script fills it in).
   */
  const patch: Record<string, string | number> = {};
  if (fsData) {
    for (const key of ['email', 'fullName', 'username', 'userRole', 'shopName', 'phoneNumber', 'profilePictureUrl'] as const) {
      const value = fsData[key];
      if (typeof value === 'string' && value) patch[key] = value;
    }
    if (typeof fsData.aiPoints === 'number') patch.aiPoints = fsData.aiPoints;
  }
  await pbUpsertProfile(sellerId, patch); // false → the retry below retries it

  return { found };
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

  let liveSessionId: string | undefined;
  try {
    liveSessionId = (await request.json())?.liveSessionId;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!liveSessionId) {
    return NextResponse.json({ error: 'Live Session ID is required.' }, { status: 400 });
  }  try {
    const sessionRef = db.collection('liveSessions').doc(liveSessionId);

    /*
     * VPS store first, Firestore second — ending a broadcast must not depend
     * on the same store whose outage stranded it. A session the VPS has
     * (mirrored at go-live) is enough to finish the job.
     */
    const mirrored = await pbGetLiveSession(liveSessionId);
    let session: Record<string, unknown> | null =
      mirrored && Object.keys(mirrored.data).length > 0 ? mirrored.data : null;
    if (!session) {
      try {
        const snap = await sessionRef.get();
        session = snap.exists ? ((snap.data() ?? {}) as Record<string, unknown>) : null;
      } catch (error) {
        console.error('[live-session] Firestore session read failed:', error);
        return NextResponse.json({ error: 'Session store unreachable.' }, { status: 503 });
      }
    }

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    // Role: VPS profile first (it carries `userRole`), Firestore second —
    // an unreadable role just falls back to the owner check below.
    let isAdmin = (await pbGetProfile(userId))?.userRole === 'admin';
    if (!isAdmin) {
      try {
        const adminProfile = await db.collection('userProfiles'). doc(userId).get();
        isAdmin = adminProfile.data()?.userRole === 'admin';
      } catch {
        // Role unreadable → treat as non-admin; sellers still pass `isOwner`.
      }
    }
    const isOwner = session.sellerId === userId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Access denied.' }, { status: 403 });
    }

    if (session.status === 'ended') {
      // Already ended — repeat cleanup requests are a no-op.
      return NextResponse.json({ success: true, message: 'Live session already ended.' });
    }

    const endPatch: Record<string, unknown> = {
      status: 'ended',
      endTime: Timestamp.now(),
      videosdkMeetingId: null,
      livekitRoomName: null,
      pinnedProductId: null,
      activeOffer: null,
      timeRemainingMs: 0,
      terminatedBy: isAdmin ? 'admin' : 'seller',
    };

    if (pocketBaseEnabled()) {
      // Merge on the VPS copy (title/startTime survive), then mirror the same
      // update to Firestore best-effort — its failure must not keep a session
      // "live".
      const ok = await pbEndLiveSession(liveSessionId, endPatch);
      if (ok) {
        try {
          await sessionRef.update(endPatch);
        } catch (error) {
          console.error('[live-session] Firestore mirror of end failed (ended on VPS):', error);
        }
        return NextResponse.json({ success: true, message: 'Live session ended.' });
      }
      // VPS write failed → original Firestore-only behaviour below.
    }

    await sessionRef.update(endPatch);

    return NextResponse.json({ success: true, message: 'Live session ended.' });
  } catch (error: any) {
    console.error('Error ending live session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}