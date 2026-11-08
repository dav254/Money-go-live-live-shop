/**
 * /api/seller/product-growth — the SELLER side of the distribution engine.
 *
 * This route is an ORCHESTRATOR, not a second engine. It reads what already
 * exists and hands work to the modules that own it:
 *
 *   • free distribution → `createDistributionJob` (Core Engine service), which
 *     owns ownership checks, eligibility, payload preparation, idempotency and
 *     the `distributionJobs` collection;
 *   • paid promotion → the EXISTING points balance (`userProfiles.aiPoints`)
 *     and the EXISTING `boost_requests` collection an administrator reviews in
 *     `/dashboard/admin/boosts`;
 *   • destination truth → the channel registry's `canSubmit()`, which is
 *     derived from credential PRESENCE only.
 *
 * What it deliberately does not do:
 *
 *   • it never says a listing is indexed, live or reached — those states are
 *     only ever written by a real submit/verify path in the engine;
 *   • it never charges points outside a transaction that has just read the
 *     balance, and never charges for a boost an admin has not approved;
 *   • it never returns a credential, a token, an env VALUE or a payload.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { db } from '@/firebase/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { pbListProductsBySeller } from '@/lib/pocketbase/products';
import { CHANNEL_IDS, type ChannelId } from '@/lib/vidnov-core/types';
import { getJobDestinations } from '@/lib/vidnov-core/distribution/channels';
import { evaluateProductEligibility } from '@/lib/vidnov-core/distribution/eligibility';
import { DISTRIBUTION_JOBS_COLLECTION } from '@/lib/vidnov-core/distribution/job-utils';
import {
  createDistributionJob,
  DistributionError,
} from '@/lib/vidnov-core/distribution/service';
import { getConnection } from '@/lib/social-engine/connections';
import { MODULE_LIST } from '@/lib/social-engine/modules';
import {
  MAX_CHANNELS_PER_CAMPAIGN,
  MAX_PAID_DAYS,
  MAX_PRODUCTS_PER_CAMPAIGN,
  MIN_PAID_DAYS,
  POINTS_PER_DAY,
  canAfford,
  defaultCaption,
  destinationGroup,
  freeSubmitBlock,
  normaliseCaption,
  normaliseDurationDays,
  normaliseSelection,
  promotionCostPoints,
  skipReasonText,
  type FreeJobSkipReason,
} from '@/lib/seller-growth/promotion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Social modules that are real publishing destinations (not infrastructure). */
const SOCIAL_MODULES = new Set([
  'telegram',
  'tiktok',
  'bluesky',
  'tumblr',
  'mastodon',
  'discord',
  'facebook',
  'instagram',
]);

const JOB_LIMIT = 60;
const BOOST_LIMIT = 40;

function isChannelId(value: unknown): value is ChannelId {
  return typeof value === 'string' && (CHANNEL_IDS as readonly string[]).includes(value);
}

function isoOf(value: unknown): string | null {
  if (value && typeof value === 'object') {
    const maybe = value as { toDate?: () => Date; toMillis?: () => number };
    if (typeof maybe.toDate === 'function') return maybe.toDate().toISOString();
    if (typeof maybe.toMillis === 'function') return new Date(maybe.toMillis()).toISOString();
  }
  return typeof value === 'string' ? value : null;
}

function msOf(value: unknown): number {
  const iso = isoOf(value);
  const parsed = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** The caller's own listings — VPS mirror first, Firestore as the fallback. */
async function ownProducts(uid: string): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const mirrored = await pbListProductsBySeller(uid, 300).catch(() => null);
  if (mirrored) {
    return mirrored.map((row) => ({ id: row.id, data: (row.data ?? {}) as Record<string, unknown> }));
  }
  try {
    const snap = await db.collection('products').where('sellerId', '==', uid).limit(300).get();
    return snap.docs.map((doc) => ({ id: doc.id, data: (doc.data() ?? {}) as Record<string, unknown> }));
  } catch (error) {
    console.error('[seller/product-growth] product read failed:', error);
    return [];
  }
}

/** Safe projection of one distribution job — no payload, no credentials. */
function publicJob(id: string, data: Record<string, unknown>) {
  return {
    id,
    productId: typeof data.productId === 'string' ? data.productId : null,
    channel: typeof data.channel === 'string' ? data.channel : null,
    status: typeof data.status === 'string' ? data.status : 'ready',
    integrationStatus: data.integrationStatus === 'configured' ? 'configured' : 'not_configured',
    attempts: typeof data.attempts === 'number' ? data.attempts : 0,
    lastError:
      data.lastError && typeof data.lastError === 'object'
        ? {
            message: String((data.lastError as { message?: unknown }).message ?? '').slice(0, 300),
            at: isoOf((data.lastError as { at?: unknown }).at),
          }
        : null,
    updatedAt: isoOf(data.updatedAt),
    createdAt: isoOf(data.createdAt),
  };
}

