import { NextResponse, type NextRequest } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { db } from '@/firebase/server';
import { APP_SECTIONS, type SectionToggles } from '@/lib/app-sections';

export const runtime = 'nodejs';

/**
 * GET /api/app-config — which app sections are switched on.
 *
 * Read by the buyer/seller client so it can hide disabled nav entries and
 * refuse disabled routes. Requires a signed-in user: this is not public data,
 * and an unauthenticated caller has no section to be governed by anyway.
 *
 * On any failure this returns an empty map, and the client treats "unknown" as
 * "enabled" (see `isSectionEnabled`). A config outage must never lock every
 * user out of the app — it must only mean the toggles cannot be applied.
 */
export async function GET(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const snap = await db.collection('appConfig').doc('main').get();
    const raw = (snap.data()?.sections ?? {}) as Record<string, unknown>;
    const out: SectionToggles = {};
    for (const section of APP_SECTIONS) {
      if (typeof raw[section.id] === 'boolean') out[section.id] = raw[section.id] as boolean;
    }
    return NextResponse.json({ sections: out });
  } catch {
    // Empty = no overrides = everything enabled.
    return NextResponse.json({ sections: {} });
  }
}