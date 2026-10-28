/**
 * DISTRIBUTION HUB — the engine run (Stages 3 & 4).
 *
 * One admin-triggered pass does real work, in order:
 *
 *   0. **Global pause** — if the config says paused, NOTHING runs (no quota
 *      is claimed, no job moves). Fail-closed, reported honestly.
 *   1. **Platform ping** — at most once per day, the public sitemap is
 *      submitted to Search Console when that connection is authorized.
 *   2. **Submit phase** — for each destination that can submit: take its
 *      `queued` jobs (bounded), claim quota BEFORE each call, run the
 *      adapter, persist the outcome. A 2xx records `accepted` — never
 *      `published`/`indexed` (enforced by the adapter wrapper too).
 *   3. **Verify phase** — for each destination that can verify: take its
 *      `submitted` jobs and read a REAL status source. Only this phase may
 *      set `published`/`indexed`, and only from that source. Confirmation
 *      promotes the job to its terminal success state; persistent ambiguity
 *      escalates to `needs_attention` after the attempt cap.
 *   4. **Persistence** — every attempt appends a sanitized submission record
 *      (status code + bounded message + remote id — never a response body)
 *      and updates the per-destination confirmation atomically with the job
 *      state, so a crash can never leave a job claiming more than it proved.
 *
 * Bounds: global `maxPerRun` budget, per-destination per-day quota, shared
 * `MAX_JOB_ATTEMPTS` for hard failures, `verifyAttempts` cap for soft
 * ambiguity. Rate-limited quota misses burn NO attempt.
 *
 * Firestore injected; the network only ever goes through the injected fetch.
 */

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
// VPS mirror of the job store (no-op when PocketBase is not configured) —
// keeps the admin consoles answering from this machine during a Firestore
// outage. See src/lib/pocketbase/distribution-jobs.ts.
import { syncDistributionJob } from '@/lib/pocketbase/distribution-jobs';
import type { ChannelId, ConfirmationState, JobStatus, SafeJobError } from '../types';
import {
  MAX_JOB_ATTEMPTS,
  VERIFIED_CONFIRMATION_STATES,
  canTransition,
  type SubmissionRecord,
  type JobConfirmation,
  MAX_SUBMISSION_LOG,
} from '../types';
import { getJobDestinations } from './channels';
import { readGa4Traffic, runDestinationAction, submitSitemapToSearchConsole, type FetchLike } from './adapters';
import {
  markEngineRun,
  markSitemapSubmitted,
  readDistributionConfig,
  reserveQuota,
  type DistributionConfig,
} from './config';
import { recordAudit } from './audit';
import { safeJobError, sanitizeErrorMessage } from './job-utils';
import { DistributionError } from './service';
import { recordCoreEvent } from '../events/recorder';
import { SITEMAP_ORIGIN } from '@/lib/sitemap-entries';

/** Window per destination per phase — bounded queries, not full scans. */
const PHASE_WINDOW = 40;

export interface DestinationRunStats {
  destination: string;
  processed: number;
  accepted: number;
  confirmed: number;
  unknown: number;
  failed: number;
  rateLimited: number;
  skippedNotConfigured: number;
  skippedBudget: number;
}

export interface EngineJobResult {
  jobId: string;
  productId: string | null;
  destination: string;
  phase: 'submit' | 'verify';
  outcome: 'accepted' | 'confirmed' | 'unknown' | 'failed' | 'rate_limited' | 'skipped';
}

export interface EngineRunReport {
  paused: boolean;
  startedAt: string;
  finishedAt: string;
  /** Jobs that consumed budget in this run. */
  processed: number;
  budget: number;
  byDestination: Record<string, DestinationRunStats>;
  /** Bounded per-job detail for the admin view (≤50 rows). */
  jobs: EngineJobResult[];
  sitemapPing: 'submitted' | 'already_done' | 'not_configured' | 'failed' | 'skipped_paused';
  /** False when an audit entry could not be written (run still happened). */
  auditRecorded: boolean;
  /** False when a job outcome event could not be written (state still changed). */
  eventsMissed: number;
}

