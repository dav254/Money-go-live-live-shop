/**
 * GET /api/admin/shop-agent/candidates — bounded candidate list for review.
 *
 * Admin-gated server-side. Optional `?stage=` filter (closed enum) and
 * `?limit=` (≤200). Every row carries the stored source attribution and the
 * server-computed eligibility snapshot — nothing here is client-supplied.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import { listCandidates } from '@/lib/vidnov-core/shop-agent/service';
import { candidateQuerySchema } from '@/lib/vidnov-core/shop-agent/schemas';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const parsed = candidateQuerySchema.safeParse({
    stage: request.nextUrl.searchParams.get('stage') ?? undefined,
    limit: request.nextUrl.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query.' }, { status: 400 });

  try {
    const candidates = await listCandidates(db, parsed.data);
    return NextResponse.json({ candidates });
  } catch {
    console.error('[shop-agent] candidate list failed');
    return NextResponse.json({ error: 'Candidates unavailable.' }, { status: 500 });
  }
}
