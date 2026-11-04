import { NextRequest, NextResponse } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { isAdminUid } from '@/lib/server/admin-guard';
import { MODULE_IDS, isModuleId } from '@/lib/social-engine/types';
import { disconnectModule, getModuleReadiness } from '@/lib/social-engine/engine';
import { sanitizeErrorMessage } from '@/lib/vidnov-core/distribution/job-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/social-engine/[module]/disconnect
 *
 * Marks the caller's OWN connection disconnected (an admin disconnecting their
 * own account, a seller theirs — `connections.ts` enforces the tenant wall, so
 * passing someone else's id is impossible from here). The record is kept for
 * history; the readiness machine turns a disconnected record into CONFIGURED
 * and no publish path will use it again.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ module: string }> },
) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = user.isAdmin || (await isAdminUid(user.uid));
  if (!isAdmin && user.role !== 'seller') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { module } = await params;
  if (!isModuleId(module)) {
    return NextResponse.json({ error: 'Unknown module.', modules: MODULE_IDS }, { status: 404 });
  }

  try {
    const disconnected = await disconnectModule(module, {
      env: process.env,
      caller: { uid: user.uid, isAdmin },
    });
    if (!disconnected) {
      return NextResponse.json({ error: 'No connection to disconnect.' }, { status: 404 });
    }

    const readiness = await getModuleReadiness(module, {
      env: process.env,
      caller: { uid: user.uid, isAdmin },
    });
    return NextResponse.json({ ok: true, readiness });
  } catch (error) {
    return NextResponse.json(
      { error: 'Disconnect failed', note: sanitizeErrorMessage(error) },
      { status: 500 },
    );
  }
}
