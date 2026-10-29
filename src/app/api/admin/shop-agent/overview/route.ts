/**
 * GET /api/admin/shop-agent/overview — Control Center data source.
 *
 * Admin-gated server-side (403 for everyone else). Returns the campaign
 * controls, the honest stage/message/attribution funnel, provider readiness
 * (status derived from real configuration — never "connected" because a key
 * exists) and the pilot scout configuration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import { readShopAgentFunnel } from '@/lib/vidnov-core/shop-agent/funnel';
import { getCampaign } from '@/lib/vidnov-core/shop-agent/service';
import { outreachProviderStatuses } from '@/lib/vidnov-core/shop-agent/providers';
import {
  CAMPAIGN_TRACKING_ID,
  DEFAULT_CATEGORIES,
  PILOT_AREA,
} from '@/lib/vidnov-core/shop-agent/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const [campaign, funnel] = await Promise.all([
      getCampaign(db),
      readShopAgentFunnel(db, 30, CAMPAIGN_TRACKING_ID),
    ]);
    return NextResponse.json({
      campaign,
      funnel,
      providers: outreachProviderStatuses(),
      pilot: {
        area: PILOT_AREA,
        categories: [...DEFAULT_CATEGORIES],
        trackingCampaign: CAMPAIGN_TRACKING_ID,
      },
    });
  } catch {
    // Internal details stay server-side; the UI shows the safe message.
    console.error('[shop-agent] overview failed');
    return NextResponse.json({ error: 'Overview unavailable.' }, { status: 500 });
  }
}
