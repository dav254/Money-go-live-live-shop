import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server';
import { pbListAllProducts } from '@/lib/pocketbase/products';

export const runtime = 'nodejs';

/**
 * GET /api/admin/products/list — the admin product console's list, merged from
 * the VPS store FIRST.
 *
 * Response:
 *   - `products`: the FULL catalog — every mirrored (PocketBase) row plus the
 *     Firestore-only rows the mirror has not caught yet, deduped by id. This
 *     is what the admin page renders, so the console keeps working when the
 *     Firestore project is blocked (the migration reason).
 *   - `extraProducts`: the mirror-only rows (kept for older callers).
 *   - `fsCount`: how many rows Firestore contributed (0 when it could not be
 *     read) — the page can tell "empty" from "store unreachable".
 *
 * Firestore is best-effort: a failure degrades to the VPS copy, never an
 * error page.
 */

const MAX_RESULTS = 500;

/** Firestore Timestamp | ISO string | epoch | {seconds} → ISO string. */
function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return new Date(value).toISOString();
  const v = value as { toDate?: () => Date; toMillis?: () => number; seconds?: number };
  try {
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
    if (typeof v.toMillis === 'function') return new Date(v.toMillis()).toISOString();
    if (typeof v.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
  } catch {
    return null;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // VPS copy — same machine as the app, answers even when Firestore is blocked.
  const pbProducts = await pbListAllProducts(MAX_RESULTS);
  const pbRows = (pbProducts ?? []).map((p) => ({
    id: p.id,
    ...((p.data ?? {}) as Record<string, unknown>),
    uploadDate: toIso((p.data as Record<string, unknown> | undefined)?.uploadDate),
  }));
  const pbIds = new Set(pbRows.map((r) => r.id));

  // Firestore — best-effort. When it answers, its rows win on conflict (the
  // mirror is a copy of it); when it cannot (blocked project / quota), the
  // VPS rows below are the whole catalog and the console still works.
  const fsRows: Array<Record<string, unknown> & { id: string }> = [];
  const fsIds = new Set<string>();
  let fsCount = 0;
  try {
    const snap = await db.collection('products').limit(1000).get();
    fsCount = snap.docs.length;
    for (const d of snap.docs) {
      fsIds.add(d.id);
      const data = (d.data() ?? {}) as Record<string, unknown>;
      fsRows.push({ id: d.id, ...data, uploadDate: toIso(data.uploadDate) });
    }
  } catch (error) {
    console.error('[admin/products] Firestore read failed:', error);
  }

  const pbOnlyRows = pbRows.filter((r) => !fsIds.has(r.id));
  const products = [...fsRows, ...pbOnlyRows];
  // Mirror rows Firestore never saw (kept for older callers of this route).
  const extraProducts = pbOnlyRows;

  return NextResponse.json({
    ok: true,
    products,
    fsCount,
    pbCount: pbRows.length,
    extraProducts,
  });
}
