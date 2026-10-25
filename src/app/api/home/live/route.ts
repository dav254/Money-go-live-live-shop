import { NextResponse } from 'next/server';
import { pbListLiveSessions } from '@/lib/pocketbase/live-sessions';
import { db } from '@/firebase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/home/live — PUBLIC "on air right now" strip for the landing page.
 *
 * The homepage used to run the `liveSessions` query from the BROWSER with the
 * client SDK — so the marketing site depended on the visitor's network being
 * able to reach Firebase, and a blocked/locked Firestore made the strip lie or
 * hang. This route moves that read server-side with the same VPS-first rule
 * everywhere else uses: PocketBase on this machine answers first, Firestore is
 * the fallback, and the client only ever talks to our own origin.
 *
 * Public on purpose: it returns exactly what the rules already expose
 * (`liveSessions` is `allow read: if true`) — seller id, room title, viewer
 * count — and nothing else. No tokens, no profile data, no counts we do not
 * already render on the landing page.
 *
 * Any failure answers `{ rooms: [] }`: the landing page then shows its
 * designed demo tiles, exactly like an empty Firestore result did before.
 */
export async function GET() {
  try {
    type Room = { id: string; sellerId: string; title: string; viewerCount: number };
    const rooms: Room[] = [];
    const seenSellers = new Set<string>();

    const push = (id: string, sellerId: string, title: string, viewerCount: number) => {
      if (!sellerId || !id || seenSellers.has(sellerId)) return; // one tile per seller
      seenSellers.add(sellerId);
      rooms.push({ id, sellerId, title, viewerCount });
    };

    // VPS store first (sessions are mirrored here at go-live), Firestore second.
    const mirrored = await pbListLiveSessions({ status: 'live', limit: 6 });
    if (mirrored) {
      for (const s of mirrored) {
        push(s.id, s.sellerId ?? s.id, s.title ?? '', s.viewerCount ?? 0);
      }
    }

    // Firestore fallback — also consulted when the VPS store answers "none",
    // because a mirror write can fail at go-live and the floor must not go
    // quiet just because one copy missed a session.
    if (rooms.length === 0) {
      const snap = await db
        .collection('liveSessions')
        .where('status', '==', 'live')
        .limit(6)
        .get()
        .catch(() => null);
      snap?.forEach((d) => {
        const data = (d.data() ?? {}) as { sellerId?: string; title?: string; viewerCount?: number };
        push(d.id, data.sellerId ?? d.id, data.title ?? '', data.viewerCount ?? 0);
      });
    }

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('[home/live]', error);
    return NextResponse.json({ rooms: [] });
  }
}