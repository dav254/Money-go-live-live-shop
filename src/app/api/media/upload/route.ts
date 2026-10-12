import { NextResponse } from 'next/server';
import { intake } from '@/lib/media/engine';
import { verifyRequestUser } from '@/lib/media/api-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/media/upload — multipart upload of one file per request.
 *
 * Rebuilt around the disk-based engine: images are processed synchronously and
 * the final URL is returned in THIS response, so the seller never waits on a
 * status poll (the old Firestore-backed poll could 503 under load and wedge the
 * upload at 90%). Videos are transcoded in the background and report only a
 * mediaId here — the client polls /api/media/status (now disk-backed) for those.
 *
 * Optional form fields:
 *  - postId    → attach to a feed post
 *  - requestId → attach as PRIVATE request media
 *  - offerId   → attach as PRIVATE offer media
 *  - folder    → owner folder (chats/<id>, support/<uid>, verification/<uid>,
 *                avatars/<uid>, products/<uid>) — validated server-side.
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'Invalid multipart form data.' }, { status: 400 });

    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file field.' }, { status: 400 });

    const postId = typeof form.get('postId') === 'string' ? (form.get('postId') as string) : undefined;
    const requestId = typeof form.get('requestId') === 'string' ? (form.get('requestId') as string) : undefined;
    const offerId = typeof form.get('offerId') === 'string' ? (form.get('offerId') as string) : undefined;
    const folder = typeof form.get('folder') === 'string' ? (form.get('folder') as string) : undefined;

    if (requestId && offerId) {
      return NextResponse.json({ error: 'Choose either requestId or offerId, not both.' }, { status: 400 });
    }
    if (folder && (requestId || offerId)) {
      return NextResponse.json({ error: 'Choose either folder or request/offer ownership, not both.' }, { status: 400 });
    }

    const result = await intake({
      file,
      userId: user.uid,
      postId,
      requestId,
      offerId,
      folder,
    });
    if (!result.accepted) {
      return NextResponse.json({ error: result.reason }, { status: 415 });
    }

    // Images/raw files include the final url + thumbnailUrl here; videos return
    // only mediaId (async transcode) and are polled via /api/media/status.
    return NextResponse.json({
      mediaId: result.mediaId,
      url: result.url,
      thumbnailUrl: result.thumbnailUrl,
    });
  } catch (error) {
    console.error('[media/upload]', error);
    return NextResponse.json({ error: 'Upload failed on the server.' }, { status: 500 });
  }
}
