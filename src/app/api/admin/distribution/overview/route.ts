/**
 * GET /api/admin/distribution/overview — Distribution Control Center data.
 *
 * Authorization: `verifyAdminUid` (Bearer token — the same admin definition
 * every other admin route uses). EVERY section of the dashboard reads from
 * this one admin-only endpoint:
 *
 *   1. Overview & engine health — pause flag, limits, last run, job counts.
 *   2. API connections — env-var PRESENCE per destination, never values.
 *   3. Queues — per-status and per-destination counts (null = unknown).
 *   4. Publication — per-destination confirmation states (accepted vs
 *      verified published/indexed vs unknown vs failed).
 *   5. Errors — recent failures + an EXACT dead-letter count derived from
 *      equality-only aggregates (failed minus retryable-within-cap).
 *   6. Analytics — real recorded events per destination + GA4 when connected.
 *   8. Audit — the latest management actions.
 *
 * Rules: every counter is individually guarded (failing ⇒ `null`, never a
 * fabricated 0); no env values, no tokens, no seller payloads, no raw error
 * objects in responses or logs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import {
  pbCountDistributionJobs,
  pbRecentFailedJobs,
  type DistributionJobFilter,
} from '@/lib/pocketbase/distribution-jobs';
import { CHANNELS, getJobDestinations } from '@/lib/vidnov-core/distribution/channels';
import { connectionStatuses, readGa4Traffic } from '@/lib/vidnov-core/distribution/adapters';
import { readDistributionConfig } from '@/lib/vidnov-core/distribution/config';
import { listAudit } from '@/lib/vidnov-core/distribution/audit';
import { destinationAnalytics } from '@/lib/vidnov-core/distribution/analytics';
import { distributionStatusCounts, recentFailedJobs } from '@/lib/vidnov-core/distribution/service';
import { MAX_JOB_ATTEMPTS, RETRYABLE_ERROR_CLASSES, CONFIRMATION_STATES } from '@/lib/vidnov-core/types';
import type { ErrorClass } from '@/lib/vidnov-core/types';

/**
 * Maps a Firestore (field, value, extra) equality filter onto the flattened
 * PocketBase filter shape (`confirmation.state` → `confirmationState`, etc.).
 * Unknown fields are dropped rather than guessed.
 */
function toPbFilter(
  field: string,
  value: string | number | boolean,
  extra: Array<[string, string | number | boolean]> = [],
): DistributionJobFilter {
  const map = (f: string, v: string | number | boolean): DistributionJobFilter => {
    if (f === 'status') return { status: String(v) };
    if (f === 'channel') return { channel: String(v) };
    if (f === 'confirmation.state') return { confirmationState: String(v) };
    if (f === 'lastError.class') return { lastErrorClass: String(v) };
    if (f === 'attempts') return { attempts: Number(v) };
    return {};
  };
  return [map(field, value), ...extra.map(([f, v]) => map(f, v))].reduce(
    (acc, cur) => ({ ...acc, ...cur }),
    {} as DistributionJobFilter,
  );
}

/**
 * Equality-only aggregate count; `null` means unknown, never a fake 0.
 * Firestore first (source of truth); when it cannot answer (blocked project,
 * quota), the VPS mirror answers instead so the counters stay live.
 */
