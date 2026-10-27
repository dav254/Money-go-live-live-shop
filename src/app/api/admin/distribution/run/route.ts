/**
 * POST /api/admin/distribution/run — execute one bounded engine pass.
 *
 * Admin-only, no body. The pass honours the global pause FIRST (a paused
 * engine returns `{ paused: true }` and touches nothing), then:
 *   • daily Search Console sitemap ping (when authorized),
 *   • submit phase for submittable destinations (quota-checked, budgeted),
 *   • verify phase for destinations with a real status source.
 *
 * Submission results are persisted by the engine service — this route only
 * returns the sanitized report (per-destination counters + ≤50 bounded job
 * rows). It never echoes payloads, credentials or upstream bodies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import { runDistributionEngine } from '@/lib/vidnov-core/distribution/engine';

export async function POST(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const report = await runDistributionEngine({ db, actorUid: adminUid });
    return NextResponse.json({ report });
  } catch {
    // No error objects in logs — internal details stay server-side only.
    console.error('[core/distribution] engine run failed');
    return NextResponse.json({ error: 'Engine run could not complete.' }, { status: 500 });
  }
}