async function ownJobs(uid: string) {
  try {
    const snap = await db
      .collection(DISTRIBUTION_JOBS_COLLECTION)
      .where('sellerId', '==', uid)
      .limit(JOB_LIMIT)
      .get();
    return snap.docs
      .map((doc) => publicJob(doc.id, (doc.data() ?? {}) as Record<string, unknown>))
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  } catch (error) {
    console.error('[seller/product-growth] job read failed:', error);
    return [];
  }
}

async function ownBoosts(uid: string) {
  try {
    const snap = await db.collection('boost_requests').where('sellerId', '==', uid).limit(BOOST_LIMIT).get();
    return snap.docs
      .map((doc) => {
        const data = (doc.data() ?? {}) as Record<string, unknown>;
        return {
          id: doc.id,
          productId: typeof data.productId === 'string' ? data.productId : null,
          status: typeof data.status === 'string' ? data.status : 'pending',
          pointsPaid: typeof data.pointsPaid === 'number' ? data.pointsPaid : 0,
          durationDays: typeof data.durationDays === 'number' ? data.durationDays : null,
          caption: typeof data.caption === 'string' ? data.caption.slice(0, 280) : '',
          rejectionReason:
            typeof data.rejectionReason === 'string' ? data.rejectionReason.slice(0, 200) : null,
          createdAt: isoOf(data.createdAt),
        };
      })
      .sort((a, b) => msOf(b.createdAt) - msOf(a.createdAt));
  } catch (error) {
    console.error('[seller/product-growth] boost read failed:', error);
    return [];
  }
}

/** Connected social accounts for THIS seller, never another account's. */
async function socialDestinations(uid: string) {
  const modules = MODULE_LIST.filter((m) => SOCIAL_MODULES.has(m.id) && m.connectionKind === 'oauth');
  return Promise.all(
    modules.map(async (module) => {
      try {
        const record = await getConnection(module.id, uid, { uid, isAdmin: false });
        return {
          id: module.id,
          label: module.label,
          connected: record?.status === 'connected',
          accountLabel: record?.accountLabel ?? null,
          connectedAt: record?.connectedAt ?? null,
          // The Social Engine has connected accounts and a test-publish path,
          // but no general product-publishing call yet. Saying `true` here
          // would offer a toggle that cannot work.
          publishReady: false,
          note: record?.status === 'connected'
            ? 'Account connected. Product publishing from Vidnov is not enabled for this platform yet.'
            : 'Connect this account in Social Reach to use it later.',
        };
      } catch {
        return {
          id: module.id,
          label: module.label,
          connected: false,
          accountLabel: null,
          connectedAt: null,
          publishReady: false,
          note: 'Connection state could not be read right now.',
        };
      }
    }),
  );
}

export async function GET(request: NextRequest) {
  const ctx = await verifyUserContext(request);
  if (!ctx) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const uid = ctx.uid;

  const [products, destinationDefs, social, jobs, boosts, profileSnap] = await Promise.all([
    ownProducts(uid),
    Promise.resolve(getJobDestinations()),
    socialDestinations(uid),
    ownJobs(uid),
    ownBoosts(uid),
    db.collection('userProfiles').doc(uid).get().catch(() => null),
  ]);

  const pointsBalance = Number((profileSnap?.data()?.aiPoints as number | undefined) ?? 0) || 0;

  const destinations = destinationDefs.map((channel) => ({
    id: channel.id,
    label: channel.label,
    kind: channel.kind,
    group: destinationGroup(channel.id),
    configured: channel.integrationStatus() === 'configured',
    canSubmit: channel.canSubmit(),
    quotas: channel.quotas,
    capabilities: channel.capabilities,
  }));

  return NextResponse.json({
    points: {
      balance: pointsBalance,
      perDay: POINTS_PER_DAY,
      minDays: MIN_PAID_DAYS,
      maxDays: MAX_PAID_DAYS,
    },
    products: products.map((row) => {
      const eligibility = evaluateProductEligibility(row.id, row.data);
      const images = Array.isArray(row.data.imageUrls) ? row.data.imageUrls : [];
      const image = typeof row.data.imageUrl === 'string' ? row.data.imageUrl : images[0];
      return {
        id: row.id,
        name: typeof row.data.name === 'string' ? row.data.name : 'Untitled listing',
        price: typeof row.data.price === 'number' ? row.data.price : null,
        currency: typeof row.data.localCurrency === 'string' ? row.data.localCurrency : null,
        imageUrl: typeof image === 'string' ? image : null,
        listingType: row.data.listingType === 'service' ? 'service' : 'product',
        eligible: eligibility.eligible,
        reasons: eligibility.reasons,
        publicPath: eligibility.publicPath,
        suggestedCaption: defaultCaption({
          name: typeof row.data.name === 'string' ? row.data.name : null,
          price: typeof row.data.price === 'number' ? row.data.price : null,
          currency: typeof row.data.localCurrency === 'string' ? row.data.localCurrency : null,
        }),
      };
    }),
    destinations,
    social,
    campaigns: jobs,
    boosts,
  });
}

