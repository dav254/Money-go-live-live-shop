import { NextResponse } from 'next/server';
import { runCleanup } from '@/lib/media/service';
import { clearStorageStatsCache } from '@/lib/media/storage';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * GET /api/media/cleanup-cron — external-scheduler entry point.
 * Optional security: set CRON_SECRET and call with
 * `Authorization: Bearer <CRON_SECRET>` (or ?secret=...).
 * Returns 204 with no secret configured (disabled by default).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response(null, { status: 204 });

  const header = (request.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const query = new URL(request.url).searchParams.get('secret') ?? '';
  if (header !== secret && query !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const report = await runCleanup();
  clearStorageStatsCache();
  return NextResponse.json(report);
}
