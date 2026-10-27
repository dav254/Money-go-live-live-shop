/**
 * GET/POST /api/distribution/cron — the scheduler entry point for the
 * distribution engine.
 *
 * ## Why this route exists
 *
 * The engine and the reconciliation sweep were complete but MANUAL: the only
 * callers were admin buttons in the Distribution Control Center. Nothing
 * therefore ever ran on its own — a product created at 02:00 stayed
 * un-queued, a listing unpublished at 03:00 kept its job in the submit queue,
 * and a Search Console ping happened whenever someone happened to click.
 * This route is the missing clock: the same two bounded passes, on a schedule.
 *
 * It deliberately re-uses BOTH existing server-side services unchanged —
 * `reconcileDistribution` (idempotent: creates missing jobs, stops jobs whose
 * product is gone/ineligible/re-owned/outdated) and `runDistributionEngine`
 * (honours the global pause first, quota-checked, budgeted). No new queue, no
 * new dependency, no second source of truth.
 *
 * ## Authorization — fail closed, three gates in order
 *
 *   1. `VIDNOV_CRON_ENABLED=true`   — the endpoint is off unless explicitly
 *      turned on (unlike the legacy `/api/media/cleanup-cron`, which is on
 *      unless disabled; a new entry point should not start enabled).
 *   2. `CRON_SECRET` must be SET — an enabled endpoint with no secret is an
 *      unauthenticated trigger for outbound API spend, so it refuses rather
 *      than runs.
 *   3. The presented secret (Authorization: Bearer …, or the legacy
 *      `?secret=` shape the existing scheduler already uses) must match,
 *      compared timing-safe over SHA-256 digests.
 *
 * Gate failures return 204 (disabled) or 403 (misconfigured / wrong secret)
 * with a static body — nothing about the configuration leaks, and no work
 * happens before all three gates pass.
 *
 * ## Honesty and cost rules
 *
 *   • The actor is `system:cron`, not a fake admin uid: the audit trail says
 *     exactly who ran the pass.
 *   • The engine's own global pause is honoured (a paused engine touches
 *     nothing and records why).
 *   • The response is the sanitized counter report only — the per-job rows,
 *     payloads, credentials and upstream bodies are stripped before anything
 *     leaves the process, and logs stay static strings.
 *   • One pass at a time: overlapping scheduler hits are rejected with 409
 *     instead of double-spending the per-run quota. (This guard is per Node
 *     process; budget caps in the engine remain the real defence across
 *     instances.)
 */

import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { authorizeCronSchedule } from '@/lib/vidnov-core/distribution/cron-auth';
import { reconcileDistribution } from '@/lib/vidnov-core/distribution/reconcile';
import { runDistributionEngine, type DestinationRunStats } from '@/lib/vidnov-core/distribution/engine';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Audit identity for scheduler runs — honest, not an invented admin. */
const CRON_ACTOR = 'system:cron';

/** In-process overlap guard: one pass at a time per instance. */
let inFlight: Promise<CronReport> | null = null;

interface CronReport {
  ranAt: string;
  reconcile: {
    scannedProducts: number;
    jobsCreated: number;
    jobsAlreadyPresent: number;
    jobsStopped: number;
    ineligibleCount: number;
    errors: number;
    destinations: string[];
  };
  engine: {
    paused: boolean;
    startedAt: string;
    finishedAt: string;
    processed: number;
    budget: number;
    sitemapPing: string;
    auditRecorded: boolean;
    eventsMissed: number;
    byDestination: Record<string, DestinationRunStats>;
  };
}

/**
 * The gate, in order. Returns the response to send when the request must NOT
 * run anything; `null` means "authorized to proceed". The decision logic
 * itself lives in `cron-auth.ts` so it can be tested directly.
 */
function authorize(request: Request): Response | null {
  const header = (request.headers.get('Authorization') ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  const query = new URL(request.url).searchParams.get('secret') ?? '';

  const decision = authorizeCronSchedule(
    {
      enabled: process.env.VIDNOV_CRON_ENABLED?.trim().toLowerCase() === 'true',
      secret: (process.env.CRON_SECRET ?? '').trim(),
    },
    header || query,
  );
  if (decision.allowed) return null;
  if (decision.status === 204) return new Response(null, { status: 204 });
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/** Both bounded passes, in the order that keeps the queues truthful. */
async function runPass(): Promise<CronReport> {
  const actor = { uid: CRON_ACTOR, isAdmin: true };

  // 1) Reconcile first: halt jobs for products that vanished or became
  //    ineligible, then create the missing per-destination jobs. Defaults are
  //    bounded (≤50 products / ≤100 jobs, hard caps 200/300).
  const rec = await reconcileDistribution({ db, actor });

  // 2) Then one engine pass: pause check → daily sitemap ping → submit →
  //    verify. Budgeted and quota-checked inside the engine itself.
  const eng = await runDistributionEngine({ db, actorUid: CRON_ACTOR });

  return {
    ranAt: new Date().toISOString(),
    reconcile: {
      scannedProducts: rec.scannedProducts,
      jobsCreated: rec.jobsCreated,
      jobsAlreadyPresent: rec.jobsAlreadyPresent,
      jobsStopped: rec.jobsStopped,
      ineligibleCount: rec.ineligibleCount,
      errors: rec.errors,
      destinations: rec.destinations,
    },
    engine: {
      paused: eng.paused,
      startedAt: eng.startedAt,
      finishedAt: eng.finishedAt,
      processed: eng.processed,
      budget: eng.budget,
      sitemapPing: eng.sitemapPing,
      auditRecorded: eng.auditRecorded,
      eventsMissed: eng.eventsMissed,
      byDestination: eng.byDestination as CronReport['engine']['byDestination'],
    },
    // NOTE: `eng.jobs` (per-job rows) and `rec.ineligible` (listing samples)
    // are deliberately dropped — the scheduler gets counters, the admin UI
    // gets detail (admin-only, authenticated).
  };
}

async function handle(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;

  if (inFlight) {
    return NextResponse.json({ skipped: 'in_progress' }, { status: 409 });
  }

  const pass: Promise<CronReport> = runPass()
    .catch((error) => {
      // Static log only — no error objects, no payloads, no credentials.
      console.error('[core/distribution] cron pass failed');
      throw error;
    })
    .finally(() => {
      if (inFlight === pass) inFlight = null;
    });
  inFlight = pass;

  try {
    const report = await pass;
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: 'Distribution pass could not complete.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
