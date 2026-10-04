import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { getAuth } from 'firebase-admin/auth';
import { getStorageStats, clearStorageStatsCache } from '@/lib/media/storage';
import { MEDIA_COLLECTION, MEDIA_ROOT } from '@/lib/media/config';
import type { MediaRecord } from '@/lib/media/service';

export const runtime = 'nodejs';

/** Admin-only gate mirroring the existing admin API pattern. */
async function verifyAdmin(request: Request) {
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '');
  if (!token) return null;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    const profile = await db.collection('userProfiles').doc(decoded.uid).get();
    if (profile.exists && profile.data()?.userRole === 'admin') return decoded.uid;
    return null;
  } catch {
    return null;
  }
}

/**
 * GET /api/media/storage — admin storage monitor (spec §6):
 * total/used/free disk, media/tmp sizes, file counts, largest files,
 * protection mode + tripped threshold.
 */
export async function GET(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const stats = await getStorageStats();

    // Media stats from Firestore (counts + bytes + largest files).
    const snap = await db.collection(MEDIA_COLLECTION).get();
    let images = 0;
    let videos = 0;
    let thumbnails = 0;
    let failed = 0;
    let mediaBytes = 0;
    const largest: Array<{
      id: string;
      name: string;
      type: string;
      sizeBytes: number;
      url: string;
      createdAt: string | null;
    }> = [];

    snap.forEach((doc) => {
      const d = doc.data() as MediaRecord;
      if (d.status === 'READY') {
        if (d.type === 'image') images += 1;
        if (d.type === 'video') videos += 1;
        if (d.thumbnailPath) thumbnails += 1;
        mediaBytes += d.sizeBytes ?? 0;
        largest.push({
          id: doc.id,
          name: d.originalName || d.storedName,
          type: d.type,
          sizeBytes: d.sizeBytes ?? 0,
          url: d.thumbnailPath
            ? `/api/media/file/${d.thumbnailPath}`
            : `/api/media/file/${d.storagePath}`,
          createdAt: (d.createdAt as any)?.toDate?.()?.toISOString() ?? null,
        });
      }
      if (d.status === 'FAILED') failed += 1;
    });

    largest.sort((a, b) => b.sizeBytes - a.sizeBytes);

    return NextResponse.json({
      storage: stats,
      media: { images, videos, thumbnails, failed, mediaBytes },
      largestFiles: largest.slice(0, 10),
      tmpPath: process.env.VIDNOV_TMP_ROOT || '/var/lib/vidnov/tmp',
      mediaPath: MEDIA_ROOT,
    });
  } catch (error) {
    console.error('[media/storage]', error);
    return NextResponse.json({ error: 'Failed to read storage stats.' }, { status: 500 });
  }
}

/** Also expose cache-busting for the admin dashboard refresh button. */
export async function POST(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  clearStorageStatsCache();
  const stats = await getStorageStats();
  return NextResponse.json({ storage: stats });
}
