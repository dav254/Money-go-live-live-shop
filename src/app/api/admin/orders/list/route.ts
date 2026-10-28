import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server';
import { pbListAllOrders } from '@/lib/pocketbase/orders';
import { scrubForPocketBase } from '@/lib/pocketbase/server';

export const runtime = 'nodejs';

/**
 * GET /api/admin/orders/list — the admin orders console's list, merged from
 * the VPS store FIRST.
 *
 * Response:
 *   - `orders`: the full order list — Firestore rows when Firestore answers
 *     (the source of truth the mirror copies), plus every mirrored
 *     PocketBase row Firestore could not produce. When the Firestore project
 *     is blocked, the VPS copy alone fills the console — which is the whole
 *     point of this route.
 *   - `fsCount` / `pbCount`: what each store contributed, so the page can
 *     tell "no orders" from "store unreachable".
 *
 * Dates are normalised to ISO strings (Firestore Timestamps are not JSON),
 * so the client never has to guess at `{seconds, nanoseconds}` shapes.
 */

const MAX_RESULTS = 1000;

function epoch(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'string' || typeof value === 'number') {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  const v = value as { toMillis?: () => number; seconds?: number };
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
}

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // VPS copy — same machine as the app, answers even when Firestore is blocked.
  const pbOrders = await pbListAllOrders(MAX_RESULTS);
  const pbRows = (pbOrders ?? []).map((o) => ({
    id: o.id,
    ...o.data,
    orderDate: typeof o.data.orderDate === 'string' ? o.data.orderDate : null,
  }));
  const pbIds = new Set(pbRows.map((r) => r.id));

  // Firestore — best-effort; Timestamps scrubbed to ISO on the way out.
  const fsRows: Array<Record<string, unknown> & { id: string }> = [];
  const fsIds = new Set<string>();
  let fsCount = 0;
  try {
    const snap = await db.collection('orders').limit(MAX_RESULTS).get();
    fsCount = snap.docs.length;
    for (const d of snap.docs) {
      fsIds.add(d.id);
      const data = (scrubForPocketBase(d.data() ?? {}) ?? {}) as Record<string, unknown>;
      fsRows.push({ id: d.id, ...data, orderDate: data.orderDate ?? null });
    }
  } catch (error) {
    console.error('[admin/orders] Firestore read failed:', error);
  }

  const pbOnlyRows = pbRows.filter((r) => !fsIds.has(r.id));
  const orders = [...fsRows, ...pbOnlyRows].sort(
    (a, b) => epoch(b.orderDate) - epoch(a.orderDate),
  );

  return NextResponse.json({
    ok: true,
    orders,
    fsCount,
    pbCount: pbRows.length,
  });
}
