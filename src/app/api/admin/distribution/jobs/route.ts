/**
 * GET /api/admin/distribution/jobs — the job queues, admin view.
 *
 * Admin-only. Query (all optional, validated): `status`, `destination`,
 * `confirmation`, `limit` (≤50). Equality filters only — no composite
 * indexes, no unbounded reads.
 *
 * Returns a SAFE projection: ids, state, attempts, sanitized error,
 * confirmation state + timestamps, the bounded submission log (status codes
 * and scrubbed messages — never response bodies or credentials), and a
 * derived `deadLetter` flag. The full job document never leaves the server.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Query } from 'firebase-admin/firestore';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import { pbListDistributionJobs } from '@/lib/pocketbase/distribution-jobs';
import { canRetry } from '@/lib/vidnov-core/distribution/job-utils';
import { listAdminDistributionJobsSchema } from '@/lib/vidnov-core/validation';
import type {
  JobStatus,
  JobConfirmation,
  SafeJobError,
  SubmissionRecord,
} from '@/lib/vidnov-core/types';

function isoOf(value: unknown): string | null {
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    return new Date((value as { toMillis: () => number }).toMillis()).toISOString();
  }
  return typeof value === 'string' ? value : null;
}

/** Safe projection of one job for the admin queues. */
function toAdminJob(id: string, data: Record<string, unknown>) {
  const status = (typeof data.status === 'string' ? data.status : 'ready') as JobStatus;
  const attempts = typeof data.attempts === 'number' ? data.attempts : 0;
  const lastError = data.lastError as
    | { class?: string; message?: string; attempt?: number; at?: string }
    | null
    | undefined;
  const confirmation = data.confirmation as JobConfirmation | undefined;
  const errorRecord = (data.lastError ?? null) as SafeJobError | null;
  const submissions = Array.isArray(data.submissions)
    ? (data.submissions as SubmissionRecord[]).slice(0, 10)
    : [];

  return {
    jobId: id,
    productId: typeof data.productId === 'string' ? data.productId : null,
    sellerId: typeof data.sellerId === 'string' ? data.sellerId : null,
    channel: typeof data.channel === 'string' ? data.channel : null,
    status,
    attempts,
    verifyAttempts: typeof data.verifyAttempts === 'number' ? data.verifyAttempts : 0,
    adminRequeues: typeof data.adminRequeues === 'number' ? data.adminRequeues : 0,
    payloadVersion: typeof data.payloadVersion === 'string' ? data.payloadVersion : null,
    integrationStatus:
      data.integrationStatus === 'configured' ? 'configured' : 'not_configured',
    confirmation: confirmation
      ? {
          state: confirmation.state,
          remoteId: confirmation.remoteId ?? null,
          at: confirmation.at ?? null,
          verifiedAt: confirmation.verifiedAt ?? null,
          message: confirmation.message ?? null,
        }
      : null,
    submissions: submissions.map((s) => ({
      at: s.at,
      attempt: s.attempt,
      outcome: s.outcome,
      ...(s.responseStatus !== undefined ? { responseStatus: s.responseStatus } : {}),
      ...(s.remoteId ? { remoteId: s.remoteId } : {}),
      ...(s.errorClass ? { errorClass: s.errorClass } : {}),
      ...(s.message ? { message: s.message } : {}),
    })),
    deadLetter: status === 'failed' && !canRetry({ status, attempts, lastError: errorRecord }),
    lastError: lastError
      ? {
          class: lastError.class ?? 'unknown',
          message: lastError.message ?? '',
          attempt: lastError.attempt ?? 0,
          at: lastError.at ?? null,
        }
      : null,
    updatedAt: isoOf(data.updatedAt),
  };
}

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const parsed = listAdminDistributionJobsSchema.safeParse({
    status: request.nextUrl.searchParams.get('status') ?? undefined,
    destination: request.nextUrl.searchParams.get('destination') ?? undefined,
    confirmation: request.nextUrl.searchParams.get('confirmation') ?? undefined,
    limit: request.nextUrl.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid queue filters.' }, { status: 400 });
  }

  const { status, destination, confirmation, limit } = parsed.data;

  /*
   * Firestore first (the source of truth), the VPS mirror second: a blocked
   * Firestore project degrades to the mirrored copy instead of an error
   * page — the admin always sees the queues the VPS knows about.
   */
  try {
    // Equality-only filters (incl. the nested `confirmation.state` path) —
    // served by Firestore's merge of single-field indexes, no composite.
    let q: Query = db.collection('distributionJobs');
    if (status) q = q.where('status', '==', status);
    if (destination) q = q.where('channel', '==', destination);
    if (confirmation) q = q.where('confirmation.state', '==', confirmation);
    const snap = await q.limit(limit).get();

    const items = snap.docs.map((d) =>
      toAdminJob(d.id, (d.data() ?? {}) as Record<string, unknown>),
    );
    return NextResponse.json({ items, count: items.length, limit, source: 'firestore' });
  } catch {
    // No error objects in logs — internal details stay server-side only.
    console.error('[core/distribution] Firestore job list failed — trying the VPS mirror');
  }

  const mirrored = await pbListDistributionJobs(
    {
      ...(status ? { status } : {}),
      ...(destination ? { channel: destination } : {}),
      ...(confirmation ? { confirmationState: confirmation } : {}),
    },
    limit,
  );
  if (mirrored) {
    const items = mirrored.map((j) => toAdminJob(j.id, j.data));
    return NextResponse.json({ items, count: items.length, limit, source: 'vps' });
  }

  return NextResponse.json({ error: 'Queues are temporarily unavailable.' }, { status: 500 });
}
