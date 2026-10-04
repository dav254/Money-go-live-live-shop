import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { db } from '@/firebase/server';
import {
  customerLocationLabel,
  customerMatchesBusiness,
  customerToBusinessDistanceKm,
  hasUsableCustomerLocation,
  publicCustomerLocation,
  type CustomerLocation,
} from '@/lib/locations/customer';
import { approximateLocationFor } from '@/lib/business/location';
import { resolveEffectiveVerification } from '@/lib/verification';
import { COUNTED_ORDER_STATUSES, tierForCompletedTransactions } from '@/lib/tiers';

/**
 * WHAT IS NEAR ME.
 *
 * ## The customer's coordinates never arrive in a request
 *
 * The client sends no location at all. The server reads it from the caller's
 * own profile. That is not a micro-optimisation: a coordinate in a query string
 * is a coordinate in a proxy log, a browser history entry and an analytics
 * trail, and this endpoint is the one place it would have to be passed around.
 * Reading it server-side means the only way to move it is for the customer to
 * change it deliberately.
 *
 * ## Matching is by COVERAGE, not by nearness
 *
 * The single most important line below is `customerMatchesBusiness`. A barber
 * 200 m away in Kasarani is not a result for someone in Mombasa, and a shop
 * with no declared coverage is not a result for anyone. Proximity alone is not
 * relevance — the spec's own rule is LOCATION + CATEGORY + RELEVANCE, and this
 * endpoint enforces the location half honestly rather than sorting everything by
 * distance and calling it a marketplace.
 *
 * ## Unmapped customers still work
 *
 * No `areaId` — Lagos, London, anywhere — is a normal state. Those customers
 * are matched on coordinates when the business published one, and the response
 * says so plainly instead of returning an error or an empty screen.
 */

export const dynamic = 'force-dynamic';

const MAX_RESULTS = 40;

export async function GET(request: Request) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    uid = decoded.uid || '';
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const radiusParam = Number(url.searchParams.get('radiusKm'));
  const radiusKm = Number.isFinite(radiusParam) && radiusParam > 0 ? radiusParam : null;

  try {
    const profileSnap = await db.collection('userProfiles').doc(uid).get();
    const customer = (profileSnap.data()?.location ?? null) as CustomerLocation | null;

    if (!hasUsableCustomerLocation(customer)) {
      return NextResponse.json({
        needsLocation: true,
        message: 'Tell us your area to see what is near you.',
        businesses: [],
        listings: [],
      });
    }

    const bizSnap = await db.collection('businesses').get();
    const businesses = bizSnap.docs.map((d) => ({ ...(d.data() as any), id: d.id }));

    // Same split as the public shop endpoint: the admin queue approves the
    // ACCOUNT's status, so reading only the business's would show an approved
    // seller as unverified on the one screen where a buyer is choosing between
    // them.
    const ownerStatuses = new Map<string, unknown>();
    await Promise.all(
      [...new Set(businesses.map((b) => b.ownerId).filter(Boolean))].map(async (ownerId) => {
        const snap = await db.collection('userProfiles').doc(ownerId).get();
        ownerStatuses.set(ownerId, (snap.data() as any)?.verificationStatus);
      }),
    );

    // The tier badge, for the same reason the verification status is resolved
    // here rather than read straight off the business: a buyer choosing between
    // sellers is exactly where the badge has to be right. One query over
    // delivered orders, not one per business — this endpoint runs for every
    // customer who opens Nearby, and an N+1 over the whole order collection is
    // how a read-quota problem starts.
    const deliveredSnap = await db
      .collection('orders')
      .where('orderStatus', 'in', [...COUNTED_ORDER_STATUSES])
      .get();
    const sellerTotals = new Map<string, number>();
    for (const doc of deliveredSnap.docs) {
      const order = doc.data() as { sellerId?: string };
      if (!order.sellerId) continue;
      sellerTotals.set(order.sellerId, (sellerTotals.get(order.sellerId) ?? 0) + 1);
    }

    const matched = businesses.filter((b) =>
      customerMatchesBusiness(customer, {
        areaId: b.primaryLocation?.areaId,
        cityId: b.primaryLocation?.cityId,
        servesAreaIds: b.primaryLocation?.servesAreaIds,
        serviceRadiusKm: b.primaryLocation?.serviceRadiusKm,
        lat: b.primaryLocation?.lat,
        lng: b.primaryLocation?.lng,
      }),
    );

    // Ranked by distance where we can measure it, otherwise by name so the
    // order is at least stable rather than Firestore's arbitrary one.
    const withDistance = matched.map((b) => ({
      ...b,
      _distanceKm: customerToBusinessDistanceKm(customer, b.primaryLocation),
    }));
    withDistance.sort((a, b) => {
      if (a._distanceKm === null && b._distanceKm === null) return a.name.localeCompare(b.name);
      if (a._distanceKm === null) return 1;
      if (b._distanceKm === null) return -1;
      return a._distanceKm - b._distanceKm;
    });

    const withinRadius = radiusKm
      ? withDistance.filter((b) => b._distanceKm === null || b._distanceKm <= radiusKm)
      : withDistance;

    const ids = new Set(withinRadius.map((b) => b.id));

    // Listings follow their business. A listing with no businessId predates the
    // entity and is skipped rather than guessed onto a seller.
    const productsSnap = await db.collection('products').get();
    const listings = productsSnap.docs
      .map((d) => ({ ...(d.data() as any), id: d.id }))
      .filter((p) => p.businessId && ids.has(p.businessId))
      .slice(0, MAX_RESULTS)
      .map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        imageUrl: p.imageUrl,
        businessId: p.businessId,
        category: p.category,
        location: p.location,
        listingType: p.listingType,
      }));

    return NextResponse.json({
      needsLocation: false,
      /** What the customer sees about themselves. */
      yourArea: customerLocationLabel(customer),
      /** What a business may ever be told. No coordinates in here, ever. */
      sharedWithBusinesses: publicCustomerLocation(customer),
      businesses: withinRadius.slice(0, MAX_RESULTS).map((b) => ({
        id: b.id,
        // The seller uid, so a result can be linked and can fetch its public
        // trust panel. `id` alone is the business id and the public endpoint is
        // keyed by seller — passing one where the other is expected is a 404
        // that looks like "no reviews" rather than like a mistake.
        sellerId: b.ownerId,
        name: b.name,
        slug: b.slug,
        kind: b.kind,
        category: b.category,
        verificationStatus: resolveEffectiveVerification(
          b.verificationStatus,
          ownerStatuses.get(b.ownerId),
        ).status,
        rating: b.reputation?.averageRating ?? null,
        /** Automatic, earned from delivered orders. Absent means no history. */
        tier: tierForCompletedTransactions(sellerTotals.get(b.ownerId) ?? 0),
        completedTransactions: sellerTotals.get(b.ownerId) ?? 0,
        // The precise point never appears here.
        approximateLocation: approximateLocationFor(b.primaryLocation, b._distanceKm),
        distanceKm: b._distanceKm,
      })),
      listings,
    });
  } catch (error) {
    console.error('[nearby] failed', error);
    return NextResponse.json({ error: 'Could not load what is near you' }, { status: 500 });
  }
}
