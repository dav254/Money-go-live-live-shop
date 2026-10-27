/**
 * DISTRIBUTION HUB — product lifecycle reconciliation (Stage 1).
 *
 * Vidnov has no Cloud Functions trigger, so product creation/update/unpublish/
 * deletion is detected by a bounded, idempotent RECONCILIATION SWEEP that an
 * admin runs from the Control Center (and that any scheduler can call later).
 * Two passes over a bounded window:
 *
 *   1. **Job pass** — every recent job whose product has gone away, became
 *      ineligible (hidden/archived/missing fields/missing image) or changed
 *      seller is STOPPED through the guarded transition service. Stopping is
 *      always possible (every state → `stopped`) and never claims anything
 *      about the remote side — it only halts OUR future pushes.
 *   2. **Product pass** — every recent eligible product gets its per-
 *      destination jobs ensured through the EXISTING `createDistributionJob`
 *      service, which is idempotent by construction (deterministic doc ids),
 *      so a second sweep creates nothing new.
 *
 * Invariants:
 *   • bounded — a sweep reads at most `productLimit` products and `jobLimit`
 *     jobs; it is a window, not an unbounded scan;
 *   • never destructive — nothing is deleted, no counters are rewritten, no
 *     historical data is erased;
 *   • never fabricates — ineligible listings are recorded with their reasons,
 *     not "fixed" by inventing fields;
 *   • out-of-date payloads (older PAYLOAD_VERSION) are stopped, not silently
 *     upgraded — a re-created job re-prepares from the current format.
 *
 * Firestore is injected, never imported.
 */

import { type Firestore } from 'firebase-admin/firestore';
import {
  DistributionError,
  applyJobTransition,
  createDistributionJob,
  type JobActor,
} from './service';
import { getJobDestinations, PAYLOAD_VERSION, type ChannelDefinition } from './channels';
import { evaluateProductEligibility, type IneligibilityReason } from './eligibility';

/** Hard ceilings for one sweep — windows, never full-collection scans. */
export const RECONCILE_BOUNDS = {
  productLimit: { min: 1, max: 200, fallback: 50 },
  jobLimit: { min: 1, max: 300, fallback: 100 },
} as const;

/** Ineligible listings listed in the report (bounded — counts stay exact). */
const MAX_REPORTED_INELIGIBLE = 25;
/** Stops reported in the report (bounded — counts stay exact). */
const MAX_REPORTED_STOPS = 25;

export interface IneligibleReport {
  productId: string;
  reasons: IneligibilityReason[];
}

export interface ReconcileReport {
  scannedProducts: number;
  scannedJobs: number;
  jobsCreated: number;
  /** Already existed (idempotent re-run) — never a duplicate document. */
  jobsAlreadyPresent: number;
  /** Jobs stopped because the product is gone, ineligible or re-owned. */
  jobsStopped: number;
  stopReasons: Record<string, number>;
  ineligibleCount: number;
  ineligible: IneligibleReport[];
  stopped: Array<{ jobId: string; productId: string; reason: string }>;
  /** Destinations that were considered for new jobs. */
  destinations: string[];
  /** Count of per-product/per-destination errors (bounded, safe messages). */
  errors: number;
}

function boundInt(value: unknown, bounds: { min: number; max: number; fallback: number }): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return bounds.fallback;
  return Math.min(bounds.max, Math.max(bounds.min, Math.floor(n)));
}

/** Why a job is being halted — a small, stable vocabulary. */
type StopReason =
  | 'product_deleted'
  | 'product_ineligible'
  | 'seller_changed'
  | 'payload_version_outdated';

export interface ReconcileParams {
  db: Firestore;
  actor: JobActor;
  productLimit?: number;
  jobLimit?: number;
}

