import { NextRequest, NextResponse } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { isAdminUid } from '@/lib/server/admin-guard';
import { MODULE_IDS, isModuleId } from '@/lib/social-engine/types';
import { runModulePublishTest } from '@/lib/social-engine/engine';
import { sanitizeErrorMessage } from '@/lib/vidnov-core/distribution/job-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/social-engine/[module]/publish-test
 *
 * Sends ONE neutral test message ("Vidnov integration test — safe to ignore.")
 * to the module's own configured destination. Admin-only, and gated three
 * times:
 *
 *   1. `confirm === true` in the body — the explicit administrator
 *      confirmation, asserted in the engine as well as here;
 *   2. the module's provider approval (Meta App Review / TikTok
 *      `video.publish`) must be attested before a publish test can run;
 *   3. a short server-side cooldown, so a double click cannot double-post.
 *
 * Promotional content never travels through this route — that is the existing
 * growth-posts approval queue. A handoff (Share-to-TikTok) is returned as a
 * handoff and is never recorded as a published post. No credential is ever
 * read into or returned by this handler.
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

  const body = (await request.json().catch(() => ({}))) as {
    confirm?: unknown;
    videoUrl?: unknown;
    pageId?: unknown;
  };

  // Boolean identity — a truthy string can never confirm a publish.
  const confirm = body.confirm === true;
  const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.slice(0, 2048) : undefined;
  const pageId = typeof body.pageId === 'string' ? body.pageId.replace(/[^0-9]/g, '').slice(0, 64) : undefined;

  try {
    const result = await runModulePublishTest(module, {
      env: process.env,
      caller: { uid: user.uid, isAdmin: true },
      confirm,
      videoUrl: videoUrl || undefined,
      pageId: pageId || undefined,
    });

    if (result.handoffUrl) {
      return NextResponse.json({
        ok: false,
        handoff: true,
        handoffUrl: result.handoffUrl,
        note: result.note,
        readiness: result.readiness,
      });
    }

    if (result.rateLimited) {
      return NextResponse.json({ ok: false, rateLimited: true, note: result.note }, { status: 429 });
    }
    if (result.refused) {
      return NextResponse.json({ ok: false, refused: true, note: result.refused }, { status: 409 });
    }
    if (!result.ok) {
      return NextResponse.json({ ok: false, note: result.note }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      remoteId: result.remoteId,
      note: result.note,
      readiness: result.readiness,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Publish test failed', note: sanitizeErrorMessage(error) },
      { status: 500 },
    );
  }
}
