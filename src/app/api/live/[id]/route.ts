import { NextResponse, type NextRequest } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import {
  livekitConfigured,
  livekitUrl,
  createViewerToken,
  getLiveStream,
  updateLiveStream,
  viewerIdentity,
  endLiveStream,
} from '@/lib/live/service';
import { LIVESTREAMS_COLLECTION, type LiveStream } from '@/lib/live/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/live/[id] (spec §22, §24)
 *
 * Returns the stream + a temporary viewer token when the caller may watch.
 * Visibility rules: PUBLIC → anyone; FOLLOWERS/CUSTOMERS → owner-of-profile
 * check is delegated to the client profile state (server re-checks
 * relationship cheaply); PRIVATE → seller + admins only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!livekitConfigured()) {
    return NextResponse.json({ error: 'Live streaming is starting up.' }, { status: 503 });
  }

  const { id } = await params;
  const stream = await getLiveStream(id);
  if (!stream) return NextResponse.json({ error: 'Stream not found.' }, { status: 404 });

  const isOwner = stream.sellerId === user.uid;
  const isAdmin = user.role === 'admin';

  if (stream.status === 'ENDED' || stream.status === 'CANCELLED' || stream.status === 'FAILED') {
    return NextResponse.json({ error: 'This live has ended.' }, { status: 410 });
  }

  if (stream.visibility === 'PRIVATE' && !isOwner && !isAdmin) {
    return NextResponse.json({ error: 'This stream is private.' }, { status: 403 });
  }

  if (stream.visibility === 'FOLLOWERS' && !isOwner && !isAdmin) {
    // The follow system stores the relationship on the buyer's profile
    // (userProfiles.following array — see /api/follow).
    const profileSnap = await db.collection('userProfiles').doc(user.uid).get();
    const following = ((profileSnap.data() as { following?: unknown[] })?.following ?? []) as unknown[];
    if (!following.includes(stream.sellerId)) {
      return NextResponse.json({ error: 'Follow the business to watch this live.' }, { status: 403 });
    }
  }

  try {
    const token = await createViewerToken(
      user.uid,
      stream.roomName,
      user.name || user.businessName || 'Viewer',
    );

    // Presence + analytics (§37, §40): increment live counters.
    const streamRef = db.collection(LIVESTREAMS_COLLECTION).doc(id);
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(streamRef);
      if (!fresh.exists) return;
      const data = fresh.data() as LiveStream;
      const nextCount = (data.viewerCount ?? 0) + 1;
      tx.update(streamRef, {
        viewerCount: FieldValue.increment(1),
        totalJoins: FieldValue.increment(1),
        peakViewers: Math.max(data.peakViewers ?? 0, nextCount),
        updatedAt: new Date(),
      });
    }).catch(() => undefined);

    const safe: LiveStream & { token: string; wsUrl: string; identity: string } = {
      ...stream,
      token,
      wsUrl: livekitUrl(),
      identity: viewerIdentity(user.uid),
    };
    return NextResponse.json(safe);
  } catch (error) {
    console.error('[live/get]', error);
    return NextResponse.json({ error: 'Could not join the stream.' }, { status: 500 });
  }
}

/**
 * DELETE = end the live (seller or admin only, spec §34).
 * Verifies ownership, then marks ENDED with duration; the client stops
 * publishing and closes the room connection.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const stream = await getLiveStream(id);
  if (!stream) return NextResponse.json({ error: 'Stream not found.' }, { status: 404 });

  const isOwner = stream.sellerId === user.uid;
  const isAdmin = user.role === 'admin';
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Only the host can end this live.' }, { status: 403 });
  }

  const ended = await endLiveStream(id);
  return NextResponse.json({ ok: true, stream: ended });
}

/** POST = leave (decrement presence). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ ok: true }); // soft success

  const { id } = await params;
  await db
    .collection(LIVESTREAMS_COLLECTION)
    .doc(id)
    .update({ viewerCount: FieldValue.increment(-1) })
    .catch(() => undefined);
  return NextResponse.json({ ok: true });
}
