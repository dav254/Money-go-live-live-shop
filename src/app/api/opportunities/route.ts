/**
 * /api/opportunities — business-funded task foundation.
 *
 * GET  (public)      → open/closed opportunities only. Drafts and cancelled
 *                      tasks never leave this route's state allowlist.
 * POST (admin only)  → create an opportunity. Requires a verified admin
 *                      (Bearer token, same pattern as every admin route);
 *                      the funder uid comes from the verified identity, never
 *                      the body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { createOpportunity, listOpportunities } from '@/lib/vidnov-core/opportunities/service';
import { createOpportunitySchema, listOpportunitiesSchema } from '@/lib/vidnov-core/validation';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const parsed = listOpportunitiesSchema.safeParse({
      state: params.get('state') ?? undefined,
      limit: params.get('limit') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query.' }, { status: 400 });
    }
    // Public allowlist: only states an anonymous visitor may see.
    const states = parsed.data.state && parsed.data.state !== 'draft' && parsed.data.state !== 'cancelled'
      ? [parsed.data.state]
      : (['open', 'closed'] as const);

    const items = await listOpportunities(db, { states, limit: parsed.data.limit });
    return NextResponse.json({ items });
  } catch {
    console.error('[core/opportunities] list failed');
    return NextResponse.json({ error: 'Opportunities are temporarily unavailable.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await verifyUserContext(request);
    if (!ctx) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    if (!ctx.isAdmin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
    }

    const parsed = createOpportunitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid opportunity data.' }, { status: 400 });
    }

    const created = await createOpportunity(db, parsed.data, ctx.uid);
    return NextResponse.json({ id: created.id, state: created.state }, { status: 201 });
  } catch {
    console.error('[core/opportunities] create failed');
    return NextResponse.json({ error: 'Could not create the opportunity.' }, { status: 500 });
  }
}
