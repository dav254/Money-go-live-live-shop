/**
 * DISTRIBUTION HUB — job lifecycle service (Firestore injected).
 *
 * The Firestore instance is a PARAMETER, not an import: routes pass the
 * admin `db` from `@/firebase/server`, tests pass a fake — so this service is
 * exercisable without credentials and the module never pulls Firebase Admin
 * into a test process on import.
 *
 * Collections: `distributionJobs` — server-owned, additive. Firestore rules
 * default-deny unknown collections to clients, which is exactly what this
 * surface wants (asserted in src/tests/vidnov-core.test.ts).
 *
 * Honesty invariants (see channels.ts):
 *   • a job is created only from a REAL product the caller owns (or admin);
 *   • `queue` is refused unless the channel has real credentials;
 *   • nothing here can set `live` — only a future, real submit path reports
 *     success through `transitionDistributionJob`.
 */

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { CHANNELS, getChannel, PAYLOAD_VERSION, type ChannelSourceProduct } from './channels';
import {
  DISTRIBUTION_JOBS_COLLECTION,
  canRetry,
  distributionJobId,
  evaluateTransition,
  nextStatus,
  safeJobError,
  type TransitionRefusal,
} from './job-utils';
import { buildTrackedUrl } from '../attribution/tracking';
import { recordAudit } from './audit';
import { recordCoreEvent } from '../events/recorder';
import type { ChannelId, IntegrationStatus, JobStatus, SafeJobError } from '../types';
import { MAX_ADMIN_REQUEUES, MAX_JOB_ATTEMPTS, RETRYABLE_ERROR_CLASSES } from '../types';

/** Engine failures thrown to routes — always a safe, static message. */
export class DistributionError extends Error {
  constructor(
    public readonly code:
      | 'not_found'
      | 'forbidden'
      | 'invalid_product'
      | 'invalid_transition'
      | 'not_configured'
      | 'retry_exhausted'
      | 'retry_not_allowed',
    message: string,
  ) {
    super(message);
    this.name = 'DistributionError';
  }
}

/** Policy refusal → service error code. One mapping, used by every caller. */
function refusalToCode(refusal: TransitionRefusal): DistributionError['code'] {
  if (refusal === 'not_configured') return 'not_configured';
  if (refusal === 'retry_not_allowed') return 'retry_not_allowed';
  return 'invalid_transition';
}

/** The authenticated caller of a route — built from the verified token. */
export interface JobActor {
  uid: string;
  isAdmin: boolean;
}

export interface CreateJobParams {
  db: Firestore;
  productId: string;
  channel: ChannelId;
  idempotencyKey?: string;
  actorUid: string;
  isAdmin: boolean;
}

export interface CreateJobResult {
  jobId: string;
  status: JobStatus;
  integrationStatus: IntegrationStatus;
  /** True when an identical job already existed — the create was a no-op. */
  duplicate: boolean;
  /** What the caller may do next; empty when the channel is not configured. */
  supportedActions: string[];
}

function pickProduct(id: string, data: Record<string, unknown>): ChannelSourceProduct {
  return {
    productId: id,
    sellerId: String(data.sellerId ?? ''),
    name: String(data.name ?? ''),
    description: data.description ? String(data.description) : undefined,
    price: Number(data.price ?? 0),
    localCurrency: data.localCurrency ? String(data.localCurrency) : undefined,
    stock: typeof data.stock === 'number' ? data.stock : undefined,
    availabilityState: data.availabilityState ? String(data.availabilityState) : undefined,
    condition: data.condition === 'used' || data.condition === 'new' ? data.condition : undefined,
    brand: data.brand ? String(data.brand) : undefined,
    category: data.category ? String(data.category) : undefined,
    location: (data.location as string) ?? (data.vendorLocation as string) ?? undefined,
    imageUrl: data.imageUrl ? String(data.imageUrl) : undefined,
    imageUrls: Array.isArray(data.imageUrls) ? (data.imageUrls as unknown[]).filter((u): u is string => typeof u === 'string') : undefined,
  };
}