function emptyStats(destination: string): DestinationRunStats {
  return {
    destination,
    processed: 0,
    accepted: 0,
    confirmed: 0,
    unknown: 0,
    failed: 0,
    rateLimited: 0,
    skippedNotConfigured: 0,
    skippedBudget: 0,
  };
}

export interface EngineRunParams {
  db: Firestore;
  actorUid: string;
  fetchImpl?: FetchLike;
}

/** Job fields this module reads — nothing else is trusted. */
type EngineJob = {
  productId?: unknown;
  channel?: unknown;
  status?: JobStatus;
  attempts?: number;
  verifyAttempts?: number;
  confirmation?: JobConfirmation;
  submissions?: SubmissionRecord[];
  payload?: { destinationUrl?: unknown };
  payloadVersion?: unknown;
};

export async function runDistributionEngine(
  params: EngineRunParams,
): Promise<EngineRunReport> {
  const { db, actorUid } = params;
  const fetchImpl: FetchLike =
    params.fetchImpl ?? ((url, init) => globalThis.fetch(url, init as RequestInit));
  const startedAt = new Date().toISOString();

  const report: EngineRunReport = {
    paused: false,
    startedAt,
    finishedAt: startedAt,
    processed: 0,
    budget: 0,
    byDestination: {},
    jobs: [],
    sitemapPing: 'skipped_paused',
    auditRecorded: true,
    eventsMissed: 0,
  };

  const config = await readDistributionConfig(db);
  if (config.paused) {
    report.finishedAt = new Date().toISOString();
    report.auditRecorded = await recordAudit(db, {
      actorUid,
      action: 'engine_run',
      targetType: 'run',
      detail: 'run skipped: distribution is paused',
    });
    return { ...report, paused: true };
  }

  report.budget = config.maxPerRun;
  report.sitemapPing = await maybePingSitemap(db, config, fetchImpl, actorUid, report);

  // One action per job per run: a job acted on in the submit phase is NOT
  // re-verified in the same pass (no double API charge, no double quota, and
  // the next pass re-reads the freshest remote state anyway).
  const actedOnThisRun = new Set<string>();

  /* ── Phase 1: submit queued jobs per destination ─────────────────────── */

  for (const dest of getJobDestinations()) {
    const stats = emptyStats(dest.id);
    report.byDestination[dest.id] = stats;

    if (dest.capabilities.submit) {
      await phaseOverQueued(db, dest.id, 'submit', config, fetchImpl, actorUid, report, stats, actedOnThisRun);
    } else if (dest.capabilities.verify) {
      // Verify-only destinations (Search Console) "engage" queued jobs by
      // inspecting them — their inspect result is a VERIFIED status read.
      await phaseOverQueued(db, dest.id, 'inspect', config, fetchImpl, actorUid, report, stats, actedOnThisRun);
    } else {
      stats.skippedNotConfigured += 1; // prepare-only feed: nothing to push
    }
  }

  /* ── Phase 2: verify submitted jobs per destination ──────────────────── */

  for (const dest of getJobDestinations()) {
    if (!dest.capabilities.verify) continue;
    const stats = report.byDestination[dest.id] ?? emptyStats(dest.id);
    report.byDestination[dest.id] = stats;
    await phaseOverSubmitted(db, dest.id, config, fetchImpl, actorUid, report, stats, actedOnThisRun);
  }

  await markEngineRun(db);
  report.finishedAt = new Date().toISOString();
  report.auditRecorded = await recordAudit(db, {
    actorUid,
    action: 'engine_run',
    targetType: 'run',
    detail: `processed=${report.processed} budget=${report.budget} eventsMissed=${report.eventsMissed}`,
  });
  return report;
}

/* ── Platform-level: daily sitemap ping to Search Console ───────────────── */

