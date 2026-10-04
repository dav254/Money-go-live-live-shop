import { NextResponse, type NextRequest } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { db } from '@/firebase/server';
import { APP_SECTIONS, type SectionToggles } from '@/lib/app-sections';

export const runtime = 'nodejs';

const CONFIG_DOC = 'appConfig/main';
const KNOWN_IDS = new Set(APP_SECTIONS.map((s) => s.id));

async function readToggles(): Promise<SectionToggles> {
  const snap = await db.collection('appConfig').doc('main').get();
  const raw = (snap.data()?.sections ?? {}) as Record<string, unknown>;
  // Only ever trust known ids — a stale or hand-edited document must not be
  // able to inject arbitrary keys into the client-side toggle map.
  const out: SectionToggles = {};
  for (const id of KNOWN_IDS) {
    if (typeof raw[id] === 'boolean') out[id] = raw[id] as boolean;
  }
  return out;
}

/**
 * GET /api/admin/app-config — current section toggles.
 *
 * Admin only. Returns only known section ids.
 */
export async function GET(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    return NextResponse.json({ sections: await readToggles() });
  } catch {
    return NextResponse.json({ error: 'Could not read app configuration.' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/app-config — enable/disable app sections.
 *
 * Body: { sections: { [sectionId]: boolean } }
 *
 * Only known ids are persisted, and only booleans. This deliberately does not
 * delete records: "remove a section" means switching it off, so turning
 * something back on later restores the routes, the nav entry and the data.
 */
export async function PATCH(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { sections?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const incoming = body?.sections;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return NextResponse.json({ error: 'A `sections` object is required.' }, { status: 400 });
  }

  const rejected = Object.keys(incoming).filter((id) => !KNOWN_IDS.has(id));
  if (rejected.length > 0) {
    return NextResponse.json({ error: `Unknown section(s): ${rejected.join(', ')}` }, { status: 400 });
  }

  const clean: SectionToggles = {};
  for (const [id, value] of Object.entries(incoming)) {
    if (typeof value === 'boolean') clean[id] = value;
  }
  if (Object.keys(clean).length === 0) {
    return NextResponse.json({ error: 'No valid section toggles supplied.' }, { status: 400 });
  }

  try {
    const ref = db.collection('appConfig').doc('main');
    const snap = await ref.get();
    const current = (snap.exists ? snap.data()?.sections ?? {} : {}) as Record<string, unknown>;

    // Merge rather than replace: a partial update must not silently re-enable
    // sections the caller did not mention.
    const merged: Record<string, boolean> = {};
    for (const id of KNOWN_IDS) {
      if (typeof current[id] === 'boolean') merged[id] = current[id] as boolean;
    }
    Object.assign(merged, clean);

    await ref.set(
      { sections: merged, updatedAt: new Date().toISOString(), updatedBy: user.uid },
      { merge: true }
    );

    return NextResponse.json({ sections: merged });
  } catch {
    return NextResponse.json({ error: 'Could not save app configuration.' }, { status: 500 });
  }
}