/**
 * Prepares (and records) a distribution job for one product/channel.
 * Idempotent by construction: same (product, channel, version) or same
 * `idempotencyKey` ⇒ same document, `duplicate: true` on re-create.
 */
export async function createDistributionJob(params: CreateJobParams): Promise<CreateJobResult> {
  const { db, productId, channel, actorUid, isAdmin } = params;
  const ch = getChannel(channel);

  const productSnap = await db.collection('products').doc(productId).get();
  if (!productSnap.exists) throw new DistributionError('not_found', 'Listing not found.');
  const data = (productSnap.data() ?? {}) as Record<string, unknown>;

  // Ownership is verified against the authenticated caller — a client-supplied
  // seller id is never consulted.
  if (!isAdmin && data.sellerId !== actorUid) {
    throw new DistributionError('forbidden', 'You do not own this listing.');
  }
  if (typeof data.name !== 'string' || !data.name.trim() || typeof data.price !== 'number' || data.price < 0) {
    throw new DistributionError('invalid_product', 'Listing is missing required fields.');
  }

  const product = pickProduct(productId, data);
  const destinationUrl = buildTrackedUrl(`/products/${productId}`, { channel });
  const payload = ch.prepare(product, destinationUrl);

  const integrationStatus: IntegrationStatus = ch.canSubmit() ? 'configured' : 'not_configured';
  const jobId = distributionJobId({ productId, channel, payloadVersion: PAYLOAD_VERSION, idempotencyKey: params.idempotencyKey });

  const doc = {
    productId,
    sellerId: product.sellerId,
    channel,
    payloadVersion: PAYLOAD_VERSION,
    payload,
    integrationStatus,
    status: 'ready' as JobStatus,
    attempts: 0,
    lastError: null,
    supportedActions: ch.canSubmit() ? ['queue'] : [],
    createdBy: actorUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  try {
    await db.collection(DISTRIBUTION_JOBS_COLLECTION).doc(jobId).create(doc);
    return { jobId, status: 'ready', integrationStatus, duplicate: false, supportedActions: doc.supportedActions };
  } catch (err) {
    const code = (err as { code?: number | string })?.code;
    const alreadyExists = code === 6 || code === 'already-exists';
    if (!alreadyExists) throw err;
    const existing = await db.collection(DISTRIBUTION_JOBS_COLLECTION).doc(jobId).get();
    const ex = (existing.data() ?? {}) as { status?: JobStatus; integrationStatus?: IntegrationStatus; supportedActions?: string[] };
    return {
      jobId,
      status: ex.status ?? 'ready',
      integrationStatus: ex.integrationStatus ?? integrationStatus,
      duplicate: true,
      supportedActions: ex.supportedActions ?? [],
    };
  }
}

export interface TransitionParams {
  db: Firestore;
  jobId: string;
  to: JobStatus;
  /** Present when moving into `failed`. */
  error?: unknown;
}

/**
 * Concurrency-safe status change: runs in a transaction, validates the
 * transition, bounds attempts, and stores only a sanitized error record.
 * Returns the resulting status, or null when nothing changed (idempotent
 * re-assert of the same status still succeeds by returning it unchanged).
 */
export async function transitionDistributionJob(params: TransitionParams): Promise<JobStatus> {
  const { db, jobId, to, error } = params;
  const ref = db.collection(DISTRIBUTION_JOBS_COLLECTION).doc(jobId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new DistributionError('not_found', 'Job not found.');
    const job = (snap.data() ?? {}) as { status?: JobStatus; attempts?: number; lastError?: SafeJobError | null };

    const from = (job.status ?? 'ready') as JobStatus;
    if (from === to) return to;
    const valid = nextStatus(from, to);
    if (!valid) throw new DistributionError('invalid_transition', 'Job state change is not allowed.');

    const attempts = to === 'failed' ? (job.attempts ?? 0) + 1 : (job.attempts ?? 0);
    if (to === 'failed' && attempts > MAX_JOB_ATTEMPTS) {
      throw new DistributionError('retry_exhausted', 'Retry limit reached.');
    }

    tx.update(ref, {
      status: valid,
      attempts,
      lastError: to === 'failed' ? safeJobError(error, attempts) : null,
      updatedAt: FieldValue.serverTimestamp(),
      ...(to === 'submitted' ? { lastSubmittedAt: FieldValue.serverTimestamp() } : {}),
      ...(to === 'live' ? { lastLiveAt: FieldValue.serverTimestamp() } : {}),
    });
    return valid;
  });
}

