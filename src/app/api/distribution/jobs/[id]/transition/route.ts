/**
 * POST /api/distribution/jobs/{jobId}/transition — one guarded state change.
 *
 * Flow: verified identity → strict job-id + body validation → service policy
 * (ownership from the STORED seller id, pure transition policy, then the
 * transactional transition). A repeat of the state the job is already in is
 * an idempotent success with `changed: false`.
 *
 * Hard limits enforced before any write:
 *   • `processing` / `submitted` / `live` are refused — only a connected
 *     channel integration may ever report them (no self-declared success);
 *   • an unconfigured channel cannot advance past its reachable states;
 *   • `failed → queued` is refused here — retries go through the retry
 *     action, which enforces the retryable-class check and the attempt cap;
 *   • only the owner of the product (or an admin) may change a job.
 *
 * A successful move into `failed` also records a VERIFIED, idempotent
 * `distribution_job_failed` event; if that write fails the state change still
 * stands and the response reports `eventRecorded: false`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import {
  DistributionError,
  applyJobTransition,
  distributionErrorStatus,
} from '@/lib/vidnov-core/distribution/service';
import { distributionJobIdSchema, transitionJobSchema } from '@/lib/vidnov-core/validation';

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const parsed = transitionJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid job state.' }, { status: 400 });
  }

  try {
    const result = await applyJobTransition({
      db,
      jobId: id,
      to: parsed.data.to,
      actor: { uid: ctx.uid, isAdmin: ctx.isAdmin },
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DistributionError) {
      return NextResponse.json({ error: err.message }, { status: distributionErrorStatus(err.code) });
    }
    // No error objects in logs — internal details stay server-side only.
    console.error('[core/distribution] transition failed');
    return NextResponse.json({ error: 'Could not update this job.' }, { status: 500 });
  }
}