async function countWhere(
  field: string,
  value: string | number | boolean,
  extra: Array<[string, string | number | boolean]> = [],
): Promise<number | null> {
  try {
    let query = db.collection('distributionJobs').where(field, '==', value);
    for (const [f, v] of extra) query = query.where(f, '==', v);
    const snap = await query.count().get();
    return snap.data().count;
  } catch {
    // Firestore unavailable → the same equality filter over the VPS mirror.
    return pbCountDistributionJobs(toPbFilter(field, value, extra));
  }
}

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const [config, byStatus, recentFailed, audit, analytics, ga] = await Promise.all([
      readDistributionConfig(db),
      // When Firestore cannot answer a single status counter, the whole
      // by-status map is recomputed from the VPS mirror — the queue panel
      // keeps its numbers through a blocked Firestore project.
      distributionStatusCounts(db).then(async (counts) => {
        if (Object.values(counts).some((v) => v !== null)) return counts;
        const out: Record<string, number | null> = {};
        await Promise.all(
          Object.keys(counts).map(async (s) => {
            out[s] = await pbCountDistributionJobs({ status: s });
          }),
        );
        return out;
      }),
      recentFailedJobs(db, 10).catch(
        async () => (await pbRecentFailedJobs(10)) ?? [],
      ),
      listAudit(db, 15).catch(() => []),
      destinationAnalytics(db),
      readGa4Traffic((url, init) => globalThis.fetch(url, init as RequestInit)),
    ]);

    /* ── Publication: confirmation state per destination ─────────────────── */

    const destinationIds = getJobDestinations().map((d) => d.id);
    const confirmationByState = Object.fromEntries(
      await Promise.all(
        CONFIRMATION_STATES.map(
          async (state) => [state, await countWhere('confirmation.state', state)] as const,
        ),
      ),
    );
    const publication = Object.fromEntries(
      await Promise.all(
        destinationIds.map(async (id) => {
          const entry = Object.fromEntries(
            await Promise.all(
              CONFIRMATION_STATES.map(
                async (state) =>
                  [state, await countWhere('channel', id, [['confirmation.state', state]])] as const,
              ),
            ),
          );
          const total = await countWhere('channel', id);
          return [id, { total, byConfirmation: entry }] as const;
        }),
      ),
    );

    /* ── Dead letter: failed jobs that are NOT retryable anymore ─────────── */

    const failedTotal = await countWhere('status', 'failed');
    const needsAttention = await countWhere('status', 'needs_attention');
    const retryableOpenParts = await Promise.all(
      RETRYABLE_ERROR_CLASSES.flatMap((cls: ErrorClass) =>
        Array.from({ length: MAX_JOB_ATTEMPTS }, (_, attempt) =>
          countWhere('status', 'failed', [
            ['lastError.class', cls],
            ['attempts', attempt],
          ]),
        ),
      ),
    );
    const retryableOpen = retryableOpenParts.every((n) => n !== null)
      ? retryableOpenParts.reduce<number>((sum, n) => sum + (n ?? 0), 0)
      : null;
    const deadLetterCount =
      failedTotal !== null && retryableOpen !== null
        ? Math.max(0, failedTotal - retryableOpen)
        : null;

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      engine: {
        paused: config.paused,
        pausedAt: config.pausedAt,
        pausedBy: config.pausedBy,
        maxPerRun: config.maxPerRun,
        maxPerDay: config.maxPerDay,
        lastRunAt: config.lastRunAt,
        sitemapSubmittedAt: config.sitemapSubmittedAt,
        updatedAt: config.updatedAt,
        updatedBy: config.updatedBy,
      },
      connections: connectionStatuses(),
      queues: {
        byStatus,
        byDestination: Object.fromEntries(
          await Promise.all(
            destinationIds.map(async (id) => [id, await countWhere('channel', id)] as const),
          ),
        ),
        deadLetterCount,
        needsAttention,
        failedTotal,
        recentFailed,
      },
      publication: {
        byConfirmation: confirmationByState,
        byDestination: publication,
        note: '“Accepted” means the destination’s API accepted our request. Only “Published”/“Indexed” are verified confirmations.',
      },
      analytics,
      ga: {
        configured: ga.configured,
        totalSessions: ga.totalSessions,
        byDate: ga.byDate,
        ...(ga.error ? { error: ga.error } : {}),
      },
      audit,
      channels: Object.values(CHANNELS).map((c) => ({ id: c.id, label: c.label, kind: c.kind })),
    });
  } catch {
    // No error objects in logs — internal details stay server-side only.
    console.error('[core/distribution] overview failed');
    return NextResponse.json({ error: 'Overview unavailable.' }, { status: 500 });
  }
}