async function maybePingSitemap(
  db: Firestore,
  config: DistributionConfig,
  fetchImpl: FetchLike,
  actorUid: string,
  report: EngineRunReport,
): Promise<EngineRunReport['sitemapPing']> {
  const SC = getJobDestinations().find((d) => d.id === 'search_console');
  if (!SC || !SC.canSubmit()) return 'not_configured';

  const last = config.sitemapSubmittedAt ? Date.parse(config.sitemapSubmittedAt) : 0;
  const dayMs = 24 * 60 * 60 * 1000;
  if (Number.isFinite(last) && Date.now() - last < dayMs) return 'already_done';

  const result = await submitSitemapToSearchConsole(fetchImpl);
  if (result.outcome !== 'accepted') {
    report.byDestination.search_console =
      report.byDestination.search_console ?? emptyStats('search_console');
    return 'failed';
  }
  await markSitemapSubmitted(db);
  await recordAudit(db, {
    actorUid,
    action: 'sitemap_submitted',
    targetType: 'destination',
    destination: 'search_console',
    detail: `sitemap submitted (${result.responseStatus ?? 200})`,
  });
  return 'submitted';
}

/* ── Phase helpers ──────────────────────────────────────────────────────── */

async function fetchPhaseJobs(
  db: Firestore,
  destination: ChannelId,
  status: 'queued' | 'submitted',
  limit: number,
): Promise<Array<{ id: string; data: EngineJob }>> {
  const snap = await db
    .collection('distributionJobs')
    .where('status', '==', status)
    .where('channel', '==', destination)
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, data: (d.data() ?? {}) as EngineJob }));
}

async function phaseOverQueued(
  db: Firestore,
  destination: ChannelId,
  action: 'submit' | 'inspect',
  config: DistributionConfig,
  fetchImpl: FetchLike,
  actorUid: string,
  report: EngineRunReport,
  stats: DestinationRunStats,
  actedOnThisRun: Set<string>,
): Promise<void> {
  const dest = getChannelSafe(destination);
  if (!dest) return;
  if (!dest.canSubmit()) {
    stats.skippedNotConfigured += 1;
    return;
  }

  let jobs: Array<{ id: string; data: EngineJob }> = [];
  try {
    jobs = await fetchPhaseJobs(db, destination, 'queued', PHASE_WINDOW);
  } catch {
    return; // bounded degradation: this destination is skipped this run
  }

  for (const job of jobs) {
    if (report.processed >= report.budget) {
      stats.skippedBudget += 1;
      continue;
    }
    const quotaOk = await reserveQuota(db, destination, dest.quotas.perDay, config.maxPerDay);
    if (!quotaOk) {
      stats.rateLimited += 1;
      continue; // no attempt burned — tomorrow's budget (or a bigger limit) decides
    }

    // queued → processing: the guarded state machine re-validates under a
    // transaction; a concurrent run that got there first is a no-op skip.
    try {
      await transition(db, job.id, 'processing');
    } catch {
      continue;
    }

    report.processed += 1;
    stats.processed += 1;
    actedOnThisRun.add(job.id);
    const productId = typeof job.data.productId === 'string' ? job.data.productId : null;
    const absoluteUrl =
      typeof job.data.payload?.destinationUrl === 'string'
        ? job.data.payload.destinationUrl
        : '';
    // destinationUrl is a same-site path built server-side; make it absolute
    // for the remote APIs using the canonical origin.
    const publicPath = absoluteUrl.startsWith('/') ? absoluteUrl.split('?')[0] : '';
    // Remote APIs get the CANONICAL URL (tracking params stripped — a ping
    // must point at the clean URL search engines should index; attribution
    // params belong to human-facing links, not API submissions).
    const remoteUrl = absoluteUrl.startsWith('http')
      ? absoluteUrl.split('?')[0]
      : publicPath
        ? `${new URL(SITEMAP_ORIGIN).origin}${publicPath}`
        : '';

    const result = await runDestinationAction(destination, action, {
      absoluteUrl: remoteUrl,
      publicPath,
      fetchImpl,
    });

    const recorded = await applySubmissionOutcome(db, job.id, {
      job: job.data,
      phase: action,
      result,
      actorUid,
      destination,
    });
    if (!recorded.eventRecorded) report.eventsMissed += 1;

    accumulate(report, stats, job.id, productId, 'submit', recorded.outcome);
  }
}

