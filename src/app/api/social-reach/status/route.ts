import { NextRequest, NextResponse } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { getTikTokConnection, deleteTikTokConnection } from '@/lib/tiktok/store';
import { db } from '@/firebase/server';
import { publishingGate, socialReachPostCost, REQUIRED_TIKTOK_SCOPES } from '@/lib/social-reach/config';

export const runtime = 'nodejs';

/**
 * GET /api/social-reach/status — everything the Social Reach page needs to
 * render, and nothing else. Safe fields only:
 * connected / needsReconnect / scopes / connectedAt / points balance / gate.
 * Tokens, refresh tokens, open ids of other accounts and raw store documents
 * are never returned.
 *
 * POST on the same route = disconnect (seller removes their own connection).
 */
export async function GET(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'seller' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Only business accounts can use Social Reach.' }, { status: 403 });
  }

  try {
    const [conn, profileSnap] = await Promise.all([
      getTikTokConnection(user.uid),
      db.collection('userProfiles').doc(user.uid).get().catch(() => null),
    ]);
    const points = Number((profileSnap?.data() as { aiPoints?: number } | undefined)?.aiPoints ?? 0);
    const gate = publishingGate();
    const scopes = Array.isArray(conn?.scopes) ? conn!.scopes! : [];
    const hasPublishScope = REQUIRED_TIKTOK_SCOPES.every((s) => scopes.includes(s));

    const connected = !!conn?.accessToken && !conn?.needsReconnect;

    return NextResponse.json({
      connected,
      needsReconnect: !!conn?.needsReconnect,
      connectedAt: conn?.connectedAt || null,
      scopes,
      hasPublishScope,
      // Honest reporting: we cannot prove TikTok's server-side approval, so
      // this reflects our own gate — never a claim that TikTok approved us.
      publishing: { enabled: gate.enabled, approvalGranted: gate.approvalGranted, reason: gate.reason },
      postCostPoints: socialReachPostCost(),
      pointsBalance: points,
    });
  } catch (error) {
    console.error('[social-reach] status failed', (error as Error)?.message);
    return NextResponse.json({ error: 'Could not load Social Reach status.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'seller' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    await deleteTikTokConnection(user.uid); // own connection only — uid from the verified token
    return NextResponse.json({ connected: false });
  } catch (error) {
    console.error('[social-reach] disconnect failed', (error as Error)?.message);
    return NextResponse.json({ error: 'Could not disconnect.' }, { status: 503 });
  }
}