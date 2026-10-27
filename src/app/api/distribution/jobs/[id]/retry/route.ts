/**
 * POST /api/distribution/jobs/{jobId}/retry — the ONLY way back from
 * `failed`.
 *
 * The job record alone decides eligibility (there is no input to forge):
 *   • status must be `failed`;
 *   • attempts must still be under MAX_JOB_ATTEMPTS (otherwise 409
 *     `retry_exhausted`);
 *   • the stored failure class must be retryable (`rate_limited` /
 *     `transient`) — auth, validation and not-configured failures need a
 *     human or a config change, so they are refused with 409
 *     `retry_not_allowed`;
 *   • the channel must be able to reach `queued` at all, i.e. credentials
 *     must exist (otherwise 409 `not_configured`).
 *
 * Ownership is re-verified from the stored job, and the move itself runs
 * through the same guarded, transactional transition — so a double-tapped
 * retry is an idempotent no-op rather than a second attempt.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import {
  DistributionError,
  distributionErrorStatus,
  retryDistributionJob,
} from '@/lib/vidnov-core/distribution/service';
import { distributionJobIdSchema, retryJobSchema } from '@/lib/vidnov-core/validation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await verifyUserContext(request);
  if (!ctx) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const { id } = await params;
  if (!distributionJobIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid job id.' }, { status: 400 });
  }

  // The body is intentionally ignored beyond schema validation: eligibility
  // comes from the stored job, never from the caller.
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (!retryJobSchema.safeParse(body ?? {}).success) {
    return NextResponse.json({ error: 'Invalid retry request.' }, { status: 400 });
  }

  try {
    const result = await retryDistributionJob({
      db,
      jobId: id,
      actor: { uid: ctx.uid, isAdmin: ctx.isAdmin },
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DistributionError) {
      return NextResponse.json({ error: err.message }, { status: distributionErrorStatus(err.code) });
    }
    // No error objects in logs — internal details stay server-side only.
    console.error('[core/distribution] retry failed');
    return NextResponse.json({ error: 'Could not retry this job.' }, { status: 500 });
  }
}