async function phaseOverSubmitted(
  db: Firestore,
  destination: ChannelId,
  config: DistributionConfig,
  fetchImpl: FetchLike,
  actorUid: string,
  report: EngineRunReport,
  stats: DestinationRunStats,
  actedOnThisRun: Set<string>,
): Promise<void> {
  const dest = getChannelSafe(destination);
  if (!dest || !dest.canSubmit() || !dest.capabilities.verify) return;

  let jobs: Array<{ id: string; data: EngineJob }> = [];
  try {
    jobs = await fetchPhaseJobs(db, destination, 'submitted', PHASE_WINDOW);
  } catch {
    return;
  }

  for (const job of jobs) {
    if (actedOnThisRun.has(job.id)) continue; // one action per job per run
    if (report.processed >= report.budget) {
      stats.skippedBudget += 1;
      continue;
    }
    const quotaOk = await reserveQuota(db, destination, dest.quotas.perDay, config.maxPerDay);
    if (!quotaOk) {
      stats.rateLimited += 1;
      continue;
    }

    const productId = typeof job.data.productId === 'string' ? job.data.productId : null;
    const absoluteUrl =
      typeof job.data.payload?.destinationUrl === 'string' ? job.data.payload.destinationUrl : '';
    const publicPath = absoluteUrl.startsWith('/') ? absoluteUrl.split('?')[0] : '';
    // Remote APIs get the CANONICAL URL (tracking params stripped — a ping
    // must point at the clean URL search engines should index; attribution
    // params belong to human-facing links, not API submissions).
    const remoteUrl = absoluteUrl.startsWith('http')
      ? absoluteUrl.split('?')[0]
      : publicPath
        ? `${new URL(SITEMAP_ORIGIN).origin}${publicPath}`
        : '';

    report.processed += 1;
    stats.processed += 1;
    actedOnThisRun.add(job.id);

    const result = await runDestinationAction(destination, 'verify', {
      absoluteUrl: remoteUrl,
      publicPath,
      fetchImpl,
    });

    const recorded = await applySubmissionOutcome(db, job.id, {
      job: job.data,
      phase: 'verify',
      result,
      actorUid,
      destination,
    });
    if (!recorded.eventRecorded) report.eventsMissed += 1;
    accumulate(report, stats, job.id, productId, 'verify', recorded.outcome);
  }
}

function getChannelSafe(id: ChannelId) {
  try {
    const dest = getJobDestinations().find((d) => d.id === id);
    return dest ?? null;
  } catch {
    return null;
  }
}

function accumulate(
  report: EngineRunReport,
  stats: DestinationRunStats,
  jobId: string,
  productId: string | null,
  phase: 'submit' | 'verify',
  outcome: EngineJobResult['outcome'],
): void {
  if (outcome === 'accepted' || outcome === 'confirmed') stats.accepted += 1;
  else if (outcome === 'unknown') stats.unknown += 1;
  else if (outcome === 'failed') stats.failed += 1;
  else if (outcome === 'rate_limited') stats.rateLimited += 1;
  if (outcome === 'confirmed') stats.confirmed += 1;
  if (report.jobs.length < 50) {
    report.jobs.push({ jobId, productId, destination: stats.destination, phase, outcome });
  }
}

/* ── State transition + persistence ─────────────────────────────────────── */

/** Direct adapter-path transition (the engine IS the connected integration). */
async function transition(db: Firestore, jobId: string, to: JobStatus): Promise<void> {
  const ref = db.collection('distributionJobs').doc(jobId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new DistributionError('not_found', 'Job not found.');
    const from = ((snap.data() ?? {}) as EngineJob).status ?? 'ready';
    if (from === to) return;
    if (!canTransition(from, to)) {
      throw new DistributionError('invalid_transition', 'Job state change is not allowed.');
    }
    const attempts = (snap.data() as EngineJob).attempts ?? 0;
    tx.update(ref, {
      status: to,
      updatedAt: FieldValue.serverTimestamp(),
      ...(to === 'submitted' ? { lastSubmittedAt: FieldValue.serverTimestamp() } : {}),
      ...(to === 'live' ? { lastLiveAt: FieldValue.serverTimestamp() } : {}),
      ...(to === 'failed'
        ? { attempts: attempts + 1, lastError: safeJobError('submission failed', attempts + 1) }
        : {}),
    });
  });
  // Keep the VPS mirror in step — best-effort, never fails the transition.
  void syncDistributionJob(db, jobId);
}