export async function reconcileDistribution(params: ReconcileParams): Promise<ReconcileReport> {
  const { db, actor } = params;
  const productLimit = boundInt(params.productLimit, RECONCILE_BOUNDS.productLimit);
  const jobLimit = boundInt(params.jobLimit, RECONCILE_BOUNDS.jobLimit);
  const destinations = getJobDestinations();

  const report: ReconcileReport = {
    scannedProducts: 0,
    scannedJobs: 0,
    jobsCreated: 0,
    jobsAlreadyPresent: 0,
    jobsStopped: 0,
    stopReasons: {},
    ineligibleCount: 0,
    ineligible: [],
    stopped: [],
    destinations: destinations.map((d) => d.id),
    errors: 0,
  };

  /* ── Pass 1: halt jobs whose product no longer qualifies ──────────────── */

  // Plain bounded query — no index requirements, no not-equal predicates.
  const jobSnap = await db.collection('distributionJobs').limit(jobLimit).get();
  for (const doc of jobSnap.docs) {
    const job = (doc.data() ?? {}) as {
      productId?: unknown;
      sellerId?: unknown;
      channel?: unknown;
      status?: unknown;
      payloadVersion?: unknown;
    };
    report.scannedJobs += 1;
    if (job.status === 'stopped') continue; // already halted — idempotent
    if (typeof job.productId !== 'string' || !job.productId) continue;

    let reason: StopReason | null = null;

    const productSnap = await db.collection('products').doc(job.productId).get();
    if (!productSnap.exists) {
      reason = 'product_deleted';
    } else {
      const data = (productSnap.data() ?? {}) as Record<string, unknown>;
      const eligibility = evaluateProductEligibility(job.productId, data);
      if (!eligibility.eligible) reason = 'product_ineligible';
      else if (typeof job.sellerId === 'string' && job.sellerId !== data.sellerId)
        reason = 'seller_changed';
      else if (
        typeof job.payloadVersion === 'string' &&
        job.payloadVersion !== PAYLOAD_VERSION
      ) {
        reason = 'payload_version_outdated';
      }
    }

    if (!reason) continue;

    try {
      // The SAME guarded transition every other caller uses: policy-checked,
      // transactional, ownership satisfied because the actor is an admin.
      const result = await applyJobTransition({
        db,
        jobId: doc.id,
        to: 'stopped',
        actor: { uid: actor.uid, isAdmin: true },
      });
      if (result.changed) {
        report.jobsStopped += 1;
        report.stopReasons[reason] = (report.stopReasons[reason] ?? 0) + 1;
        if (report.stopped.length < MAX_REPORTED_STOPS) {
          report.stopped.push({ jobId: doc.id, productId: job.productId, reason });
        }
      }
    } catch (err) {
      // A job with a corrupt channel value (or an already-changed state) is
      // counted, never thrown — one bad document must not abort the sweep.
      if (!(err instanceof DistributionError)) report.errors += 1;
    }
  }

  /* ── Pass 2: ensure jobs for every recent eligible product ─────────────── */

  // Same query shape the public sitemap route uses (single-field orderBy).
  const productSnap = await db
    .collection('products')
    .orderBy('uploadDate', 'desc')
    .limit(productLimit)
    .get();

  for (const doc of productSnap.docs) {
    report.scannedProducts += 1;
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    const eligibility = evaluateProductEligibility(doc.id, data);
    if (!eligibility.eligible) {
      report.ineligibleCount += 1;
      if (report.ineligible.length < MAX_REPORTED_INELIGIBLE) {
        report.ineligible.push({ productId: doc.id, reasons: eligibility.reasons });
      }
      continue;
    }

    for (const dest of destinations) {
      const ensured = await ensureJob(db, dest, doc.id, actor);
      if (ensured === 'created') report.jobsCreated += 1;
      else if (ensured === 'duplicate') report.jobsAlreadyPresent += 1;
      else report.errors += 1;
    }
  }

  return report;
}

/**
 * Idempotent per-(product, destination) job creation built on the EXISTING
 * service: same deterministic document id every time, `duplicate` on re-run,
 * ownership and required-field validation already enforced there.
 */
async function ensureJob(
  db: Firestore,
  dest: ChannelDefinition,
  productId: string,
  actor: JobActor,
): Promise<'created' | 'duplicate' | 'error'> {
  try {
    const result = await createDistributionJob({
      db,
      productId,
      channel: dest.id,
      actorUid: actor.uid,
      isAdmin: actor.isAdmin,
    });
    return result.duplicate ? 'duplicate' : 'created';
  } catch (err) {
    // DistributionErrors are expected outcomes (bad listing, forbidden);
    // they are counted as bounded per-item errors so one bad product never
    // aborts the sweep. Unexpected errors count too — never logged raw.
    void err;
    return 'error';
  }
}
