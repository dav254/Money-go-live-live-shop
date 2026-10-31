/**
 * /api/admin/requests — Buyer Request Management API (spec §6 + §8).
 *
 * GET  → bounded analytics for the admin page: request states, no-offer
 *        demand, popular categories, demand by location, time-to-first-offer,
 *        offer→order conversion, spam reports, and the moderation queues.
 * PATCH→ moderation actions (close / reopen / delete / clear reports / decline
 *        an offer) written by an ADMIN acting on someone else's content, so
 *        every action lands in `activityLogs` with actor + target + reason.
 *
 * Security: admin gate FIRST (`verifyAdminUid`), before the body is read.
 * Every figure is derived from bounded scans (≤400 docs) — this route is a
 * dashboard, not an analytics warehouse, and it must never full-scan.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import { db } from '@/firebase/server';
import { REQUESTS_COLLECTION, OFFERS_COLLECTION } from '@/lib/media/config';
import type { MarketplaceRequest, MarketplaceOffer } from '@/lib/requests/types';
import { isExpired, expiryFor } from '@/lib/requests/request-service';
import { pbPatchOffer } from '@/lib/pocketbase/requests';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCAN_LIMIT = 400;
const QUEUE_LIMIT = 40;

interface RequestStats {
  total: number;
  open: number;
  openNoOffers: number;
  openWithOffers: number;
  expired: number;
  closed: number;
  deleted: number;
  reported: number;
  categories: Array<{ category: string; count: number }>;
  locations: Array<{ location: string; count: number }>;
  offers: { total: number; submitted: number; accepted: number; declined: number; draft: number };
  conversion: { acceptedOffers: number; submittedBase: number; rate: number | null };
  timeToFirstOffer: { samples: number; covered: number; averageHours: number | null };
  reports: Array<{
    kind: 'request' | 'offer';
    id: string;
    targetId: string;
    title: string;
    reports: number;
    reason: string;
    at: string;
  }>;
  recentAudit: Array<{ action: string; targetId: string; actorUid: string; detail: string; at: string }>;
}

async function countOffersByStatus(): Promise<RequestStats['offers']> {
  const col = db.collection(OFFERS_COLLECTION);
  const [submitted, accepted, declined, draft] = await Promise.all([
    col.where('status', '==', 'submitted').count().get(),
    col.where('status', '==', 'accepted').count().get(),
    col.where('status', '==', 'declined').count().get(),
    col.where('status', '==', 'draft').count().get(),
  ]);
  const submittedN = submitted.data().count;
  const acceptedN = accepted.data().count;
  const declinedN = declined.data().count;
  const draftN = draft.data().count;
  return {
    total: submittedN + acceptedN + declinedN + draftN,
    submitted: submittedN,
    accepted: acceptedN,
    declined: declinedN,
    draft: draftN,
  };
}

async function buildStats(): Promise<RequestStats> {
  const scan = await db
    .collection(REQUESTS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(SCAN_LIMIT)
    .get();

  const s: RequestStats = {
    total: 0,
    open: 0,
    openNoOffers: 0,
    openWithOffers: 0,
    expired: 0,
    closed: 0,
    deleted: 0,
    reported: 0,
    categories: [],
    locations: [],
    offers: { total: 0, submitted: 0, accepted: 0, declined: 0, draft: 0 },
    conversion: { acceptedOffers: 0, submittedBase: 0, rate: null },
    timeToFirstOffer: { samples: 0, covered: 0, averageHours: null },
    reports: [],
    recentAudit: [],
  };

  const categoryCounts = new Map<string, number>();
  const locationCounts = new Map<string, number>();
  const firstOfferGaps: number[] = [];

  scan.forEach((doc) => {
    const r = { ...(doc.data() as MarketplaceRequest), id: doc.id };
    if (r.status === 'deleted') {
      s.deleted += 1;
      return;
    }
    s.total += 1;

    const reports = Array.isArray(r.reports) ? r.reports : [];
    if (reports.length > 0) {
      s.reported += 1;
      s.reports.push({
        kind: 'request',
        id: r.id,
        targetId: r.id,
        title: r.title,
        reports: reports.length,
        reason: reports[reports.length - 1]?.reason ?? '',
        at: reports[reports.length - 1]?.at ?? '',
      });
    }

    if (r.status === 'active' && !r.acceptedOfferId) {
      if (isExpired(r)) {
        s.expired += 1;
      } else {
        s.open += 1;
        if ((r.offersCount ?? 0) === 0) s.openNoOffers += 1;
        else s.openWithOffers += 1;
        categoryCounts.set(r.category, (categoryCounts.get(r.category) ?? 0) + 1);
        const loc = (r.location ?? '').trim();
        if (loc) locationCounts.set(loc, (locationCounts.get(loc) ?? 0) + 1);
      }
    } else {
      s.closed += 1;
    }

    // Reliable-only metric: `firstOfferAt` is stamped when the first offer
    // lands, so coverage is reported next to the average instead of being
    // presented as if it covered every request.
    if (r.firstOfferAt && r.createdAt) {
      const created = toMs(r.createdAt);
      const first = toMs(r.firstOfferAt);
      if (created && first && first >= created) {
        firstOfferGaps.push(first - created);
      }
    }
    s.timeToFirstOffer.covered += 1;
  });

  s.categories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([category, count]) => ({ category, count }));
  s.locations = [...locationCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([location, count]) => ({ location, count }));

  if (firstOfferGaps.length > 0) {
    const avg = firstOfferGaps.reduce((a, b) => a + b, 0) / firstOfferGaps.length;
    s.timeToFirstOffer.averageHours = Math.round((avg / 3_600_000) * 10) / 10;
    s.timeToFirstOffer.samples = firstOfferGaps.length;
  }

  s.offers = await countOffersByStatus();
  const base = s.offers.submitted + s.offers.accepted + s.offers.declined;
  s.conversion = {
    acceptedOffers: s.offers.accepted,
    submittedBase: base,
    rate: base > 0 ? Math.round((s.offers.accepted / base) * 1000) / 10 : null,
  };

  // Offer-side reports: bounded scan, newest first.
  const offerScan = await db
    .collection(OFFERS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(SCAN_LIMIT)
    .get();
  offerScan.forEach((doc) => {
    const o = { ...(doc.data() as MarketplaceOffer), id: doc.id };
    const reports = Array.isArray(o.reports) ? o.reports : [];
    if (reports.length === 0) return;
    s.reports.push({
      kind: 'offer',
      id: o.id,
      targetId: o.requestId,
      title: o.message.slice(0, 80),
      reports: reports.length,
      reason: reports[reports.length - 1]?.reason ?? '',
      at: reports[reports.length - 1]?.at ?? '',
    });
  });
  s.reports.sort((a, b) => (b.at > a.at ? 1 : -1));
  s.reports = s.reports.slice(0, QUEUE_LIMIT);

  const audit = await db
    .collection('activityLogs')
    .where('category', '==', 'REQUEST_ENGINE')
    .orderBy('at', 'desc')
    .limit(QUEUE_LIMIT)
    .get();
  s.recentAudit = audit.docs.map((d) => {
    const data = d.data() as { action?: string; targetId?: string; actorUid?: string; detail?: string; at?: string };
    return {
      action: data.action ?? '',
      targetId: data.targetId ?? '',
      actorUid: data.actorUid ?? '',
      detail: data.detail ?? '',
      at: data.at ?? '',
    };
  });

  return s;
}

function toMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  const ts = value as { toDate?: () => Date; seconds?: number };
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const [stats, openRequests] = await Promise.all([
      buildStats(),
      db
        .collection(REQUESTS_COLLECTION)
        .where('status', '==', 'active')
        .orderBy('createdAt', 'desc')
        .limit(QUEUE_LIMIT)
        .get(),
    ]);
    const queue = openRequests.docs.map((d) => {
      const r = { ...(d.data() as MarketplaceRequest), id: d.id };
      return {
        id: r.id,
        requestNumber: r.requestNumber ?? r.id.slice(0, 8).toUpperCase(),
        title: r.title,
        category: r.category,
        location: r.location ?? '',
        offers: r.offersCount ?? 0,
        reports: Array.isArray(r.reports) ? r.reports.length : 0,
        status: r.status,
        expired: isExpired(r),
        expiresAt: r.expiresAt ?? null,
        createdAt: toMs(r.createdAt),
      };
    });
    return NextResponse.json({ stats, queue });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

async function writeAudit(
  adminUid: string,
  action: string,
  target: 'request' | 'offer',
  targetId: string,
  detail: string,
): Promise<void> {
  await db.collection('activityLogs').add({
    category: 'REQUEST_ENGINE',
    action,
    targetType: target,
    targetId,
    actorUid: adminUid,
    detail: detail.slice(0, 300),
    at: new Date().toISOString(),
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function PATCH(request: NextRequest) {
  // Admin gate BEFORE any body is parsed (admin-authz sweep asserts this).
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: {
    target?: 'request' | 'offer';
    id?: string;
    action?: string;
    reason?: string;
    requestId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const target = body.target === 'offer' ? 'offer' : 'request';
  const id = (body.id ?? '').trim();
  const action = (body.action ?? '').trim();
  const reason = (body.reason ?? '').trim().slice(0, 300);
  if (!id || !action) return NextResponse.json({ error: 'Missing id or action.' }, { status: 400 });
  if (action === 'delete' && reason.length < 5 && target === 'request') {
    return NextResponse.json({ error: 'A reason is required to delete content.' }, { status: 400 });
  }

  try {
    if (target === 'request') {
      const ref = db.collection(REQUESTS_COLLECTION).doc(id);
      const snap = await ref.get();
      if (!snap.exists) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
      const r = snap.data() as MarketplaceRequest;

      if (action === 'close') {
        await ref.update({
          status: 'closed',
          closedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else if (action === 'reopen') {
        if (r.acceptedOfferId) {
          return NextResponse.json({ error: 'This request already produced an order.' }, { status: 409 });
        }
        const past = r.expiresAt ? Date.parse(r.expiresAt) <= Date.now() : true;
        await ref.update({
          status: 'active',
          closedAt: null,
          ...(past ? { expiresAt: expiryFor(new Date()), expiryNoticeAt: null } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else if (action === 'delete') {
        await ref.update({
          status: 'deleted',
          closedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        // Hide the request's media too (private namespace, same as customer delete).
        const media = await db.collection('media').where('requestId', '==', id).get();
        const batch = db.batch();
        media.forEach((mdoc) => {
          batch.update(mdoc.ref, { status: 'DELETED', deletedAt: FieldValue.serverTimestamp() });
        });
        await batch.commit().catch(() => undefined);
      } else if (action === 'dismiss_reports') {
        await ref.update({ reports: [], updatedAt: FieldValue.serverTimestamp() });
      } else {
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
      }

      await writeAudit(adminUid, `request_${action}`, 'request', id, reason || `moderation: ${action}`);
      return NextResponse.json({ ok: true });
    }

    // Offer moderation — deleting/declining a spam offer never touches the
    // customer's request or its order state.
    const snap = await db.collection(OFFERS_COLLECTION).doc(id).get();
    if (!snap.exists) return NextResponse.json({ error: 'Offer not found.' }, { status: 404 });

    if (action === 'decline' || action === 'delete') {
      const offer = snap.data() as MarketplaceOffer;
      if (offer.status === 'accepted') {
        return NextResponse.json({ error: 'This offer became an order — it cannot be moderated away.' }, { status: 409 });
      }
      await db
        .collection(OFFERS_COLLECTION)
        .doc(id)
        .update({ status: 'declined', reports: [], updatedAt: FieldValue.serverTimestamp() });
      // Keep the mirrored VPS copy in step with the moderation decision.
      void pbPatchOffer(id, { status: 'declined', reports: [], updatedAt: new Date().toISOString() });
    } else if (action === 'dismiss_reports') {
      await db.collection(OFFERS_COLLECTION).doc(id).update({
        reports: [],
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    }

    await writeAudit(adminUid, `offer_${action}`, 'offer', id, reason || `moderation: ${action}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
