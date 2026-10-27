/**
 * GET /api/admin/core-engine/status — internal Core Engine status view data.
 *
 * Authorization: `verifyAdminUid` (Bearer token; custom claim or profile
 * role — the same admin definition every other admin route uses).
 *
 * Returns ONLY:
 *   • distribution job counts per status + recent failed jobs (sanitized
 *     error class/message, never raw upstream bodies),
 *   • bounded event counts split by verified (server) vs observed,
 *   • opportunity/application counts,
 *   • integration status as plain booleans — environment VALUES are never
 *     read into or returned by this handler.
 *
 * All counts are equality-only aggregate queries (no composite indexes), each
 * individually guarded: a failing counter reports `null` (unknown) rather
 * than a fabricated 0.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import { CHANNELS, CHANNEL_ENV_REQUIREMENTS } from '@/lib/vidnov-core/distribution/channels';
import { distributionStatusCounts, recentFailedJobs } from '@/lib/vidnov-core/distribution/service';
import {
  APPLICATIONS_COLLECTION,
  OPPORTUNITIES_COLLECTION,
} from '@/lib/vidnov-core/opportunities/service';
import { APPLICATION_STATES, OPPORTUNITY_STATES } from '@/lib/vidnov-core/opportunities/types';

/** Equality-only aggregate count; `null` means unknown, never a fake 0. */
async function countWhere(collection: string, field: string, value: string): Promise<number | null> {
  try {
    const counted = await db.collection(collection).where(field, '==', value).count().get();
    return counted.data().count;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const [distribution, failedJobs, serverEvents, observedViews, shareClicks] = await Promise.all([
      distributionStatusCounts(db),
      // Guarded like the counters: a failing section degrades to an empty
      // list instead of failing the whole status view (the counts around it
      // still report null for unknown rather than a fabricated 0).
      recentFailedJobs(db, 10).catch(() => []),
      countWhere('contentEvents', 'origin', 'server'),
      countWhere('contentEvents', 'type', 'view'),
      countWhere('contentEvents', 'type', 'click'),
    ]);

    const [opportunityCounts, applicationCounts] = await Promise.all([
      Promise.all(OPPORTUNITY_STATES.map((s) => countWhere(OPPORTUNITIES_COLLECTION, 'state', s))),
      Promise.all(APPLICATION_STATES.map((s) => countWhere(APPLICATIONS_COLLECTION, 'state', s))),
    ]);

    return NextResponse.json({
      distribution: {
        byStatus: distribution,
        recentFailed: failedJobs,
      },
      events: {
        verifiedOutcomes: serverEvents,
        observedViews,
        shareClicks,
        note: 'Counts cover the retained event window (TTL-limited), not all time.',
      },
      opportunities: Object.fromEntries(OPPORTUNITY_STATES.map((s, i) => [s, opportunityCounts[i]])),
      applications: Object.fromEntries(APPLICATION_STATES.map((s, i) => [s, applicationCounts[i]])),
      integrations: Object.fromEntries(
        Object.values(CHANNELS).map((ch) => [
          ch.id,
          {
            label: ch.label,
            status: ch.integrationStatus(),
            // Env var NAMES only — presence, never values.
            requiredEnvVars: CHANNEL_ENV_REQUIREMENTS[ch.id],
          },
        ]),
      ),
    });
  } catch {
    console.error('[core/status] failed');
    return NextResponse.json({ error: 'Status unavailable.' }, { status: 500 });
  }
}
