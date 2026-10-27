import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { type OrderReviewDoc } from '@/lib/reviews';
import { type Business } from '@/lib/business/types';
import { resolveEffectiveVerification } from '@/lib/verification';
import { tierForCompletedTransactions, type AccountTier } from '@/lib/tiers';
import { pbGetShop } from '@/lib/pocketbase/shops';

/**
 * THE PUBLIC BUSINESS OF A SELLER.
 *
 * ## Why the website needs this and cannot do it in the browser
 *
 * The public shop page used to hardcode `rating: 0, reviewsCount: 0`. That was
 * not a placeholder waiting to be filled — it rendered, so every business on
 * the open web showed as a brand-new shop with no history. The trust signals we
 * already store were invisible precisely where a stranger is deciding whether to
 * hand over money.
 *
 * Fixing that needs three things the client cannot do:
 *   - find the business (membership lives in an array of objects, which
 *     Firestore cannot query), so we read `sellerShops/{uid}.businessId`;
 *   - aggregate reviews, ignoring flagged and removed ones so a reported review
 *     cannot move a score;
 *   - decide what is safe to show a stranger.
 *
 * ## The privacy line, drawn once
 *
 * The response carries an **approximate** location — an area name, and a distance
 * only when the caller's own location is known. `lat` and `lng` are never in this
 * payload, in any field, for any business. The address of a home-based seller
 * does not become public because someone opened their shop page.
 */

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sellerId: string }> },
) {
  const { sellerId } = await params;
  if (!sellerId) return NextResponse.json({ error: 'Missing seller' }, { status: 400 });

  try {
    // The shop record, VPS copy first: this endpoint only needs
    // `sellerShops/{uid}.businessId`, and the mirror is refreshed by every
    // seller save — so a Firestore outage can no longer hide a storefront's
    // business page. Firestore stays the fallback (and the source the mirror
    // is copied from).
    const mirroredShop = await pbGetShop(sellerId);
    let shop: Record<string, any> | null = mirroredShop?.data ?? null;
    if (!shop) {
      const shopSnap = await db.collection('sellerShops').doc(sellerId).get();
      if (!shopSnap.exists) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      shop = shopSnap.data() as Record<string, any>;
    }

    // The account's verification status, read in the same round trip as the
    // shop. The admin queue approves THIS field, so without it an approval
    // would never reach the badge.
    const accountSnap = await db.collection('userProfiles').doc(sellerId).get();
    const accountData = accountSnap.data() as
      | { verificationStatus?: unknown; accountTier?: AccountTier }
      | undefined;
    const accountStatus = accountData?.verificationStatus;

    const businessId: string | undefined = shop.businessId;
    if (!businessId) {
      // A shop that predates the Business entity. Say so plainly rather than
      // inventing a rating or showing a verification we never granted.
      return NextResponse.json({
        business: null,
        reviews: { average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
        reviewsList: [],
      });
    }

    const bizSnap = await db.collection('businesses').doc(businessId).get();
    if (!bizSnap.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const business = bizSnap.data() as Business;

    // The score comes from `ratingSummaries/{sellerId}`, one document the write
    // path already maintains. Reading it instead of aggregating every review
    // keeps this endpoint O(1) in the size of the review history — the earlier
    // version scanned the whole `reviews` collection, which on a marketplace
    // with thousands of orders is a full-collection read on every page view.
    //
    // The LIST still reads reviews, because there is no query that gets "reviews
    // about this seller" out of a collection keyed by order id. That is the one
    // remaining shape to fix, and it wants a per-seller subcollection.
    const [summarySnap, reviewSnap] = await Promise.all([
      db.collection('ratingSummaries').doc(sellerId).get(),
      db.collection('reviews').get(),
    ]);

    const summaryData = summarySnap.data() as
      | { sellerRatingTotal?: number; sellerRatingCount?: number }
      | undefined;
    const count = summaryData?.sellerRatingCount ?? 0;
    const average = count
      ? Math.round(((summaryData?.sellerRatingTotal ?? 0) / count) * 100) / 100
      : 0;

    const reviewsList: {
      id: string;
      rating: number;
      text: string;
      createdAt: any;
      authorName: string;
      businessReply?: string;
    }[] = [];
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const d of reviewSnap.docs) {
      const docData = d.data() as OrderReviewDoc & Record<string, any>;
      const byCustomer = docData.byCustomer;
      // This review must be about THIS seller — the collection is shared by
      // every order on the platform.
      if (!byCustomer || docData.sellerId !== sellerId) continue;

      // A removed or flagged review stays hidden until moderation decides, and
      // must not count toward the distribution the list shows.
      if (byCustomer.status === 'removed' || byCustomer.status === 'flagged') continue;

      if (byCustomer.rating >= 1 && byCustomer.rating <= 5) {
        distribution[byCustomer.rating as 1 | 2 | 3 | 4 | 5]++;
      }
      reviewsList.push({
        id: d.id,
        rating: byCustomer.rating,
        text: byCustomer.text,
        createdAt: byCustomer.createdAt,
        authorName: byCustomer.authorName || 'A customer',
        businessReply: docData.bySeller?.text,
      });
    }

    reviewsList.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });

    // No visitor location comes to this server, deliberately. The browser
    // already holds the visitor's own position and can compute "2.1 km away"
    // locally; sending it here would only add a coordinate to a request log to
    // produce a number the client can make itself. So we return the AREA and
    // the client renders the distance it can already see.
    const loc = business.primaryLocation;
    const verification = resolveEffectiveVerification(
      business.verificationStatus,
      accountStatus,
    );

    // The tier is computed here from the seller's own delivered orders rather
    // than read from a stored field. A badge that a document can disagree with
    // is a badge that can be wrong, and this endpoint is what a buyer sees.
    const sellerOrders = await db
      .collection('orders')
      .where('sellerId', '==', sellerId)
      .where('orderStatus', 'in', ['delivered'])
      .get();
    const tier = tierForCompletedTransactions(sellerOrders.size);

    return NextResponse.json({
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        kind: business.kind,
        category: business.category,
        verificationStatus: verification.status,
        /**
         * Not rendered — it exists so the two can be told apart while
         * businesses are migrated to carrying their own status. Surfacing it
         * would tell a buyer which kind of badge they are looking at, which is
         * not a buyer's problem to solve.
         */
        verificationSource: verification.source,
        reputationScore: business.reputationScore ?? null,
        /** Area names only. `lat`/`lng` are not in this payload at any precision. */
        areaName: loc?.areaName ?? null,
        cityName: loc?.cityName ?? null,
        serviceRadiusKm: loc?.serviceRadiusKm ?? null,
        serves: (loc?.servesAreaIds ?? [])
          .map((id) => id.split('.').pop()?.replace(/-/g, ' '))
          .filter(Boolean)
          .slice(0, 8),
        memberCount: business.members?.length ?? 0,
        /** Automatic, from delivered orders. The account's stored copy is ignored on purpose. */
        tier,
        completedTransactions: sellerOrders.size,
      },
      reviews: { average, count, distribution },
      reviewsList: reviewsList.slice(0, 50),
    });
  } catch (error) {
    console.error('[public/business] failed', error);
    return NextResponse.json({ error: 'Could not load this business' }, { status: 500 });
  }
}
