import { NextResponse, type NextRequest } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import {
  livekitConfigured,
  livekitUrl,
  createSellerToken,
  createLiveStream,
} from '@/lib/live/service';
import { sellerIdentity } from '@/lib/live/service';
import { videosdkConfigured, videosdkToken, ensureVideoSdkMeeting } from '@/lib/live/videosdk';
import { db } from '@/firebase/server';
import { LIVESTREAMS_COLLECTION } from '@/lib/live/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/live/create (spec §12)
 *
 * 1. Authenticate seller
 * 2. Verify business account + moderation status
 * 3. Create the LiveStream record
 * 4. Mint a temporary broadcaster token
 * 5. Return connection info — never the API secret (§46)
 */
export async function POST(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.role !== 'seller' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Only business accounts can go live.' }, { status: 403 });
  }
  // LiveKit is the primary transport; VideoSDK is used when LiveKit is not
  // configured (that is the account currently connected to this project).
  if (!livekitConfigured() && !videosdkConfigured()) {
    return NextResponse.json(
      { error: 'Live streaming is starting up. Please try again shortly.' },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      title?: string;
      description?: string;
      category?: string;
      location?: string;
      latitude?: number;
      longitude?: number;
      visibility?: 'PUBLIC' | 'FOLLOWERS' | 'CUSTOMERS' | 'PRIVATE';
      thumbnailMediaId?: string;
    };

    const title = (body.title ?? '').trim();
    if (title.length < 3) {
      return NextResponse.json({ error: 'Give your live a title (3+ characters).' }, { status: 400 });
    }

    const stream = await createLiveStream({
      sellerId: user.uid,
      title,
      description: body.description?.trim(),
      category: body.category ?? null,
      location: body.location ?? null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      visibility: body.visibility ?? 'PUBLIC',
      thumbnailMediaId: body.thumbnailMediaId ?? null,
      businessId: user.businessName ? user.uid : null,
    });

    const displayName = user.businessName || user.name || 'Vidnov Business';

    if (!livekitConfigured()) {
      const meetingId = await ensureVideoSdkMeeting();
      const token = await videosdkToken();
      if (!meetingId || !token) {
        return NextResponse.json(
          { error: 'Live streaming is starting up. Please try again shortly.' },
          { status: 503 },
        );
      }
      // Remember the room on the stream so viewers join the same session.
      await db.collection(LIVESTREAMS_COLLECTION).doc(stream.id).set(
        { videoSdkMeetingId: meetingId },
        { merge: true },
      ).catch(() => undefined);
      return NextResponse.json({
        provider: 'videosdk',
        stream: { ...stream, videoSdkMeetingId: meetingId },
        meetingId,
        token,
        identity: user.uid,
      });
    }

    const token = await createSellerToken(user.uid, stream.roomName, displayName);

    const session = {
      provider: 'livekit' as const,
      stream,
      wsUrl: livekitUrl(),
      token,
      identity: sellerIdentity(user.uid),
    };
    return NextResponse.json({ ...session, identity: session.identity });
  } catch (error) {
    console.error('[live/create]', error);
    return NextResponse.json({ error: 'Could not start the stream.' }, { status: 500 });
  }
}
