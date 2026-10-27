/**
 * Distribution engine configuration — global pause and safe limits.
 *
 * GET  (admin) → current config. Only the switch/limit fields: no env values,
 *                no credentials (they never live here).
 * PUT  (admin) → partial, zod-validated, hard-clamped update. Each change
 *                writes one audit entry (who flipped what, when). The pause
 *                flag is the GLOBAL KILL SWITCH: while true the engine run
 *                performs no submissions at all.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import {
  LIMIT_BOUNDS,
  readDistributionConfig,
  updateDistributionConfig,
} from '@/lib/vidnov-core/distribution/config';
import { recordAudit } from '@/lib/vidnov-core/distribution/audit';
import { updateDistributionConfigSchema } from '@/lib/vidnov-core/validation';

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const config = await readDistributionConfig(db);
    return NextResponse.json({
      config,
      bounds: LIMIT_BOUNDS,
    });
  } catch {
    console.error('[core/distribution] config read failed');
    return NextResponse.json({ error: 'Configuration unavailable.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const parsed = updateDistributionConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid configuration — check the allowed ranges.' },
      { status: 400 },
    );
  }

  try {
    const config = await updateDistributionConfig(db, parsed.data, adminUid);
    const pausedChanged = parsed.data.paused !== undefined;
    await recordAudit(db, {
      actorUid: adminUid,
      action: pausedChanged ? 'pause_toggled' : 'config_updated',
      targetType: 'config',
      targetId: 'global',
      detail: `paused=${config.paused} maxPerRun=${config.maxPerRun} maxPerDay=${config.maxPerDay}`,
    });
    return NextResponse.json({ config });
  } catch {
    console.error('[core/distribution] config update failed');
    return NextResponse.json({ error: 'Configuration could not be saved.' }, { status: 500 });
  }
}
