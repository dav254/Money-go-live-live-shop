import { NextRequest, NextResponse } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { isAdminUid } from '@/lib/server/admin-guard';
import { MODULE_IDS, isModuleId } from '@/lib/social-engine/types';
import { runModuleTest } from '@/lib/social-engine/engine';
import { sanitizeErrorMessage } from '@/lib/vidnov-core/distribution/job-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/social-engine/[module]/test — run the safe diagnostic.
 *
 * Admin-only. The diagnostic performs read-only provider calls (getMe, session
 * create, instance lookup, …): no post, no public channel, no payload. Every
 * step is recorded per TestKind, and READY is only reachable once the module's
 * own proving test (publish, or a diagnostic for infrastructure) succeeds.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ module: string }> },
) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = user.isAdmin || (await isAdminUid(user.uid));
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { module } = await params;
  if (!isModuleId(module)) {
    return NextResponse.json({ error: 'Unknown module.', modules: MODULE_IDS }, { status: 404 });
  }

  try {
    const result = await runModuleTest(module, {
      env: process.env,
      caller: { uid: user.uid, isAdmin: true },
    });

    if (result.refused) {
      return NextResponse.json(
        { refused: true, rateLimited: result.rateLimited === true, note: result.refused },
        { status: result.rateLimited ? 429 : 409 },
      );
    }

    return NextResponse.json({
      ok: result.steps.every((step) => step.ok),
      steps: result.steps,
      readiness: result.readiness,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Diagnostic failed', note: sanitizeErrorMessage(error) },
      { status: 500 },
    );
  }
}
