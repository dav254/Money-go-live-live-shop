/**
 * POST /api/admin/distribution/reconcile — run the product-lifecycle sweep.
 *
 * Admin-only. Body (optional, strict): bounded window sizes. The sweep is
 * idempotent: it creates missing per-destination jobs through the existing
 * job service and STOPS jobs whose product is gone, ineligible, re-owned or
 * on an outdated payload version. Nothing is deleted, nothing is fabricated.
 *
 * Response: the bounded report (created / already-present / stopped +
 * reasons + a capped sample of ineligible listings) — safe fields only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import { reconcileDistribution } from '@/lib/vidnov-core/distribution/reconcile';
import { recordAudit } from '@/lib/vidnov-core/distribution/audit';
import { reconcileRequestSchema } from '@/lib/vidnov-core/validation';

export async function POST(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  let body: unknown = {};
  try {
    const raw = await request.text();
    if (raw.trim()) body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const parsed = reconcileRequestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid sweep limits.' }, { status: 400 });
  }

  try {
    const report = await reconcileDistribution({
      db,
      actor: { uid: adminUid, isAdmin: true },
      ...(parsed.data.productLimit !== undefined
        ? { productLimit: parsed.data.productLimit }
        : {}),
      ...(parsed.data.jobLimit !== undefined ? { jobLimit: parsed.data.jobLimit } : {}),
    });

    const auditRecorded = await recordAudit(db, {
      actorUid: adminUid,
      action: 'reconcile_run',
      targetType: 'reconcile',
      detail: `products=${report.scannedProducts} created=${report.jobsCreated} dup=${report.jobsAlreadyPresent} stopped=${report.jobsStopped}`,
    });

    return NextResponse.json({ report, auditRecorded });
  } catch {
    // No error objects in logs — internal details stay server-side only.
    console.error('[core/distribution] reconcile failed');
    return NextResponse.json({ error: 'Reconciliation could not run.' }, { status: 500 });
  }
}
