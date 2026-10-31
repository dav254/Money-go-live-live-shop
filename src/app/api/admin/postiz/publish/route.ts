import { NextResponse, type NextRequest } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { db } from '@/firebase/server';
import {
  getPostizConfig,
  postizCreatePost,
  postizListChannels,
  type PostizErrorClass,
} from '@/lib/postiz/client';
import {
  buildCampaignText,
  checkProductEligibility,
  outcomeForCreate,
  sanitizeNote,
} from '@/lib/postiz/content';
import { allowRequest, PUBLISH_LIMIT } from '@/lib/postiz/rate-limit';

export const runtime = 'nodejs';

const MAX_CHANNELS = 10;
const MIN_LEAD_MS = 2 * 60_000;
const MAX_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;

const publishWindows = new Map<string, number[]>();

/**
 * GET /api/admin/postiz/publish?productId=… — eligibility preview.
 *
 * Admin only. Reads the stored listing and reports whether it may enter a
 * campaign, with the exact share link. Nothing is sent to Postiz.
 */
export async function GET(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const productId = (new URL(request.url).searchParams.get('productId') ?? '').trim();
  if (!productId || productId.length > 128) {
    return NextResponse.json({ error: 'A productId is required.' }, { status: 400 });
  }

  try {
    const snap = await db.collection('products').doc(productId).get();
    if (!snap.exists) {
      return NextResponse.json({ exists: false, eligible: false, reason: 'missing' }, { status: 404 });
    }
    const raw = (snap.data() ?? {}) as Record<string, unknown>;
    const eligibility = checkProductEligibility(raw);
    const appUrl = (process.env.APP_URL || 'https://vidnov.com').replace(/\/+$/, '');
    return NextResponse.json({
      exists: true,
      name: typeof raw.name === 'string' ? raw.name : '',
      price: typeof raw.price === 'number' ? raw.price : null,
      currency: typeof raw.localCurrency === 'string' ? raw.localCurrency : '',
      ...eligibility,
      shareUrl: `${appUrl}/products/${encodeURIComponent(productId)}?ref=postiz`,
      preview: eligibility.eligible ? buildCampaignText({ productId, product: raw, appUrl }) : null,
    });
  } catch {
    return NextResponse.json({ error: 'Could not read the listing.' }, { status: 500 });
  }
}

/**
 * POST /api/admin/postiz/publish — stage a campaign post in Postiz.
 *
 * Admin only. Defaults to `draft` (never public); `scheduleAt` produces a
 * `schedule`. Vidnov NEVER sends `now`: publishing immediately is done by the
 * marketing team inside Postiz, not from this API.
 *
 * Body: { productId: string, channelIds: string[], note?: string, scheduleAt?: ISO }
 * Responses carry status `accepted | scheduled | failed` — never `published`.
 */
