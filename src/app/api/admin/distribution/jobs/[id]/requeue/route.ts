/**
 * POST /api/admin/distribution/jobs/{jobId}/requeue — dead-letter recovery.
 *
 * Admin-only (enforced AGAIN inside the service, not just here). Refuses
 * jobs that can still be retried normally, unconfigured channels, non-failed
 * states, and anything that already used its bounded admin re-queue budget.
 * Every accepted re-queue writes one audit entry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import {
  DistributionError,
  adminRequeueDistributionJob,
  distributionErrorStatus,
} from '@/lib/vidnov-core/distribution/service';
import { distributionJobIdSchema, retryJobSchema } from '@/lib/vidnov-core/validation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const { id } = await params;
  if (!distributionJobIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid job id.' }, { status: 400 });
  }

  // Empty body is still validated — the action takes no client input.
  let body: unknown = {};
  try {
    const raw = await request.text();
    if (raw.trim()) body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }
  if (!retryJobSchema.safeParse(body ?? {}).success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  try {
    const result = await adminRequeueDistributionJob({
      db,
      jobId: id,
      actor: { uid: adminUid, isAdmin: true },
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DistributionError) {
      return NextResponse.json({ error: err.message }, { status: distributionErrorStatus(err.code) });
    }
    // No error objects in logs — internal details stay server-side only.
    console.error('[core/distribution] requeue failed');
    return NextResponse.json({ error: 'Could not re-queue this job.' }, { status: 500 });
  }
}
