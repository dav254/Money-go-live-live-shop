import { NextRequest, NextResponse } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { listJobsForSeller } from '@/lib/social-reach/jobs';

export const runtime = 'nodejs';

/**
 * GET /api/social-reach/history — the caller's own publishing jobs, newest
 * first. The uid comes from the verified ID token, never from the query, so
 * one seller can never read another's history.
 *
 * Returns safe job fields only (status, product name, timestamps, platform id).
 * No tokens, no store internals.
 */
export async function GET(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'seller' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Only business accounts can use Social Reach.' }, { status: 403 });
  }

  try {
    const jobs = await listJobsForSeller(user.uid, 50);
    return NextResponse.json({
      jobs: jobs.map((j) => ({
        id: j.id,
        status: j.status,
        productId: j.productId ?? null,
        productName: j.productName ?? null,
        caption: j.caption ?? '',
        pointsCharged: j.pointsCharged,
        tiktokVideoId: j.tiktokVideoId ?? null,
        errorMessage: j.errorMessage ?? null,
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
      })),
    });
  } catch (error) {
    console.error('[social-reach] history failed', (error as Error)?.message);
    return NextResponse.json({ error: 'Could not load publishing history.' }, { status: 503 });
  }
}