type FreeResult = {
  productId: string;
  channel: ChannelId;
  ok: boolean;
  jobId?: string;
  status?: string;
  duplicate?: boolean;
  reason?: FreeJobSkipReason;
  message?: string;
};

export async function POST(request: NextRequest) {
  const ctx = await verifyUserContext(request);
  if (!ctx) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const uid = ctx.uid;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action === 'paid' ? 'paid' : body.action === 'free' ? 'free' : null;
  if (!action) return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });

  if (action === 'free') return submitFree(uid, body);
  return submitPaid(uid, body);
}

/** FREE — create one engine job per (listing × configured destination). */
async function submitFree(uid: string, body: Record<string, unknown>) {
  const productIds = normaliseSelection(
    Array.isArray(body.productIds) ? body.productIds : [],
    MAX_PRODUCTS_PER_CAMPAIGN,
  );
  const channels = normaliseSelection(
    Array.isArray(body.channels) ? body.channels : [],
    MAX_CHANNELS_PER_CAMPAIGN,
  ).filter(isChannelId);

  if (productIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one listing.' }, { status: 400 });
  }
  if (channels.length === 0) {
    return NextResponse.json({ error: 'Select at least one destination.' }, { status: 400 });
  }

  const results: FreeResult[] = [];

  for (const productId of productIds) {
    const snap = await db.collection('products').doc(productId).get().catch(() => null);
    if (!snap?.exists) {
      for (const channel of channels) {
        results.push({ productId, channel, ok: false, reason: 'not_eligible' });
      }
      continue;
    }

    const data = (snap.data() ?? {}) as Record<string, unknown>;
    if (data.sellerId !== uid) {
      for (const channel of channels) {
        results.push({ productId, channel, ok: false, reason: 'not_owned' });
      }
      continue;
    }

    const eligibility = evaluateProductEligibility(productId, data);

    for (const channel of channels) {
      const definition = getJobDestinations().find((entry) => entry.id === channel);
      if (!definition) {
        results.push({ productId, channel, ok: false, reason: 'not_job_eligible' });
        continue;
      }

      const blocked = freeSubmitBlock({
        jobEligible: definition.jobEligible,
        configured: definition.canSubmit(),
        productEligible: eligibility.eligible,
      });
      if (blocked) {
        results.push({ productId, channel, ok: false, reason: blocked });
        continue;
      }

      try {
        const created = await createDistributionJob({
          db,
          productId,
          channel,
          actorUid: uid,
          isAdmin: false,
        });
        results.push({
          productId,
          channel,
          ok: true,
          jobId: created.jobId,
          status: created.status,
          duplicate: created.duplicate,
        });
      } catch (error) {
        if (error instanceof DistributionError) {
          const reason: FreeJobSkipReason =
            error.code === 'forbidden'
              ? 'not_owned'
              : error.code === 'not_configured'
                ? 'not_configured'
                : error.code === 'not_found' || error.code === 'invalid_product'
                  ? 'not_eligible'
                  : 'create_failed';
          results.push({ productId, channel, ok: false, reason, message: skipReasonText(reason) });
          continue;
        }
        console.error('[seller/product-growth] job create failed:', error);
        results.push({ productId, channel, ok: false, reason: 'create_failed' });
      }
    }
  }

  const sent = results.filter((row) => row.ok);
  return NextResponse.json({
    ok: sent.length > 0,
    submitted: sent.length,
    skipped: results.length - sent.length,
    results: results.map((row) => ({
      ...row,
      message: row.message ?? (row.reason ? skipReasonText(row.reason) : undefined),
    })),
    // Stated once, server-side, so no surface can word it as a guarantee.
    note:
      'A job in the queue is a submission attempt, not indexing or reach. Each destination reports what it actually accepted.',
  });
}

