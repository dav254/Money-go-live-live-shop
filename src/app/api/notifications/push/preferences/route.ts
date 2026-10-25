import { NextRequest, NextResponse } from 'next/server';
import { verifyUserUid } from '@/lib/notifications/server-utils';
import { getPushPrefs, setPushPrefs } from '@/lib/notifications/store';
import { PUSH_CATEGORIES } from '@/lib/notifications/push-preferences';

/**
 * Push preferences — `GET` reads them, `POST` saves them.
 *
 * Stored by the VPS-controlled store (PocketBase `push_prefs`, Firestore
 * fallback), which is what `isPushEnabledFor` reads before every send — same
 * storage on both sides, so the settings screen and the delivery path cannot
 * disagree about where the truth lives.
 *
 * ## The write is validated against the known categories
 *
 * The body is filtered against `PUSH_CATEGORIES` rather than merged wholesale.
 * Without that, a client could post an arbitrary key that later shadows a real
 * category's setting. The list is the contract, and only contract members are
 * written.
 */
const CATEGORY_IDS = new Set(PUSH_CATEGORIES.map((c) => c.id));

export async function GET(req: NextRequest) {
  const uid = await verifyUserUid(req);
  if (!uid) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  try {
    const categories = await getPushPrefs(uid);
    return NextResponse.json({ categories });
  } catch (err) {
    console.error('[push] prefs read failed', err);
    return NextResponse.json({ error: 'Could not read preferences' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const uid = await verifyUserUid(req);
  if (!uid) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: { categories?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Only known categories, only booleans.
  const clean: Record<string, boolean> = {};
  const incoming = body?.categories ?? {};
  for (const [key, value] of Object.entries(incoming)) {
    if (CATEGORY_IDS.has(key as never) && typeof value === 'boolean') {
      clean[key] = value;
    }
  }

  try {
    await setPushPrefs(uid, clean);
    return NextResponse.json({ ok: true, categories: clean });
  } catch (err) {
    console.error('[push] prefs write failed', err);
    return NextResponse.json({ error: 'Could not save preferences' }, { status: 500 });
  }
}
