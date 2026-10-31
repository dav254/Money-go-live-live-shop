/**
 * GET/POST /api/email/cron — the bounded email retry pass.
 *
 * ## Three gates, in order (fail closed, static responses)
 *   1. `VIDNOV_CRON_ENABLED=true`   — the platform scheduler is on at all.
 *   2. `EMAIL_RETRY_CRON_ENABLED=true` — THIS pass opts in separately.
 *   3. `CRON_SECRET` set and matching (Bearer or `?secret=`), compared
 *      timing-safe by the existing `authorizeCronSchedule`.
 *
 * ## Bounded by construction
 * • Reads at most 50 pending jobs and processes at most 10 per pass.
 * • `shouldRetry` (the single pure policy) caps total attempts at
 *   `RETRY_MAX_ATTEMPTS`, retries ONLY transient classes, and never touches
 *   one-time-link templates or suppressed recipients — permanent failures
 *   are marked `dead`, never re-queued.
 * • One pass at a time per process (409 on overlap).
 * • The queue is only ever written by `sendTemplateEmail`, so a job can
 *   never exist for a message that was actually sent.
 */

import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { authorizeCronSchedule } from '@/lib/vidnov-core/distribution/cron-auth';
import { getVidnovConfig } from '@/lib/notifications/config';
import { sendTemplateEmail } from '@/lib/notifications/email-service';
import {
  RETRY_MAX_ATTEMPTS,
  nextAttemptIso,
  shouldRetry,
} from '@/lib/notifications/email-reliability';
import {
  listDueRetryJobs,
  updateRetryJob,
  type StoreDb,
} from '@/lib/notifications/email-store';
import type { EmailCategory } from '@/lib/notifications/config';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Hard cap on jobs handled in one pass. */
const MAX_PER_PASS = 10;

interface PassReport {
  scanned: number;
  retried: number;
  succeeded: number;
  dead: number;
  failed: number;
}

let inFlight: Promise<PassReport> | null = null;

function authorize(request: Request): Response | null {
  const header = (request.headers.get('Authorization') ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  const query = new URL(request.url).searchParams.get('secret') ?? '';

  const decision = authorizeCronSchedule(
    {
      enabled:
        process.env.VIDNOV_CRON_ENABLED?.trim().toLowerCase() === 'true' &&
        process.env.EMAIL_RETRY_CRON_ENABLED?.trim().toLowerCase() === 'true',
      secret: (process.env.CRON_SECRET ?? '').trim(),
    },
    header || query,
  );
  if (decision.allowed) return null;
  if (decision.status === 204) return new Response(null, { status: 204 });
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function sanitizeNote(note: string | undefined): string {
  return (note ?? '').slice(0, 300);
}

async function runPass(): Promise<PassReport> {
  const store = db as unknown as StoreDb;
  const cfg = getVidnovConfig();
  const report: PassReport = { scanned: 0, retried: 0, succeeded: 0, dead: 0, failed: 0 };

  const nowIso = new Date().toISOString();
  const jobs = await listDueRetryJobs(store, nowIso, MAX_PER_PASS);
  report.scanned = jobs.length;

  for (const job of jobs) {
    // Safety net: never exceed the global attempt cap even if a job row was
    // manipulated or an earlier update was lost.
    if (job.attempts >= RETRY_MAX_ATTEMPTS) {
      await updateRetryJob(store, job.id, {
        status: 'dead',
        lastErrorClass: job.lastErrorClass ?? 'attempts_exhausted',
        lastError: job.lastError ?? '',
        deadReason: 'attempts_exhausted',
      });
      report.dead += 1;
      continue;
    }

    const attempt = job.attempts + 1;
    const result = await sendTemplateEmail({
      templateKey: job.templateKey,
      vars: job.vars,
      category: job.category as EmailCategory,
      to: job.to,
      userId: job.userId,
      attempt,
      retryJobId: job.id,
    }).catch((error: unknown) => ({
      ok: false as const,
      status: 'FAILED' as const,
      error: error instanceof Error ? error.message : 'retry send failed',
      errorClass: 'unknown' as const,
    }));

    if (result.ok) {
      await updateRetryJob(store, job.id, {
        status: 'done',
        attempts: attempt,
        finishedAt: new Date().toISOString(),
        lastError: null,
        lastErrorClass: null,
      });
      report.succeeded += 1;
      continue;
    }

    const errorClass = result.errorClass ?? 'unknown';
    const decision = shouldRetry({
      templateKey: job.templateKey,
      attempts: attempt,
      errorClass,
      mode: cfg.emailMode,
    });

    if (decision.retry) {
      // Idempotent with the in-send scheduling: same attempt count, same
      // nextAttemptAt class of backoff — a lost update self-heals here.
      await updateRetryJob(store, job.id, {
        attempts: attempt,
        status: 'pending',
        nextAttemptAt: nextAttemptIso(Date.now(), attempt),
        lastErrorClass: errorClass,
        lastError: sanitizeNote(result.error),
      });
      report.retried += 1;
    } else {
      await updateRetryJob(store, job.id, {
        status: 'dead',
        attempts: attempt,
        lastErrorClass: errorClass,
        lastError: sanitizeNote(result.error),
        deadReason: decision.reason,
        finishedAt: new Date().toISOString(),
      });
      report.dead += 1;
    }
  }

  return report;
}

async function handle(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;

  if (inFlight) return NextResponse.json({ skipped: 'in_progress' }, { status: 409 });

  const pass: Promise<PassReport> = runPass()
    .catch(() => {
      // Static log only — no payloads, no provider bodies.
      console.error('[email] retry pass failed');
      throw new Error('retry_pass_failed');
    })
    .finally(() => {
      if (inFlight === pass) inFlight = null;
    });
  inFlight = pass;

  try {
    const report = await pass;
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: 'Retry pass could not complete.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
