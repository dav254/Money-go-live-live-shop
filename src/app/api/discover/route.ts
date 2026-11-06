/**
 * GET /api/discover — the public discovery query.
 *
 * Server-side only: filtering, ranking and paging all happen here so the
 * browser never receives the catalogue. Inputs are validated by
 * `parseDiscoverQuery`, reads are windowed, and the route is rate limited.
 *
 * Demand counters are written for page 1 only, so paging through one search
 * cannot inflate "searches with no results" into a fake trend.
 */

import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { parseDiscoverQuery, searchDiscover } from '@/lib/discover/search';
import { clientKey, rateLimit } from '@/lib/discover/rate-limit';
import { recordSearchDemand } from '@/lib/discover/demand';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const limit = rateLimit(`discover:${clientKey(request)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many searches. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  const parsed = parseDiscoverQuery(new URL(request.url).searchParams);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const page = await searchDiscover(db, parsed.value);

    if (parsed.value.page === 1) {
      // Fire-and-forget: the counter must never delay or fail the response.
      void recordSearchDemand(db, {
        category: parsed.value.category,
        location: parsed.value.location,
        zeroResults: page.total === 0,
      });
    }

    return NextResponse.json({
      ...page,
      query: {
        q: parsed.value.q,
        kind: parsed.value.kind,
        category: parsed.value.category ?? null,
        location: parsed.value.location ?? null,
        availability: parsed.value.availability,
        sort: parsed.value.sort,
      },
    });
  } catch {
    // Static log: no query text, no document ids, no error body.
    console.error('[discover] search failed');
    return NextResponse.json(
      { error: 'Discovery is temporarily unavailable.' },
      { status: 503 },
    );
  }
}
