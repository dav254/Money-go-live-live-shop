/**
 * GET/POST /api/growth-posts/cron — the nightly Growth Post draft run.
 *
 * ## Three gates, in order (fail closed, static responses)
 *   1. `VIDNOV_CRON_ENABLED=true`      — the platform scheduler is on at all.
 *   2. `GROWTH_POSTS_CRON_ENABLED=true`— THIS engine opts in separately: a
 *      draft run spends AI tokens, so it must never ride along on another
 *      feature's flag.
 *   3. `CRON_SECRET` set and matching (Bearer or `?secret=`), compared
 *      timing-safe by the existing `authorizeCronSchedule`.
 *
 * ## Bounded by construction
 * The service clamps the per-run limit (≤5), enforces a per-day budget
 * (≤12), skips products drafted inside the 14-day cooldown, and refuses to
 * start when `GEMINI_API_KEY` is absent. One pass at a time per process
 * (409 on overlap). The actor is `system:growth-cron`, never a fake admin.
 */

import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { authorizeCronSchedule } from '@/lib/vidnov-core/distribution/cron-auth';
import {
  GrowthPostsError,
  runGrowthDraftJob,
  type DraftRunReport,
} from '@/lib/vidnov-core/growth-posts/service';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Honest audit identity for scheduler runs. */
const CRON_ACTOR = 'system:growth-cron';

let inFlight: Promise<DraftRunReport> | null = null;

function authorize(request: Request): Response | null {
  const header = (request.headers.get('Authorization') ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  const query = new URL(request.url).searchParams.get('secret') ?? '';

  const decision = authorizeCronSchedule(
    {
      enabled:
        process.env.VIDNOV_CRON_ENABLED?.trim().toLowerCase() === 'true' &&
        process.env.GROWTH_POSTS_CRON_ENABLED?.trim().toLowerCase() === 'true',
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

  const pass: Promise<DraftRunReport> = runGrowthDraftJob({ db, actorUid: CRON_ACTOR })
    .catch(() => {
      // Static log only — no payloads, no provider bodies.
      console.error('[core/growth-posts] cron draft run failed');
      throw new Error('draft_run_failed');
    })
    .finally(() => {
      if (inFlight === pass) inFlight = null;
    });
  inFlight = pass;

  try {
    const report = await pass;
    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof GrowthPostsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    return NextResponse.json({ error: 'Draft run could not complete.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
