import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { MEDIA_COLLECTION } from '@/lib/media/config';
import { mediaRecordToUrls } from '@/lib/media/service';

export const runtime = 'nodejs';

/**
 * GET /api/media/status?id=<mediaId> — lets the upload UI poll
 * UPLOADING → PROCESSING → READY and receive the final URLs.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const snap = await db.collection(MEDIA_COLLECTION).doc(id).get();
  if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data = snap.data()!;
  return NextResponse.json({
    id,
    status: data.status,
    type: data.type,
    error: data.error ?? null,
    ...mediaRecordToUrls(data),
  });
}
