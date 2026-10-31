/**
 * GET|POST /api/requests/cron — buyer-request expiry sweep.
 *
 * The one scheduled job the request marketplace needs (spec §7): backfill
 * `expiresAt` on older briefs and send the 48-hour expiry notice exactly once
 * per renewal cycle. It writes nothing else — expired briefs are DERIVED at
 * read time by `isExpired()`, so this job can never flip a status on its own.
 *
 * Gate (fail-closed, the same helper `/api/email/cron` uses):
 *   1. `VIDNOV_CRON_ENABLED === 'true'`  → off ⇒ silent 204
 *   2. `REQUESTS_CRON_ENABLED === 'true'` → off ⇒ silent 204
 *   3. `CRON_SECRET` present and matching (timing-safe) → 403 otherwise.
 * No reason string ever reaches the caller, so a probe cannot tell
 * "disabled" from "misconfigured" from "wrong secret".
 *
 * Overlap protection: one pass per 10 minutes per instance — a scheduler that
 * fires early gets 409 instead of a second fan-out of notices.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { authorizeCronSchedule } from '@/lib/vidnov-core/distribution/cron-auth';
import { runExpirySweep } from '@/lib/requests/request-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_SPACING_MS = 10 * 60 * 1000;
let lastSweepAt = 0;

function gate(request: NextRequest): Response | null {
  const header = (request.headers.get('Authorization') ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  const query = new URL(request.url).searchParams.get('secret') ?? '';
  const decision = authorizeCronSchedule(
    {
      enabled:
        process.env.VIDNOV_CRON_ENABLED?.trim().toLowerCase() === 'true' &&
        process.env.REQUESTS_CRON_ENABLED?.trim().toLowerCase() === 'true',
      secret: (process.env.CRON_SECRET ?? '').trim(),
    },
    header || query,
  );
  if (decision.allowed) return null;
  if (decision.status === 204) return new Response(null, { status: 204 });
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

async function handle(request: NextRequest): Promise<Response> {
  const refused = gate(request);
  if (refused) return refused;

  const now = Date.now();
  if (now - lastSweepAt < MIN_SPACING_MS) {
    return NextResponse.json({ skipped: 'in_progress' }, { status: 409 });
  }
  lastSweepAt = now;

  const report = await runExpirySweep(now);
  return NextResponse.json({ ok: true, ...report });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