/** Retry decision re-exported for routes — single source of retry truth. */
export function jobCanRetry(job: { status: JobStatus; attempts: number; lastError?: SafeJobError | null }): boolean {
  return canRetry(job);
}

/**
 * Per-status job counts (equality-only queries — no composite index needed).
 * A status whose count query fails comes back `null` (unknown), never a
 * fabricated 0.
 */
export async function distributionStatusCounts(db: Firestore): Promise<Record<string, number | null>> {
  const statuses: JobStatus[] = ['not_configured', 'ready', 'queued', 'processing', 'submitted', 'live', 'failed', 'needs_attention'];
  const out: Record<string, number | null> = {};
  await Promise.all(
    statuses.map(async (s) => {
      try {
        const snap = await db.collection(DISTRIBUTION_JOBS_COLLECTION).where('status', '==', s).count().get();
        out[s] = snap.data().count;
      } catch {
        out[s] = null;
      }
    }),
  );
  return out;
}

/**
 * `DistributionError` code → HTTP status. One mapping, shared by every
 * distribution route: 404 missing, 403 not yours, 400 bad listing, everything
 * else a state/config conflict (409).
 */
export function distributionErrorStatus(code: DistributionError['code']): number {
  if (code === 'not_found') return 404;
  if (code === 'forbidden') return 403;
  if (code === 'invalid_product') return 400;
  return 409;
}

/** Stored job fields this module reads. Nothing else is trusted. */
type JobRecord = {
  sellerId?: string;
  channel?: string;
  status?: JobStatus;
  attempts?: number;
  lastError?: SafeJobError | null;
};

/** Reads a job or throws the safe `not_found` error. */
async function readJob(db: Firestore, jobId: string): Promise<JobRecord> {
  const snap = await db.collection(DISTRIBUTION_JOBS_COLLECTION).doc(jobId).get();
  if (!snap.exists) throw new DistributionError('not_found', 'Job not found.');
  return (snap.data() ?? {}) as JobRecord;
}

/**
 * Ownership from the STORED seller id — never a client-supplied one. Admins
 * may act on any job; everyone else only on jobs for products they own.
 */
function assertOwnership(job: JobRecord, actor: JobActor): void {
  if (actor.isAdmin) return;
  if (!job.sellerId || job.sellerId !== actor.uid) {
    throw new DistributionError('forbidden', 'You do not own this listing.');
  }
}

/** Channel definition for a stored job; a corrupt channel value is refused. */
function jobChannel(job: JobRecord) {
  const ch = job.channel ? CHANNELS[job.channel as ChannelId] : undefined;
  if (!ch) throw new DistributionError('not_configured', 'This channel is not configured yet.');
  return ch;
}

export interface JobOutcomeResult {
  jobId: string;
  status: JobStatus;
  /** False when the request re-asserted the state the job was already in. */
  changed: boolean;
  /** False when the outcome event could not be written (state still changed). */
  eventRecorded: boolean;
}

/**
 * Records the VERIFIED outcome event for a job that reached a terminal-ish
 * state. Idempotent: the key includes the attempt number, and events are day
 * bucketed, so a retried request writes one event — never a second one.
 * Recording failures never undo the transition; they surface as
 * `eventRecorded: false`.
 */
async function recordJobOutcome(
  db: Firestore,
  job: JobRecord,
  jobId: string,
  status: JobStatus,
): Promise<boolean> {
  if (status !== 'failed' && status !== 'submitted') return true;
  try {
    const attempts = (await readJob(db, jobId)).attempts ?? job.attempts ?? 0;
    // `{recorded:false}` means an identical event already exists — the
    // outcome is durably recorded either way, so the caller sees success.
    await recordCoreEvent(db, {
      type: status === 'failed' ? 'distribution_job_failed' : 'distribution_job_succeeded',
      entityKind: 'distribution_job',
      entityId: jobId,
      origin: 'server',
      dedupeKey: `dj:${jobId}:${status}:${attempts}`,
    });
    return true;
  } catch {
    return false;
  }
}

