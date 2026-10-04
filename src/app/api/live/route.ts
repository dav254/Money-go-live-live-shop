import { NextResponse, type NextRequest } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { listLiveStreams } from '@/lib/live/service';
import { db } from '@/firebase/server';
import type { LiveCardView } from '@/lib/live/types';

export const runtime = 'nodejs';

/**
 * GET /api/live — discovery feed (spec §21).
 * `?scope=active` (default) → LIVE/STARTING streams for the LIVE NOW grid.
 * `?scope=mine` → the signed-in seller's own streams (seller home).
 * Business/seller names resolved in one pass for cards.
 */
export async function GET(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') ?? 'active';

  try {
    const streams =
      scope === 'mine'
        ? await listLiveStreams({ sellerId: user.uid, limit: 50 })
        : scope === 'all' && user.role === 'admin'
          ? await listLiveStreams({ limit: 100 })
          : scope === 'reported' && user.role === 'admin'
            ? (await listLiveStreams({ limit: 100 })).filter((s) => (s.reportsCount ?? 0) > 0)
            : await listLiveStreams({ statuses: ['LIVE', 'STARTING'], limit: 50 });

    // Resolve business names in one pass (no N+1 for typical page sizes).
    const sellerIds = Array.from(new Set(streams.map((s) => s.sellerId)));
    const shops = new Map<string, { shopName?: string; location?: string }>();
    await Promise.all(
      sellerIds.slice(0, 50).map(async (sid) => {
        const snap = await db.collection('sellerShops').doc(sid).get().catch(() => null);
        if (snap?.exists) {
          const d = snap.data() as { shopName?: string; location?: string };
          shops.set(sid, { shopName: d.shopName, location: d.location });
        }
      }),
    );

    const cards: LiveCardView[] = streams.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      thumbnailUrl: null, // media thumbnails resolve via /api/media/serve
      businessName: shops.get(s.sellerId)?.shopName ?? null,
      sellerName: null,
      category: s.category ?? null,
      location: s.location ?? shops.get(s.sellerId)?.location ?? null,
      viewerCount: s.viewerCount ?? 0,
      startedAt: s.startedAt,
      ...(user.role === 'admin'
        ? { sellerId: s.sellerId, reportsCount: s.reportsCount ?? 0, visibility: s.visibility }
        : {}),
    }));

    return NextResponse.json({ streams: cards });
  } catch (error) {
    console.error('[live/list]', error);
    return NextResponse.json({ error: 'Could not load lives.' }, { status: 500 });
  }
}
