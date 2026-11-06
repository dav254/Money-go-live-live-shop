/**
 * GET /api/admin/discover-demand — the discovery demand report.
 *
 * Answers, from real documents only:
 *   • searches by category / by location
 *   • searches that returned nothing (the supply gap)
 *   • seller registrations, and how many became a completed public shop
 *   • published listings (products vs services)
 *
 * Every scan is bounded and each block reports whether it hit its ceiling, so
 * the numbers are never quietly presented as exact when they are "at least".
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { isAdminUid } from '@/lib/server/admin-guard';
import { DEMAND_COLLECTION, summarizeDemand, type DemandDoc } from '@/lib/discover/demand';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEMAND_WINDOW = 800;
const PROFILE_WINDOW = 1000;
const SHOP_WINDOW = 1000;
const PRODUCT_WINDOW = 1000;

export async function GET(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const isAdmin = user.isAdmin || (await isAdminUid(user.uid));
  if (!isAdmin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const [demandSnap, profileSnap, shopSnap, productSnap] = await Promise.all([
      db.collection(DEMAND_COLLECTION).orderBy('day', 'desc').limit(DEMAND_WINDOW).get(),
      db.collection('userProfiles').where('userRole', '==', 'seller').limit(PROFILE_WINDOW).get(),
      db.collection('sellerShops').limit(SHOP_WINDOW).get(),
      db.collection('products').limit(PRODUCT_WINDOW).get(),
    ]);

    const demandDocs: DemandDoc[] = demandSnap.docs.map((doc) => {
      const data = doc.data() ?? {};
      return {
        day: typeof data.day === 'string' ? data.day : '',
        category: typeof data.category === 'string' ? data.category : 'all',
        location: typeof data.location === 'string' ? data.location : 'anywhere',
        zeroResults: data.zeroResults === true,
        count: typeof data.count === 'number' && Number.isFinite(data.count) ? data.count : 0,
      };
    });

    const summary = summarizeDemand(demandDocs);

    let suspended = 0;
    for (const doc of profileSnap.docs) {
      if (doc.get('status') === 'suspended') suspended += 1;
    }
    const registeredSellers = profileSnap.size - suspended;

    let completedShops = 0;
    for (const doc of shopSnap.docs) {
      const name = doc.get('shopName');
      const description = doc.get('description');
      const logo = doc.get('logoUrl');
      const banner = doc.get('bannerUrl');
      if (
        typeof name === 'string' &&
        name.trim() &&
        typeof description === 'string' &&
        description.trim() &&
        ((typeof logo === 'string' && logo.trim()) ||
          (typeof banner === 'string' && banner.trim()))
      ) {
        completedShops += 1;
      }
    }

    let publishedListings = 0;
    let publishedServices = 0;
    let unpublished = 0;
    for (const doc of productSnap.docs) {
      if (doc.get('unpublished') === true) {
        unpublished += 1;
        continue;
      }
      publishedListings += 1;
      if (doc.get('listingType') === 'service') publishedServices += 1;
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      demand: {
        ...summary,
        zeroResultRate:
          summary.totalSearches === 0
            ? 0
            : Math.round((summary.zeroResultSearches / summary.totalSearches) * 1000) / 10,
        windowCapped: demandSnap.size >= DEMAND_WINDOW,
      },
      sellers: {
        registeredSellers,
        suspended,
        completedShops,
        /** Registered but not yet a complete public shop — the onboarding gap. */
        incompleteShops: Math.max(registeredSellers - completedShops, 0),
        windowCapped: profileSnap.size >= PROFILE_WINDOW || shopSnap.size >= SHOP_WINDOW,
      },
      catalogue: {
        publishedListings,
        publishedServices,
        unpublished,
        windowCapped: productSnap.size >= PRODUCT_WINDOW,
      },
    });
  } catch {
    console.error('[discover] demand report failed');
    return NextResponse.json({ error: 'The report could not be built.' }, { status: 503 });
  }
}
