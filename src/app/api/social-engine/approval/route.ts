import { NextRequest, NextResponse } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { isAdminUid } from '@/lib/server/admin-guard';
import { MODULE_IDS, isModuleId } from '@/lib/social-engine/types';
import { MODULE_SPECS } from '@/lib/social-engine/modules';
import { getModuleReadiness, recordAudit, setApproval } from '@/lib/social-engine/engine';
import { sanitizeErrorMessage } from '@/lib/vidnov-core/distribution/job-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/social-engine/approval
 *
 * Records an administrator's attestation that a provider approval (Meta App
 * Review, TikTok `video.publish`, Google consent verification) has actually
 * been obtained. The attestation is stored in `social_engine_meta` and drives
 * APPROVAL_REQUIRED in the readiness machine — this endpoint never changes
 * what the provider thinks, and it never touches a credential.
 *
 * The module is named in the body (this route has no dynamic segment):
 *   { "module": "facebook", "granted": true, "note": "App Review approved …" }
 *
 * Admin-only; every change is audited.
 */
export async function POST(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = user.isAdmin || (await isAdminUid(user.uid));
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    module?: unknown;
    granted?: unknown;
    note?: unknown;
  };
  const module = typeof body.module === 'string' ? body.module.trim() : '';
  if (!module || !isModuleId(module)) {
    return NextResponse.json({ error: 'Unknown module.', modules: MODULE_IDS }, { status: 400 });
  }
  if (MODULE_SPECS[module].approval?.required !== true) {
    return NextResponse.json(
      { error: 'No provider approval is required for this module.' },
      { status: 400 },
    );
  }

  // Boolean identity — `"false"` or `0` must never grant an approval.
  const granted = body.granted === true;
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : '';

  try {
    const approval = await setApproval({
      module,
      ownerId: user.uid,
      granted,
      note,
      actorUid: user.uid,
    });

    await recordAudit({
      module,
      action: 'approval',
      actorUid: user.uid,
      outcome: granted ? 'ok' : 'refused',
      note: granted ? 'Provider approval marked as obtained.' : 'Provider approval marked as missing.',
    });

    const readiness = await getModuleReadiness(module, {
      env: process.env,
      caller: { uid: user.uid, isAdmin: true },
    });
    return NextResponse.json({ ok: true, approval, readiness });
  } catch (error) {
    return NextResponse.json(
      { error: 'Approval update failed', note: sanitizeErrorMessage(error) },
      { status: 500 },
    );
  }
}
