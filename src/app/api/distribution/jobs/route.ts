/**
 * /api/distribution/jobs — prepare-and-track channel jobs (Core Engine).
 *
 * GET  (authenticated) → the caller's own jobs; an explicit `productId` is
 *                        ownership-checked against the product document
 *                        (admins may inspect any listing's jobs). A bare
 *                        admin list is capped at 25.
 * POST (authenticated) → create/prepare a job for one product + channel.
 *                        Ownership, payload and idempotency live in the
 *                        service; a double-click resolves to the SAME job
 *                        (`duplicate: true`), never two documents.
 *
 * Authorization: `verifyUserContext` (Bearer token — the same primitive every
 * engine route uses). The acting uid/role always comes from the verified
 * token; nothing in the body or query can claim a seller id.
 *
 * Responses carry only safe job fields: status, attempts, a sanitized error
 * record and boolean capability flags. No payloads, no credentials, no env
 * values.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import {
  DistributionError,
  createDistributionJob,
  distributionErrorStatus,
} from '@/lib/vidnov-core/distribution/service';
import {
  createDistributionJobSchema,
  listDistributionJobsSchema,
} from '@/lib/vidnov-core/validation';

/** Job document ids are always `dj_` + 40 hex (see distributionJobId). */
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

/** Safe projection — the full job document never leaves the server. */
function toPublicJob(id: string, data: Record<string, unknown>) {
  const lastError = data.lastError as
    | { class?: string; message?: string; attempt?: number; at?: string }
    | null
    | undefined;
  return {
    jobId: id,
    productId: typeof data.productId === 'string' ? data.productId : null,
    channel: typeof data.channel === 'string' ? data.channel : null,
    status: typeof data.status === 'string' ? data.status : 'ready',
    attempts: typeof data.attempts === 'number' ? data.attempts : 0,
    integrationStatus: data.integrationStatus === 'configured' ? 'configured' : 'not_configured',
    supportedActions: Array.isArray(data.supportedActions)
      ? data.supportedActions.filter((a): a is string => typeof a === 'string')
      : [],
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
  const ctx = await verifyUserContext(request);
  if (!ctx) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const parsed = listDistributionJobsSchema.safeParse({
    productId: request.nextUrl.searchParams.get('productId') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query.' }, { status: 400 });

  try {
    const { productId } = parsed.data;
    const LIMIT = 25;
    let snap;

    if (productId) {
      // Ownership is proven against the PRODUCT document, not a client claim.
      const product = await db.collection('products').doc(productId).get();
      if (!product.exists) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
      const sellerId = (product.data() ?? {}).sellerId;
      if (!ctx.isAdmin && sellerId !== ctx.uid) {
        return NextResponse.json({ error: 'You do not own this listing.' }, { status: 403 });
      }
      snap = await db.collection('distributionJobs').where('productId', '==', productId).limit(LIMIT).get();
    } else if (ctx.isAdmin) {
      // Bounded admin overview — newest-agnostic, hard capped.
      snap = await db.collection('distributionJobs').limit(LIMIT).get();
    } else {
      // A seller's own jobs, keyed on the STORED seller id.
      snap = await db.collection('distributionJobs').where('sellerId', '==', ctx.uid).limit(LIMIT).get();
    }

    const items = snap.docs.map((d) => toPublicJob(d.id, (d.data() ?? {}) as Record<string, unknown>));
    return NextResponse.json({ items, count: items.length });
  } catch {
    // No error objects in logs — internal details stay server-side only.
    console.error('[core/distribution] list failed');
    return NextResponse.json({ error: 'Jobs are temporarily unavailable.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await verifyUserContext(request);
  if (!ctx) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const parsed = createDistributionJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid job data.' }, { status: 400 });
  }

  try {
    const result = await createDistributionJob({
      db,
      productId: parsed.data.productId,
      channel: parsed.data.channel,
      idempotencyKey: parsed.data.idempotencyKey,
      actorUid: ctx.uid,
      isAdmin: ctx.isAdmin,
    });
    // Same job already existed ⇒ the create was a no-op (200, not 201).
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (err) {
    if (err instanceof DistributionError) {
      return NextResponse.json({ error: err.message }, { status: distributionErrorStatus(err.code) });
    }
    console.error('[core/distribution] create failed');
    return NextResponse.json({ error: 'Could not prepare this job.' }, { status: 500 });
  }
}
