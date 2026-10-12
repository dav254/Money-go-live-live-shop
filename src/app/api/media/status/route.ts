import { NextResponse } from 'next/server';
import { readStatus } from '@/lib/media/engine';

export const runtime = 'nodejs';

/**
 * GET /api/media/status?id=<mediaId> — lets the upload UI poll a background
 * VIDEO transcode until it reaches READY and receive the final URLs.
 *
 * Rebuilt to be disk-backed: the engine writes a small JSON sidecar per media
 * item under `<media>-status/`, so this route never touches Firestore and
 * cannot answer 503 under backend load. Images resolve synchronously at upload
 * time and never need this endpoint, but it stays for the async video path.
 *
 * A mediaId that is present but not yet READY simply reports PROCESSING — the
 * poll loop keeps waiting. A truly unknown id reports FAILED so the client
 * stops instead of polling forever.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const rec = await readStatus(id);
  if (!rec) {
    return NextResponse.json({
      id,
      status: 'FAILED',
      error: 'Unknown media item.',
    });
  }

  return NextResponse.json({
    id: rec.id,
    status: rec.status,
    type: rec.type,
    error: rec.error ?? null,
    url: rec.url,
    thumbnailUrl: rec.thumbnailUrl,
    width: rec.width,
    height: rec.height,
    durationSeconds: rec.durationSeconds,
    sizeBytes: rec.sizeBytes,
  });
}
