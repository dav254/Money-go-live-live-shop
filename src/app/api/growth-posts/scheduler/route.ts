/**
 * GET/POST /api/growth-posts/scheduler — the in-house Postiz clock: spends
 * the schedules that `/api/admin/growth-posts` armed.
 *
 * ## Why a separate route from the draft cron
 * The draft run SPENDS AI tokens; this tick SPENDS outbound posts. They are
 * different budgets with different failure modes, so each opt-in flag must
 * never ride along on the other's — the same rule the distribution cron
 * documents.
 *
 * ## Three gates, in order (fail closed, static responses)
 *   1. `VIDNOV_CRON_ENABLED=true`          — the platform scheduler is on.
 *   2. `GROWTH_POSTS_SCHEDULER_ENABLED=true` — THIS tick opts in separately.
 *   3. `CRON_SECRET` set and matching (Bearer or `?secret=`), compared
 *      timing-safe by the existing `authorizeCronSchedule`.
 *
 * ## Bounded by construction
 * The service clamps one pass to `schedulerPerRun` posts (≤5) × ≤4 social
 * channels, each provider call carrying its own timeout. A post is only
 * touched when its `scheduledAt` has actually passed, and `published` is
 * only ever written together with the platform's own message id (inside
 * `publishGrowthPost`) — this route itself never sets a status.
 *
 * The response is the sanitized COUNTER report only: no per-post rows, no
 * captions, no credentials, no upstream bodies. Overlapping hits are
 * rejected with 409 instead of double-publishing (per Node process; the
 * service's caps remain the real defence across instances).
 */

import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { authorizeCronSchedule } from '@/lib/vidnov-core/distribution/cron-auth';
import { runDueGrowthPosts } from '@/lib/vidnov-core/growth-posts/service';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Honest audit identity for scheduler runs — never a fake admin uid. */
const CRON_ACTOR = 'system:growth-scheduler';

/** In-process overlap guard: one tick at a time per instance. */
let inFlight: Promise<Awaited<ReturnType<typeof runDueGrowthPosts>>> | null = null;

function authorize(request: Request): Response | null {
  const header = (request.headers.get('Authorization') ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  const query = new URL(request.url).searchParams.get('secret') ?? '';

  const decision = authorizeCronSchedule(
    {
      enabled:
        process.env.VIDNOV_CRON_ENABLED?.trim().toLowerCase() === 'true' &&
        process.env.GROWTH_POSTS_SCHEDULER_ENABLED?.trim().toLowerCase() === 'true',
      secret: (process.env.CRON_SECRET ?? '').trim(),
    },
    header || query,
  );
  if (decision.allowed) return null;
  if (decision.status === 204) return new Response(null, { status: 204 });
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

async function handle(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;

  if (inFlight) return NextResponse.json({ skipped: 'in_progress' }, { status: 409 });

  const pass: ReturnType<typeof runDueGrowthPosts> = runDueGrowthPosts(db, { actorUid: CRON_ACTOR })
    .catch(() => {
      // Static log only — no payloads, no error objects, no credentials.
      console.error('[core/growth-posts] scheduler tick failed');
      throw new Error('scheduler_tick_failed');
    })
    .finally(() => {
      if (inFlight === pass) inFlight = null;
    });
  inFlight = pass;

  try {
    const report = await pass;
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: 'The scheduled publish pass could not complete.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