export interface ApplyOutcomeParams {
  job: EngineJob;
  phase: 'submit' | 'inspect' | 'verify';
  result: Awaited<ReturnType<typeof runDestinationAction>>;
  actorUid: string;
  destination: ChannelId;
}

export interface ApplyOutcomeResult {
  outcome: EngineJobResult['outcome'];
  status: JobStatus;
  confirmation: ConfirmationState;
  eventRecorded: boolean;
}

/**
 * Persists one attempt: submission record + confirmation + status move in a
 * SINGLE transaction, then best-effort outcome event. The mapping is the
 * honesty contract of Stage 3:
 *
 *   accepted            → confirmation `accepted` (or a VERIFIED state from
 *                         verify/inspect), status → `submitted`;
 *   confirmed verified  → additionally status → `live` (via the state machine);
 *   unknown             → confirmation `unknown`, status → `submitted`
 *                         (nothing claimed either way);
 *   rejected            → status → `failed` with the classified safe error;
 *   error (transport)   → status → `failed` (retryable class) when the remote
 *                         never answered; `unknown` confirmation when it did
 *                         (the request may have partially landed).
 */
export async function applySubmissionOutcome(
  db: Firestore,
  jobId: string,
  params: ApplyOutcomeParams,
): Promise<ApplyOutcomeResult> {
  const { job, phase, result, destination } = params;
  const dest = getChannelSafe(destination);
  const confirmable = dest?.capabilities.confirmable ?? [];
  const nowIso = new Date().toISOString();

  const verified =
    result.confirmed &&
    VERIFIED_CONFIRMATION_STATES.includes(result.confirmed) &&
    confirmable.includes(result.confirmed)
      ? result.confirmed
      : null;

  // Decide the confirmation for this attempt.
  //   verified state → only from verify/inspect reading a status source;
  //   explicit `unknown` from an adapter (e.g. a definite NOT_INDEXED
  //     verdict) → `unknown`, overriding the raw HTTP outcome;
  //   accepted → `accepted` (a 2xx, nothing more);
  //   unknown  → `unknown`;
  //   rejected → `failed`;
  //   error    → `unknown` — the transport died and we refuse to guess.
  let confirmationState: ConfirmationState;
  if (verified) confirmationState = verified;
  else if (result.confirmed === 'unknown') confirmationState = 'unknown';
  else if (result.outcome === 'accepted') confirmationState = 'accepted';
  else if (result.outcome === 'unknown') confirmationState = 'unknown';
  else if (result.outcome === 'rejected') confirmationState = 'failed';
  else confirmationState = 'unknown';
  // A verify/inspect-phase TRANSPORT failure learned nothing — keep the
  // previous confirmation rather than downgrading it with our own network's
  // problem. (Submit-phase attempts record `unknown`: the request may have
  // left before the connection died.)
  const keepPrevious =
    result.outcome === 'error' && phase !== 'submit' && Boolean(job.confirmation);

  const submission: SubmissionRecord = {
    at: nowIso,
    attempt: (job.attempts ?? 0) + (phase === 'verify' ? (job.verifyAttempts ?? 0) : 0) + 1,
    outcome:
      result.outcome === 'accepted'
        ? 'accepted'
        : result.outcome === 'rejected'
          ? 'rejected'
          : result.outcome === 'unknown'
            ? 'unknown'
            : 'error',
    ...(result.responseStatus !== undefined ? { responseStatus: result.responseStatus } : {}),
    ...(result.remoteId ? { remoteId: String(result.remoteId).slice(0, 200) } : {}),
    ...(result.errorClass ? { errorClass: result.errorClass } : {}),
    ...(result.message ? { message: sanitizeErrorMessage(result.message) } : {}),
  };

  const toFail = result.outcome === 'rejected' || result.outcome === 'error';
  const toSubmitted = !toFail; // accepted / unknown both land in `submitted`
  const verifyPhase = phase === 'verify' || phase === 'inspect';
  const escalateVerify =
    verifyPhase &&
    !toFail &&
    !verified &&
    (job.verifyAttempts ?? 0) + 1 >= MAX_JOB_ATTEMPTS;

  const ref = db.collection('distributionJobs').doc(jobId);
  let eventRecorded = true;

  const finalState = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new DistributionError('not_found', 'Job not found.');
    const current = (snap.data() ?? {}) as EngineJob;
    const from = current.status ?? 'ready';

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      submissions: [submission, ...(current.submissions ?? [])].slice(0, MAX_SUBMISSION_LOG),
    };

    // Confirmation — only ever set from the decided state, never raw input.
    if (!keepPrevious) {
      const previous = current.confirmation;
      updates.confirmation = {
        state: confirmationState,
        at: nowIso,
        remoteId: result.remoteId ? String(result.remoteId).slice(0, 200) : previous?.remoteId ?? null,
        verifiedAt: verified ? nowIso : previous?.verifiedAt ?? null,
        message: result.message
          ? sanitizeErrorMessage(result.message)
          : verified
            ? 'Verified against the destination status source.'
            : previous?.message ?? null,
      } satisfies JobConfirmation;
    }

    if (verifyPhase) {
      updates.verifyAttempts = (current.verifyAttempts ?? 0) + 1;
    }

    let next: JobStatus = from;
    if (toFail) {
      const attempts = (current.attempts ?? 0) + 1;
      if (attempts > MAX_JOB_ATTEMPTS) {
        // Attempt cap reached: park for a human instead of hammering.
        if (!canTransition(from, 'needs_attention')) {
          throw new DistributionError('retry_exhausted', 'Retry limit reached.');
        }
        next = 'needs_attention';
        updates.status = next;
        updates.lastError = safeJobError(result.message ?? 'submission failed', attempts);
      } else {
        next = 'failed';
        updates.status = next;
        updates.attempts = attempts;
        const err: SafeJobError = {
          class: result.errorClass ?? 'unknown',
          message: sanitizeErrorMessage(result.message ?? 'submission failed'),
          attempt: attempts,
          at: nowIso,
        };
        updates.lastError = err;
      }
    } else if (escalateVerify && canTransition(from, 'needs_attention')) {
      // Persistent ambiguity (bounded): a human must look at this job.
      next = 'needs_attention';
      updates.status = next;
    } else if (toSubmitted && canTransition(from, 'submitted')) {
      next = 'submitted';
      updates.status = next;
      updates.lastSubmittedAt = FieldValue.serverTimestamp();
      if (verified) {
        // Verified now: promote through the state machine in the SAME tx —
        // processing → submitted → live, both guarded steps, one commit.
        if (canTransition('submitted', 'live')) {
          next = 'live';
          updates.status = next;
          updates.lastLiveAt = FieldValue.serverTimestamp();
        }
      }
    } else {
      // Job was stopped/moved by an admin mid-run — do not fight it; the
      // submission record still lands, the status stays as-is.
      updates.status = from;
      next = from;
    }

    tx.update(ref, updates);
    return next;
  });

  // Keep the VPS mirror in step — best-effort, never fails the attempt.
  void syncDistributionJob(db, jobId);

  // Outcome event — idempotent key (same scheme as the service), best-effort.
  if (finalState === 'failed' || finalState === 'submitted' || finalState === 'live') {
    try {
      const type =
        finalState === 'failed' ? 'distribution_job_failed' : 'distribution_job_succeeded';
      const attemptsNow =
        (job.attempts ?? 0) + (finalState === 'failed' ? 1 : 0);
      await recordCoreEvent(db, {
        type,
        entityKind: 'distribution_job',
        entityId: jobId,
        origin: 'server',
        dedupeKey: `dj:${jobId}:${finalState}:${attemptsNow}`,
      });
    } catch {
      eventRecorded = false;
    }
  }

  const outcome: EngineJobResult['outcome'] = toFail
    ? 'failed'
    : verified
      ? 'confirmed'
      : result.outcome === 'unknown'
        ? 'unknown'
        : 'accepted';

  return { outcome, status: finalState, confirmation: confirmationState, eventRecorded };
}

/* ── GA4 connection read (analytics section helper) ─────────────────────── */

/** Reads GA4 sessions when the connection is configured; never invents data. */
export async function readConnectedAnalytics(fetchImpl?: FetchLike): Promise<Awaited<ReturnType<typeof readGa4Traffic>>> {
  return readGa4Traffic(fetchImpl ?? ((url, init) => globalThis.fetch(url, init as RequestInit)));
}
