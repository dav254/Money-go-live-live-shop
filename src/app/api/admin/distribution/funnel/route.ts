/**
 * GET /api/admin/distribution/funnel — the growth funnel, admin view.
 *
 * Exposure → visit → enquiry → offer → order → confirmed revenue, read from
 * the EXISTING event spine, requests/offers and orders collections. This is
 * the endpoint that answers "did the exposure turn into business?" with one
 * honest chain instead of disconnected counters.
 *
 * Authorization: `verifyAdminUid` — the same server-side admin definition
 * every other admin route uses. Query: `days` (1–90, default 30), schema
 * validated, strict (unknown keys are rejected).
 *
 * Rules: every number is a real measurement (`null` = unknown, never a
 * fabricated zero); money buckets are separated (GMV vs delivered revenue vs
 * pending vs disputed); exposure never becomes money; responses carry no
 * seller payloads, credentials or env values.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import { readGrowthFunnel } from '@/lib/vidnov-core/distribution/funnel';
import { growthFunnelQuerySchema } from '@/lib/vidnov-core/validation';

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const parsed = growthFunnelQuerySchema.safeParse({
    days: request.nextUrl.searchParams.get('days') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid funnel window.' }, { status: 400 });
  }

  try {
    const funnel = await readGrowthFunnel(db, parsed.data.days ?? 30);
    return NextResponse.json({ funnel });
  } catch {
    // No error objects in logs — internal details stay server-side only.
    console.error('[core/distribution] funnel read failed');
    return NextResponse.json({ error: 'Funnel data could not be read.' }, { status: 500 });
  }
}
