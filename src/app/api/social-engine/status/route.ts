import { NextRequest, NextResponse } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { isAdminUid } from '@/lib/server/admin-guard';
import { getAllReadiness } from '@/lib/social-engine/engine';
import { FREE_CAPABILITIES } from '@/lib/social-engine/capabilities';
import { canonicalOrigin } from '@/lib/social-engine/url-track';
import { sanitizeErrorMessage } from '@/lib/vidnov-core/distribution/job-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/social-engine/status — administrator readiness data.
 *
 * Server-side only:
 *   • env presence is read as NAMES, never values,
 *   • only the caller's own connection is inspected (tenant wall in
 *     `connections.ts`), so one seller can never see another's account,
 *   • readiness comes from recorded tests, not from configuration alone,
 *   • no token, credential or upstream error body is returned.
 *
 * Admin-only: the Social Engine manages platform-level integrations.
 */
export async function GET(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isAdmin = user.isAdmin || (await isAdminUid(user.uid));
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const modules = await getAllReadiness({
      env: process.env,
      caller: { uid: user.uid, isAdmin: true },
    });

    return NextResponse.json({
      modules,
      capabilities: {
        free: [...FREE_CAPABILITIES],
      },
      canonicalOrigin: canonicalOrigin(),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    // Sanitized: an internal message may name a collection, never a secret.
    return NextResponse.json(
      { error: 'Readiness fetch failed', note: sanitizeErrorMessage(error) },
      { status: 503 },
    );
  }
}