export async function POST(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: {
    productId?: unknown;
    channelIds?: unknown;
    note?: unknown;
    scheduleAt?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  if (!productId || productId.length > 128) {
    return NextResponse.json({ error: 'A productId is required.' }, { status: 400 });
  }

  const channelIds = Array.isArray(body.channelIds)
    ? [...new Set(body.channelIds.filter((c): c is string => typeof c === 'string' && !!c.trim()))].map(
        (c) => c.trim(),
      )
    : [];
  if (channelIds.length === 0 || channelIds.length > MAX_CHANNELS) {
    return NextResponse.json(
      { error: `Select between 1 and ${MAX_CHANNELS} channels.` },
      { status: 400 },
    );
  }

  const note = body.note !== undefined && body.note !== null && `${body.note}`.trim()
    ? sanitizeNote(`${body.note}`)
    : '';

  let type: 'draft' | 'schedule' = 'draft';
  let date = new Date().toISOString();
  if (body.scheduleAt !== undefined && body.scheduleAt !== null && `${body.scheduleAt}`.trim()) {
    const when = Date.parse(`${body.scheduleAt}`);
    const now = Date.now();
    if (!Number.isFinite(when)) {
      return NextResponse.json({ error: 'scheduleAt must be an ISO 8601 date.' }, { status: 400 });
    }
    if (when < now + MIN_LEAD_MS || when > now + MAX_AHEAD_MS) {
      return NextResponse.json(
        { error: 'scheduleAt must be between 2 minutes and 90 days from now.' },
        { status: 400 },
      );
    }
    type = 'schedule';
    date = new Date(when).toISOString();
  }

  // Per-admin window (see rate-limit.ts): protects the instance-wide budget.
  if (!allowRequest(user.uid, publishWindows, PUBLISH_LIMIT)) {
    return NextResponse.json(
      {
        ok: false,
        status: 'failed',
        errorClass: 'rate_limited',
        message: 'Too many publish attempts — wait a few minutes.',
      },
      { status: 429 },
    );
  }

  const config = getPostizConfig();
  if (!config) {
    return NextResponse.json(
      {
        ok: false,
        status: 'failed',
        errorClass: 'not_configured',
        message: 'Postiz is not configured on the server (POSTIZ_API_URL / POSTIZ_API_KEY missing).',
      },
      { status: 503 },
    );
  }

  // 1) The genuine listing — nothing else can enter a campaign.
  let product: Record<string, unknown>;
  try {
    const snap = await db.collection('products').doc(productId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
    }
    product = (snap.data() ?? {}) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Could not read the listing.' }, { status: 500 });
  }

  const eligibility = checkProductEligibility(product);
  if (!eligibility.eligible) {
    return NextResponse.json(
      { ok: false, status: 'failed', reason: eligibility.reason, message: 'This listing cannot enter a campaign.' },
      { status: 409 },
    );
  }

  // 2) Channels come from Postiz itself — the provider type (settings.__type)
  //    is never taken from the client, so a payload can never mislabel a post.
  const listing = await postizListChannels(config);
  if (!listing.ok) {
    return NextResponse.json(
      {
        ok: false,
        status: 'failed',
        errorClass: listing.errorClass,
        message: listing.message,
      },
      { status: 502 },
    );
  }
  const byId = new Map((listing.value ?? []).map((c) => [c.id, c]));
  const channels = channelIds.map((id) => byId.get(id)).filter(Boolean);
  if (channels.length !== channelIds.length) {
    return NextResponse.json(
      { ok: false, status: 'failed', errorClass: 'validation', message: 'One or more channels are unknown or not connected in Postiz.' },
      { status: 400 },
    );
  }
  const active = channels.filter((c) => c && !c.disabled);
  if (active.length !== channels.length) {
    return NextResponse.json(
      { ok: false, status: 'failed', errorClass: 'validation', message: 'One or more selected channels are disabled.' },
      { status: 400 },
    );
  }

  // 3) Render only stored facts + the human note.
  const appUrl = (process.env.APP_URL || 'https://vidnov.com').replace(/\/+$/, '');
  const content = buildCampaignText({
    productId,
    product,
    appUrl,
    ...(note ? { note } : {}),
  });

  // 4) Create (draft by default — never `now`).
  const result = await postizCreatePost(config, {
    type,
    date,
    content,
    channels: active.map((c) => ({ id: c!.id, identifier: c!.identifier })),
  });

  const outcome = result.ok ? outcomeForCreate(type) : 'failed';
  const postIds = result.ok ? (result.value ?? []).map((p) => p.postId) : [];

  // 5) Best-effort audit record (postizLog is admin-SDK-only; see firestore.rules).
  try {
    await db.collection('postizLog').add({
      at: new Date().toISOString(),
      createdAt: Date.now(),
      actorUid: user.uid,
      productId,
      productName: typeof product.name === 'string' ? product.name.slice(0, 200) : '',
      channels: active.map((c) => c!.identifier),
      channelCount: active.length,
      status: outcome,
      type,
      ...(type === 'schedule' ? { scheduledFor: date } : {}),
      ...(postIds.length ? { postIds } : {}),
      ...(result.errorClass ? { errorClass: result.errorClass } : {}),
      ...(note ? { note: note.slice(0, 200) } : {}),
    });
  } catch {
    // The attempt outcome below is authoritative; the log is supplementary.
  }

  console.log(
    `[postiz] uid=${user.uid} product=${productId} type=${type} status=${outcome}` +
      `${result.errorClass ? ` class=${result.errorClass}` : ''} posts=${postIds.length}`,
  );

  if (!result.ok) {
    const status =
      result.errorClass === 'rate_limited'
        ? 429
        : result.errorClass === 'not_configured'
          ? 503
          : 502;
    return NextResponse.json(
      {
        ok: false,
        status: 'failed',
        errorClass: (result.errorClass ?? 'unknown') as PostizErrorClass,
        message: result.message,
      },
      { status },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      status: outcome,
      postIds,
      message:
        outcome === 'scheduled'
          ? 'Scheduled in Postiz — it is queued, not yet published.'
          : 'Saved as a draft in Postiz — nothing is public until the marketing team publishes it.',
    },
    { status: 201 },
  );
}