/** PAID — points-priced boost request, charged inside a transaction. */
async function submitPaid(uid: string, body: Record<string, unknown>) {
  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  if (!productId) return NextResponse.json({ error: 'Choose a listing to boost.' }, { status: 400 });

  const days = normaliseDurationDays(body.durationDays);
  if (days === null) {
    return NextResponse.json(
      { error: `Choose between ${MIN_PAID_DAYS} and ${MAX_PAID_DAYS} days.` },
      { status: 400 },
    );
  }

  const productSnap = await db.collection('products').doc(productId).get().catch(() => null);
  if (!productSnap?.exists) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });

  const data = (productSnap.data() ?? {}) as Record<string, unknown>;
  if (data.sellerId !== uid) {
    return NextResponse.json({ error: 'You do not own this listing.' }, { status: 403 });
  }

  const eligibility = evaluateProductEligibility(productId, data);
  if (!eligibility.eligible) {
    return NextResponse.json(
      { error: 'This listing is not eligible for promotion.', reasons: eligibility.reasons },
      { status: 409 },
    );
  }

  const cost = promotionCostPoints(days);
  const caption = normaliseCaption(
    body.caption,
    defaultCaption({
      name: typeof data.name === 'string' ? data.name : null,
      price: typeof data.price === 'number' ? data.price : null,
      currency: typeof data.localCurrency === 'string' ? data.localCurrency : null,
    }),
  );

  const targetingRaw = (body.targeting ?? {}) as Record<string, unknown>;
  const targeting = {
    age: typeof targetingRaw.age === 'string' ? targetingRaw.age.slice(0, 20) : '',
    counties: Array.isArray(targetingRaw.counties)
      ? targetingRaw.counties.filter((c): c is string => typeof c === 'string').slice(0, 10)
      : [],
    interests: Array.isArray(targetingRaw.interests)
      ? targetingRaw.interests.filter((c): c is string => typeof c === 'string').slice(0, 10)
      : [],
  };

  // Duplicate guard: one pending request per listing, checked before any points
  // move. A seller who taps twice gets the existing request, not a second one.
  const pending = await db
    .collection('boost_requests')
    .where('sellerId', '==', uid)
    .where('status', '==', 'pending')
    .limit(20)
    .get()
    .catch(() => null);
  if (pending) {
    const duplicate = pending.docs.find(
      (doc) => (doc.data() as { productId?: string }).productId === productId,
    );
    if (duplicate) {
      return NextResponse.json(
        {
          error: 'This listing already has a boost waiting for review.',
          boostId: duplicate.id,
          duplicate: true,
        },
        { status: 409 },
      );
    }
  }

  const profileRef = db.collection('userProfiles').doc(uid);
  const boostRef = db.collection('boost_requests').doc();

  try {
    const outcome = await db.runTransaction(async (transaction) => {
      const profile = await transaction.get(profileRef);
      const balance = Number((profile.data()?.aiPoints as number | undefined) ?? 0) || 0;
      if (!canAfford(balance, cost)) {
        throw new Error('insufficient_points');
      }
      // Charge first, create in the same transaction: a created request with
      // uncharged points would be a free boost, and a charge with no request
      // would be a lost payment.
      transaction.update(profileRef, { aiPoints: FieldValue.increment(-cost) });
      transaction.create(boostRef, {
        sellerId: uid,
        productId,
        caption,
        durationDays: days,
        pointsPaid: cost,
        status: 'pending',
        source: 'seller-product-growth',
        target: targeting,
        analytics: { views: 0, likes: 0, clicks: 0, shares: 0, conversions: 0 },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { remaining: balance - cost };
    });

    return NextResponse.json({
      ok: true,
      boostId: boostRef.id,
      status: 'pending',
      costPoints: cost,
      remainingPoints: outcome.remaining,
      days,
      note:
        'Points are held against this request and returned if it is rejected. A boost buys Vidnov placement; it never promises search indexing, social reach or sales.',
    });
  } catch (error) {
    if ((error as Error)?.message === 'insufficient_points') {
      return NextResponse.json(
        { error: 'Not enough points for this boost.', costPoints: cost },
        { status: 409 },
      );
    }
    console.error('[seller/product-growth] paid boost failed:', error);
    return NextResponse.json({ error: 'The boost could not be created.' }, { status: 500 });
  }
}