export interface ApplyTransitionParams {
  db: Firestore;
  jobId: string;
  to: JobStatus;
  actor: JobActor;
  /** Present when moving into `failed`. */
  error?: unknown;
  /** Only the retry action may set this (opens `failed → queued`). */
  allowRetry?: boolean;
}

/**
 * Authenticated, ownership-checked, policy-checked status change.
 *
 * Order matters: ownership is verified against the stored job, then the pure
 * policy (`evaluateTransition`) decides, then the transactional transition
 * re-validates and applies. Adapter-only states can never be reached from a
 * route, an unconfigured channel cannot advance, and `failed → queued` is
 * refused unless the caller is the retry action.
 *
 * A re-assert of the current state is an idempotent success with
 * `changed: false` (and no second outcome event).
 */
export async function applyJobTransition(params: ApplyTransitionParams): Promise<JobOutcomeResult> {
  const { db, jobId, to, actor, error, allowRetry } = params;
  const job = await readJob(db, jobId);
  assertOwnership(job, actor);
  const ch = jobChannel(job);

  const from = (job.status ?? 'ready') as JobStatus;
  const decision = evaluateTransition({ from, to, reachable: ch.reachableStates, allowRetry });
  if (!decision.allowed) {
    throw new DistributionError(
      refusalToCode(decision.refusal ?? 'invalid_transition'),
      decision.message ?? 'Job state change is not allowed.',
    );
  }

  const status = await transitionDistributionJob({ db, jobId, to, error });
  const changed = from !== to;
  const eventRecorded = changed ? await recordJobOutcome(db, job, jobId, status) : true;
  return { jobId, status, changed, eventRecorded };
}

export interface RetryJobParams {
  db: Firestore;
  jobId: string;
  actor: JobActor;
}

/**
 * Safe retry: ONLY a failed job whose failure class is retryable and whose
 * attempt count is still under the cap may go back to `queued`.
 *
 * Refusals are specific so a caller can tell "wait and try later"
 * (`retry_exhausted`) from "a human/config change is needed"
 * (`retry_not_allowed`: auth, validation, not-configured). The actual state
 * change still runs through the guarded transition, which bounds attempts
 * again on the next failure.
 */
export async function retryDistributionJob(params: RetryJobParams): Promise<JobOutcomeResult> {
  const { db, jobId, actor } = params;
  const job = await readJob(db, jobId);
  assertOwnership(job, actor);

  const current = (job.status ?? 'ready') as JobStatus;
  // Double-tapped retry: an earlier request already put it back in the queue.
  // Report that truthfully as a no-op instead of an error — and never as a
  // second attempt.
  if (current === 'queued') {
    return { jobId, status: 'queued', changed: false, eventRecorded: true };
  }
  const attempts = job.attempts ?? 0;
  if (current !== 'failed') {
    throw new DistributionError('invalid_transition', 'Only failed jobs can be retried.');
  }
  if (attempts >= MAX_JOB_ATTEMPTS) {
    throw new DistributionError('retry_exhausted', 'Retry limit reached.');
  }
  const failureClass = job.lastError?.class;
  if (failureClass && !RETRYABLE_ERROR_CLASSES.includes(failureClass)) {
    throw new DistributionError('retry_not_allowed', 'This failure needs a configuration change before it can be retried.');
  }
  if (!canRetry({ status: 'failed', attempts, lastError: job.lastError ?? null })) {
    throw new DistributionError('retry_not_allowed', 'This job cannot be retried automatically.');
  }

  return applyJobTransition({ db, jobId, to: 'queued', actor, allowRetry: true });
}

