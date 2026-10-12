import { NextResponse } from 'next/server';
import { runCleanup } from '@/lib/media/service';
import { clearStorageStatsCache } from '@/lib/media/storage';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * GET /api/media/cleanup-cron — external-scheduler entry point.
 * Only answered when `VIDNOV_CRON_ENABLED=true`. The old, optional
 * `CRON_SECRET` gate is kept underneath so existing schedules keep working;
 * callers must present `Authorization: Bearer <CRON_SECRET>` (or
 * `?secret=...`) or the entry point still returns 204/403.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const cronEnabled = process.env.VIDNOV_CRON_ENABLED?.trim().toLowerCase() !== 'false';

  // Off by default: an enabled-but-unsecret entry point is an unauthenticated
  // disk-sweep endpoint that any client can hit. Fail closed.
  if (!cronEnabled) return new Response(null, { status: 204 });

  const header = (request.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const query = new URL(request.url).searchParams.get('secret') ?? '';
  if (cronSecret && (header !== cronSecret && query !== cronSecret)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const report = await runCleanup();
  clearStorageStatsCache();
  return NextResponse.json(report);
}
