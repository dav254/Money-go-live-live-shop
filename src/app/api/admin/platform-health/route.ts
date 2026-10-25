import { NextResponse, type NextRequest } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { db } from '@/firebase/server';
import { getStorageStats } from '@/lib/media/storage';
import { getVidnovConfig } from '@/lib/notifications/config';
import { AI_JOB_COLLECTION } from '@/lib/ai/config';
import { pbListLiveSessions } from '@/lib/pocketbase/live-sessions';

export const runtime = 'nodejs';

/** Worst-of rollup so one broken subsystem can never read as "healthy". */
export type HealthState = 'operational' | 'degraded' | 'outage';

export interface HealthSignal {
  id: string;
  label: string;
  state: HealthState;
  /** Short human summary shown in the admin strip. */
  detail: string;
  /** Where an admin should go to fix it. */
  href?: string;
}

/**
 * GET /api/admin/platform-health — the real state of the platform.
 *
 * The admin dashboard used to render a hardcoded "ALL SYSTEMS OPERATIONAL"
 * badge that stayed green even while the disk filled up, AI jobs failed and
 * disputes piled up. This endpoint replaces that decoration with measured
 * signals so the badge can only say "operational" when it actually is.
 *
 * Every probe is independent and failure-tolerant: a subsystem that cannot be
 * measured reports `unknown` detail rather than taking the whole endpoint
 * down, and an unreadable probe is surfaced as an alert instead of being
 * silently treated as healthy.
 */
