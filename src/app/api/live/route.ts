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

    /*
     * LIVE SESSIONS — the collection sellers actually broadcast into.
     *
     * The seller studio's "Go live" writes to `liveSessions/{sellerId}`
     * (POST /api/live-session), and that is the document the buyer watch
     * page, live chat and pinned products all read. `liveStreams` only ever
     * receives documents from POST /api/live/create, which no surface calls
     * — so a grid built from `liveStreams` alone stayed empty no matter how
     * many sellers were on air. Any non-scoped ("active") listing therefore
     * merges both sources, and marks session-backed cards so the client can
     * route to the watch page that can actually play them.
     */
    const mergedActive = scope !== 'mine' && scope !== 'all' && scope !== 'reported';
    const sessionSnap = mergedActive
      ? await db
          .collection('liveSessions')
          .where('status', '==', 'live')
          .limit(50)
          .get()
          .catch(() => null)
      : null;

    type SessionRow = {
      sellerId: string;
      title: string;
      viewerCount: number;
      startedAt: unknown;
    };
    const sessionRows: SessionRow[] = [];
    sessionSnap?.forEach((d) => {
      const data = d.data() as {
        sellerId?: string;
        title?: string;
        viewerCount?: number;
        startTime?: unknown;
      };
      sessionRows.push({
        sellerId: data.sellerId ?? d.id,
        title: data.title ?? '',
        viewerCount: data.viewerCount ?? 0,
        startedAt: data.startTime ?? null,
      });
    });

    // Resolve business names in one pass (no N+1 for typical page sizes).
    const sellerIds = Array.from(
      new Set([...streams.map((s) => s.sellerId), ...sessionRows.map((r) => r.sellerId)]),
    );
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

    // Merge the studio's on-air sellers, skipping any seller already listed
    // from `liveStreams` (one tile per seller — the richer stream wins).
    const listed = new Set(streams.map((s) => s.sellerId));
    for (const row of sessionRows) {
      if (listed.has(row.sellerId)) continue;
      listed.add(row.sellerId);
      const shop = shops.get(row.sellerId);
      cards.push({
        id: row.sellerId,
        title: row.title || `${shop?.shopName ?? 'Vidnov Business'} · Live`,
        status: 'LIVE',
        thumbnailUrl: null,
        businessName: shop?.shopName ?? null,
        sellerName: null,
        category: null,
        location: shop?.location ?? null,
        viewerCount: row.viewerCount,
        startedAt: row.startedAt,
        // The watch route for these is /buyer/live/[sellerId], not /live/[id].
        sessionBacked: true,
      });
    }

    // Newest broadcast first across both sources.
    const startedMs = (value: unknown): number => {
      if (!value) return 0;
      if (typeof value === 'number') return value;
      if (value instanceof Date) return value.getTime();
      const ts = value as { toDate?: () => Date; seconds?: number };
      if (typeof ts.toDate === 'function') return ts.toDate().getTime();
      if (typeof ts.seconds === 'number') return ts.seconds * 1000;
      return 0;
    };
    cards.sort((a, b) => startedMs(b.startedAt) - startedMs(a.startedAt));

    return NextResponse.json({ streams: cards });
  } catch (error) {
    console.error('[live/list]', error);
    return NextResponse.json({ error: 'Could not load lives.' }, { status: 500 });
  }
}
