import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { getAuth } from 'firebase-admin/auth';
import { runCleanup, type CleanupReport } from '@/lib/media/service';
import { clearStorageStatsCache } from '@/lib/media/storage';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Admin-only gate. */
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

/** POST /api/media/cleanup — admin trigger for the safe cleanup sweeper. */
export const POST = async (request: Request): Promise<Response> => {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const report: CleanupReport = await runCleanup();
    clearStorageStatsCache();
    return NextResponse.json(report);
  } catch (error) {
    console.error('[media/cleanup]', error);
    return NextResponse.json({ error: 'Cleanup failed.' }, { status: 500 });
  }
};