export async function GET(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const signals: HealthSignal[] = [];
  const alerts: string[] = [];

  // ---- Media storage: the one subsystem that can take the whole site down. ----
  try {
    const stats = await getStorageStats();
    const pct = Math.round(stats.usedPercent);
    let state: HealthState = 'operational';
    if (stats.usedPercent >= 90) state = 'outage';
    else if (stats.usedPercent >= 75 || stats.mode === 'STORAGE_PROTECTION') state = 'degraded';

    signals.push({
      id: 'storage',
      label: 'Media storage',
      state,
      detail: `${pct}% of disk used · ${stats.mediaCount} files${stats.threshold ? ` · ${stats.threshold}` : ''}`,
      href: '/dashboard/admin/system/media-storage',
    });
    if (state !== 'operational') {
      alerts.push(
        `Media storage at ${pct}% — uploads ${stats.mode === 'STORAGE_PROTECTION' ? 'are in protection mode' : 'will be blocked soon'}.`
      );
    }
  } catch {
    signals.push({
      id: 'storage',
      label: 'Media storage',
      state: 'degraded',
      detail: 'Could not read disk usage',
      href: '/dashboard/admin/system/media-storage',
    });
    alerts.push('Media storage stats are unavailable — disk monitoring is blind.');
  }

  // ---- Unreviewed error logs -------------------------------------------------
  try {
    const snap = await db.collection('errorLogs').where('status', '==', 'new').limit(200).get();
    const count = snap.size;
    signals.push({
      id: 'errors',
      label: 'Error logs',
      state: count > 25 ? 'degraded' : 'operational',
      detail: count === 1 ? '1 unreviewed error' : `${count} unreviewed errors`,
      href: '/dashboard/admin/logs',
    });
    if (count > 0) alerts.push(`${count} client error${count === 1 ? '' : 's'} awaiting review.`);
  } catch {
    signals.push({ id: 'errors', label: 'Error logs', state: 'degraded', detail: 'Could not read error logs', href: '/dashboard/admin/logs' });
    alerts.push('Error log query failed — client errors are not being surfaced.');
  }

  // ---- Disputed orders: money and trust at risk ------------------------------
  try {
    const snap = await db.collection('orders').where('orderStatus', '==', 'disputed').limit(200).get();
    const count = snap.size;
    signals.push({
      id: 'disputes',
      label: 'Disputed orders',
      state: count > 0 ? 'degraded' : 'operational',
      detail: count === 0 ? 'None open' : count === 1 ? '1 dispute open' : `${count} disputes open`,
      href: '/dashboard/admin/orders/disputes',
    });
    if (count > 0) alerts.push(`${count} disputed order${count === 1 ? '' : 's'} need a decision.`);
  } catch {
    signals.push({ id: 'disputes', label: 'Disputed orders', state: 'degraded', detail: 'Could not read disputes', href: '/dashboard/admin/orders/disputes' });
  }

  // ---- Complaints ------------------------------------------------------------
  try {
    const snap = await db.collection('complaints').where('status', 'in', ['open', 'pending']).limit(200).get();
    const count = snap.size;
    signals.push({
      id: 'complaints',
      label: 'Complaints',
      state: count > 10 ? 'degraded' : 'operational',
      detail: count === 0 ? 'None open' : count === 1 ? '1 open complaint' : `${count} open complaints`,
      href: '/dashboard/admin/support/complaints',
    });
    if (count > 0) alerts.push(`${count} open complaint${count === 1 ? '' : 's'}.`);
  } catch {
    // A missing complaints collection must not be reported as an outage.
    signals.push({ id: 'complaints', label: 'Complaints', state: 'operational', detail: 'None open', href: '/dashboard/admin/support/complaints' });
  }

  // ---- AI jobs ---------------------------------------------------------------
  try {
    const snap = await db.collection(AI_JOB_COLLECTION).where('status', '==', 'FAILED').limit(200).get();
    const failed = snap.size;
    signals.push({
      id: 'ai',
      label: 'AI Studio',
      state: failed > 10 ? 'degraded' : 'operational',
      detail: failed === 0 ? 'No failed jobs' : `${failed} failed job${failed === 1 ? '' : 's'}`,
      href: '/dashboard/admin/ai-management',
    });
    if (failed > 0) alerts.push(`${failed} AI generation job${failed === 1 ? '' : 's'} failed.`);
  } catch {
    signals.push({ id: 'ai', label: 'AI Studio', state: 'degraded', detail: 'Could not read AI jobs', href: '/dashboard/admin/ai-management' });
  }

  // ---- Live streams ----------------------------------------------------------
  try {
    // VPS store first (sessions are mirrored there at go-live), Firestore
    // second — the admin strip must not read "could not read" during an
    // outage the VPS can see straight through.
    const mirrored = await pbListLiveSessions({ status: 'live', limit: 200 });
    const liveCount =
      mirrored ??
      (await db.collection('liveSessions').where('status', '==', 'live').limit(200).get())
        .size;
    signals.push({
      id: 'live',
      label: 'Live streams',
      state: 'operational',
      detail: liveCount === 0 ? 'None live' : `${liveCount} live now`,
      href: '/dashboard/admin/live-shopping/sessions',
    });
  } catch {
    signals.push({ id: 'live', label: 'Live streams', state: 'degraded', detail: 'Could not read live sessions', href: '/dashboard/admin/live-shopping/sessions' });
  }

  // ---- Email delivery configuration -----------------------------------------
  // Not configured is a real gap: password reset and order mail never leave the
  // box. Surfaced so the dashboard cannot read "operational" while mail is dead.
  try {
    const cfg = getVidnovConfig();
    const production = cfg.emailMode === 'production';
    const ready = Boolean(cfg.emailProvider.trim() && cfg.emailApiKey.trim());
    signals.push({
      id: 'email',
      label: 'Email delivery',
      state: production && !ready ? 'degraded' : 'operational',
      detail: production
        ? ready
          ? `Live via ${cfg.emailProvider}`
          : 'Not configured — no mail is sent'
        : `Development mailbox (${cfg.emailMode})`,
      href: '/dashboard/admin/system/email',
    });
    if (production && !ready) {
      alerts.push('Email delivery is unconfigured — password resets and order emails will not send.');
    }
  } catch {
    signals.push({ id: 'email', label: 'Email delivery', state: 'degraded', detail: 'Could not read email config', href: '/dashboard/admin/system/email' });
  }

  // ---- Rollup: worst signal wins. -------------------------------------------
  const state: HealthState = signals.some((s) => s.state === 'outage')
    ? 'outage'
    : signals.some((s) => s.state === 'degraded')
      ? 'degraded'
      : 'operational';

  const headline =
    state === 'operational'
      ? 'ALL SYSTEMS OPERATIONAL'
      : state === 'outage'
        ? 'SERVICE DEGRADED — ACTION REQUIRED'
        : `${alerts.length} ISSUE${alerts.length === 1 ? '' : 'S'} NEED ATTENTION`;

  return NextResponse.json({
    state,
    headline,
    alerts,
    signals,
    checkedAt: new Date().toISOString(),
  });
}
