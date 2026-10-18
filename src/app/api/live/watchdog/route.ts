import { NextResponse } from 'next/server';
import { failStaleStreams } from '@/lib/live/service';

/**
 * STREAM WATCHDOG ENDPOINT.
 *
 * Ends live broadcasts that have passed the paid 70-minute ceiling, and ones whose
 * seller vanished without ending the stream. Without this running, a dead
 * broadcast stays `LIVE` forever and every visitor is told an empty room is
 * open.
 *
 * ## Calling it
 *
 * Point the VPS cron at it every minute:
 *
 *   * * * * * curl -fsS -H "x-watchdog-secret: $WATCHDOG_SECRET" \
 *       https://vidnov.com/api/live/watchdog >/dev/null
 *
 * `WATCHDOG_SECRET` is the only thing protecting it: the endpoint ends live
 * streams, so an open one would let anyone cut a seller's broadcast. If the
 * variable is unset the endpoint refuses to run rather than defaulting to open
 * — an accidentally-open watchdog is worse than no watchdog, because it would
 * look like it was working.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
  const expected = process.env.WATCHDOG_SECRET?.trim();
  const supplied = request.headers.get('x-watchdog-secret') || '';

  if (!expected) {
    console.error('[watchdog] WATCHDOG_SECRET is not set — refusing to run.');
    return NextResponse.json({ error: 'Watchdog secret not configured' }, { status: 503 });
  }

  if (supplied !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await failStaleStreams();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[watchdog] sweep failed', error);
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 });
  }
}
