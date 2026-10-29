/**
 * /api/admin/shop-agent/campaign — campaign controls (pause / limits / ack).
 *
 * GET  → current campaign configuration + provider readiness.
 * POST → bounded patch (paused, complianceAcknowledged, senderName,
 *        dailyMessageLimit, dailyBudgetMinor). The campaign starts PAUSED
 *        and UNACKNOWLEDGED: sending is impossible until an admin
 *        deliberately acknowledges compliance and resumes it — and every
 *        message still needs its own approval on top of that.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import { outreachProviderStatuses } from '@/lib/vidnov-core/shop-agent/providers';
import { campaignPatchSchema } from '@/lib/vidnov-core/shop-agent/schemas';
import { getCampaign, updateCampaign } from '@/lib/vidnov-core/shop-agent/service';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const campaign = await getCampaign(db);
    return NextResponse.json({ campaign, providers: outreachProviderStatuses() });
  } catch {
    console.error('[shop-agent] campaign read failed');
    return NextResponse.json({ error: 'Campaign unavailable.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const raw = await request.json().catch(() => ({}));
  const parsed = campaignPatchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid campaign patch.' }, { status: 400 });

  try {
    const campaign = await updateCampaign(db, parsed.data, adminUid);
    return NextResponse.json({ campaign });
  } catch {
    console.error('[shop-agent] campaign update failed');
    return NextResponse.json({ error: 'Campaign update failed.' }, { status: 500 });
  }
}
