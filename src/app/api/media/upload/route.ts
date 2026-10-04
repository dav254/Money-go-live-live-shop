import { NextResponse } from 'next/server';
import { intakeUpload } from '@/lib/media/service';
import { verifyRequestUser } from '@/lib/media/api-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/media/upload — multipart upload of one file per request.
 * The file is validated, stashed in tmp, queued for background
 * processing, and a mediaId is returned immediately.
 *
 * Optional form fields:
 *  - postId    → attach to a feed post
 *  - requestId → attach as PRIVATE request media (requests/request_<id>/)
 *  - offerId   → attach as PRIVATE offer media (requests/offer_<id>/)
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: 'Invalid multipart form data.' }, { status: 400 });
    }

    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file field.' }, { status: 400 });
    }

    const postId = typeof form.get('postId') === 'string' ? (form.get('postId') as string) : undefined;
    const requestId = typeof form.get('requestId') === 'string' ? (form.get('requestId') as string) : undefined;
    const offerId = typeof form.get('offerId') === 'string' ? (form.get('offerId') as string) : undefined;

    // Only trust request/offer ownership that the caller actually has.
    if (requestId && offerId) {
      return NextResponse.json({ error: 'Choose either requestId or offerId, not both.' }, { status: 400 });
    }

    const result = await intakeUpload({
      file,
      userId: user.uid,
      postId,
      requestId: requestId || undefined,
      offerId: offerId || undefined,
    });
    if (!result.accepted) {
      return NextResponse.json({ error: result.reason }, { status: 415 });
    }

    return NextResponse.json({ mediaId: result.mediaId });
  } catch (error) {
    console.error('[media/upload]', error);
    return NextResponse.json({ error: 'Upload failed on the server.' }, { status: 500 });
  }
}