/**
 * Admin dead-letter re-queue. FOR ADMINS ONLY, and only for jobs that are
 * genuinely stuck (retryable? no — `canRetry` is false: attempts exhausted
 * or a failure class that needs a config change first).
 *
 * Deliberate bounds:
 *   • admins only (`actor.isAdmin` — enforced here, not just in the route);
 *   • only `failed` jobs; still-retryable ones must use the retry action;
 *   • at most `MAX_ADMIN_REQUEUES` resets per job (the attempt cap cannot be
 *     laundered into infinity by clicking a button);
 *   • an unconfigured channel still refuses (credentials must exist first);
 *   • one audit entry per reset — who, what, when.
 */
export interface AdminRequeueParams {
  db: Firestore;
  jobId: string;
  actor: JobActor;
}

export async function adminRequeueDistributionJob(
  params: AdminRequeueParams,
): Promise<JobOutcomeResult> {
  const { db, jobId, actor } = params;
  if (!actor.isAdmin) {
    throw new DistributionError('forbidden', 'Admin access required.');
  }
  const job = await readJob(db, jobId);

  const current = (job.status ?? 'ready') as JobStatus;
  if (current !== 'failed') {
    throw new DistributionError('invalid_transition', 'Only failed jobs can be re-queued.');
  }
  const attempts = job.attempts ?? 0;
  if (canRetry({ status: 'failed', attempts, lastError: job.lastError ?? null })) {
    throw new DistributionError(
      'retry_not_allowed',
      'This job can still be retried through the retry action.',
    );
  }

  const ch = jobChannel(job); // refuses corrupt/unknown channels
  const decision = evaluateTransition({
    from: 'failed',
    to: 'queued',
    reachable: ch.reachableStates,
    allowRetry: true,
  });
  if (!decision.allowed) {
    throw new DistributionError(
      refusalToCode(decision.refusal ?? 'invalid_transition'),
      decision.message ?? 'Job state change is not allowed.',
    );
  }

  const resetsUsed =
    typeof (job as { adminRequeues?: unknown }).adminRequeues === 'number'
      ? ((job as { adminRequeues?: number }).adminRequeues as number)
      : 0;
  if (resetsUsed >= MAX_ADMIN_REQUEUES) {
    throw new DistributionError('retry_exhausted', 'Re-queue limit reached.');
  }

  const ref = db.collection(DISTRIBUTION_JOBS_COLLECTION).doc(jobId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new DistributionError('not_found', 'Job not found.');
    const data = (snap.data() ?? {}) as {
      status?: JobStatus;
      adminRequeues?: number;
    };
    if (data.status !== 'failed') {
      throw new DistributionError('invalid_transition', 'Job state change is not allowed.');
    }
    const used = typeof data.adminRequeues === 'number' ? data.adminRequeues : 0;
    if (used >= MAX_ADMIN_REQUEUES) {
      throw new DistributionError('retry_exhausted', 'Re-queue limit reached.');
    }
    tx.update(ref, {
      status: 'queued',
      attempts: 0,
      lastError: null,
      adminRequeues: used + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await recordAudit(db, {
    actorUid: actor.uid,
    action: 'admin_requeue',
    targetType: 'job',
    targetId: jobId,
    destination: typeof job.channel === 'string' ? job.channel : undefined,
    detail: `dead-letter job re-queued (reset ${resetsUsed + 1} of ${MAX_ADMIN_REQUEUES})`,
  });

  return { jobId, status: 'queued', changed: true, eventRecorded: true };
}

/** Recent failed jobs, safe fields only — for the admin status view. */
export async function recentFailedJobs(db: Firestore, limit = 10): Promise<Array<Record<string, unknown>>> {
  const snap = await db
    .collection(DISTRIBUTION_JOBS_COLLECTION)
    .where('status', '==', 'failed')
    .limit(Math.min(Math.max(limit, 1), 25))
    .get();
  return snap.docs.map((d) => {
    const j = (d.data() ?? {}) as { productId?: string; channel?: string; attempts?: number; lastError?: SafeJobError | null };
    return {
      jobId: d.id,
      productId: j.productId ?? null,
      channel: j.channel ?? null,
      attempts: j.attempts ?? 0,
      error: j.lastError ? { class: j.lastError.class, message: j.lastError.message, at: j.lastError.at } : null,
      retryable: canRetry({ status: 'failed', attempts: j.attempts ?? 0, lastError: j.lastError ?? null }),
    };
  });
}
