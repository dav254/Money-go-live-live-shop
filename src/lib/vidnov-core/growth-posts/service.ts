/**
 * GROWTH POSTS — draft run, approval queue and publish service.
 *
 * The Firestore instance is a PARAMETER (routes pass the admin `db` from
 * `@/firebase/server`, tests pass a fake), so the module never pulls Firebase
 * Admin into a test process and needs no credentials to be imported.
 *
 * Store contract: Firestore is the source of truth for the queue; every
 * write is ALSO mirrored to the VPS PocketBase store, and every read falls
 * back to that mirror when Firestore cannot answer — the same dual-store
 * pattern the distribution jobs use, so a blocked project still shows the
 * admin their queue.
 *
 * Honesty invariants:
 *   • a draft is created ONLY from a real, eligible product document and an
 *     administrator's own copy — nothing is generated in the background;
 *   • every state change goes through `canTransitionGrowthPost`;
 *   • a composed post starts as `draft`: it is never auto-approved;
 *   • `emailed` with `emailStatus: 'dev_captured'` means captured in dev
 *     mode, NOT delivered — the vocabulary from the outreach engine;
 *   • `status: 'published'` is only ever written in the SAME patch as the
 *     platform's own message/record id (Phase 2A social channels) — a
 *     failure or a missing remoteId can never reach that state.
 */

import { type Firestore } from 'firebase-admin/firestore';
import { appLink } from '@/lib/notifications/config';
import { sendTemplateEmail } from '@/lib/notifications/email-service';
import { pbCountGrowthPosts, pbListGrowthPosts, pbMirrorGrowthPost } from '@/lib/pocketbase/growth-posts';
import { evaluateProductEligibility } from '../distribution/eligibility';
import { publishSocial } from './social';
import {
  CHANNEL_TEXT_LIMITS,
  buildPostText,
  publishGate,
  sharePathFor,
  type DraftCandidate,
} from './drafts';
import {
  GROWTH_POSTS_COLLECTION,
  GROWTH_POST_LIMITS,
  canTransitionGrowthPost,
  isSocialChannel,
  type GrowthPost,
  type GrowthPostState,
  type GrowthPublishChannel,
  type GrowthPublishResult,
} from './types';

/** Engine failures thrown to routes — always a safe, static message. */
export class GrowthPostsError extends Error {
  constructor(
    public readonly code:
      | 'not_found'
      | 'invalid_transition'
      | 'invalid_input'
      | 'not_configured'
      | 'store_unavailable'
      | 'no_recipient'
      | 'rejected',
    message: string,
  ) {
    super(message);
    this.name = 'GrowthPostsError';
  }
}

const iso = (d: Date = new Date()) => d.toISOString();

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/* ── Document ⇄ record ──────────────────────────────────────────────────── */

/** Maps a raw product document onto the drafter's candidate shape. */
function toCandidate(id: string, raw: Record<string, unknown>): DraftCandidate {
  const created = raw.uploadDate ?? raw.createdAt ?? null;
  let createdMs: number | null = null;
  if (typeof created === 'number') createdMs = created;
  else if (typeof created === 'string' && created) {
    const parsed = Date.parse(created);
    createdMs = Number.isNaN(parsed) ? null : parsed;
  } else if (created && typeof created === 'object' && 'seconds' in (created as object)) {
    const seconds = (created as { seconds?: unknown }).seconds;
    if (typeof seconds === 'number') createdMs = seconds * 1000;
  }

  return {
    id,
    name: str(raw.name),
    price: num(raw.price) ?? Number.NaN,
    currency: str(raw.localCurrency) || undefined,
    category: str(raw.category) || undefined,
    condition: raw.condition === 'new' || raw.condition === 'used' ? raw.condition : undefined,
    description: str(raw.description) || undefined,
    deliveryOptions: str(raw.deliveryOptions) || undefined,
    location: str(raw.location) || str(raw.vendorLocation) || undefined,
    imageUrl: str(raw.imageUrl) || undefined,
    viewCount: num(raw.viewCount),
    likes: num(raw.likes),
    salesCount: num(raw.salesCount),
    createdMs,
  };
}

/** A stored document → GrowthPost, or null when it is not a usable record. */
function toPost(id: string, raw: Record<string, unknown>): GrowthPost | null {
  const productId = str(raw.productId);
  const caption = str(raw.caption);
  if (!productId || !caption) return null;
  const status = str(raw.status) as GrowthPostState;
  const validStatus = (
    ['draft', 'approved', 'rejected', 'copied', 'emailed', 'published', 'failed'] as const
  ).includes(status)
    ? status
    : 'draft';
  return {
    id,
    productId,
    sellerId: str(raw.sellerId),
    productName: str(raw.productName),
    ...(typeof raw.productImage === 'string' && raw.productImage ? { productImage: raw.productImage } : {}),
    ...(num(raw.price) !== undefined ? { price: num(raw.price) as number } : {}),
    ...(str(raw.currency) ? { currency: str(raw.currency) } : {}),
    caption,
    hashtags: Array.isArray(raw.hashtags) ? raw.hashtags.map((h) => String(h)) : [],
    sharePath: str(raw.sharePath) || `/products/${productId}`,
    status: validStatus,
    createdAt: str(raw.createdAt) || iso(),
    updatedAt: str(raw.updatedAt) || str(raw.createdAt) || iso(),
    draftedBy: str(raw.draftedBy) || 'unknown',
    ...(str(raw.decidedBy) ? { decidedBy: str(raw.decidedBy) } : {}),
    ...(str(raw.decidedAt) ? { decidedAt: str(raw.decidedAt) } : {}),
    ...(str(raw.publishedAt) ? { publishedAt: str(raw.publishedAt) } : {}),
    ...(str(raw.publishChannel) ? { publishChannel: str(raw.publishChannel) as GrowthPublishChannel } : {}),
    ...(str(raw.emailTo) ? { emailTo: str(raw.emailTo) } : {}),
    ...(str(raw.emailStatus) ? { emailStatus: str(raw.emailStatus) } : {}),
    ...(raw.results && typeof raw.results === 'object' && !Array.isArray(raw.results)
      ? { results: raw.results as Record<string, GrowthPublishResult> }
      : {}),
    ...(str(raw.reason) ? { reason: str(raw.reason) } : {}),
    ...(str(raw.scheduledAt) ? { scheduledAt: str(raw.scheduledAt) } : {}),
    ...(Array.isArray(raw.scheduledChannels)
      ? { scheduledChannels: raw.scheduledChannels.filter(isSocialChannel) }
      : {}),
    ...(str(raw.scheduledBy) ? { scheduledBy: str(raw.scheduledBy) } : {}),
  };
}

/* ── Reads ──────────────────────────────────────────────────────────────── */

export interface ListParams {
  status?: GrowthPostState;
  limit?: number;
}

/** Queue read: Firestore first, VPS mirror when Firestore cannot answer. */
export async function listGrowthPosts(db: Firestore, params: ListParams = {}): Promise<GrowthPost[]> {
  const limit = Math.min(GROWTH_POST_LIMITS.listLimit, Math.max(1, params.limit ?? GROWTH_POST_LIMITS.listLimit));
  let rows: GrowthPost[] = [];

  try {
    const snap = await db.collection(GROWTH_POSTS_COLLECTION).limit(200).get();
    snap.forEach((doc) => {
      const post = toPost(doc.id, (doc.data() ?? {}) as Record<string, unknown>);
      if (post) rows.push(post);
    });
  } catch {
    const mirrored = await pbListGrowthPosts(200);
    rows = mirrored
      .map((row) => toPost(String(row.id ?? ''), row))
      .filter((p): p is GrowthPost => p !== null);
  }

  rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  const filtered = params.status ? rows.filter((r) => r.status === params.status) : rows;
  return filtered.slice(0, limit);
}

/** Per-status counts for the queue header (never a fabricated 0). */
export async function growthCounts(db: Firestore): Promise<Record<GrowthPostState, number> | null> {
  const rows = await listGrowthPosts(db, { limit: GROWTH_POST_LIMITS.listLimit });
  if (rows.length === 0) {
    // Empty from Firestore could mean "no posts" or "blocked store" — ask
    // the mirror before believing it.
    const mirrored = await pbCountGrowthPosts();
    if (mirrored) {
      return normalizeCounts(mirrored);
    }
  }
  const counts: Record<GrowthPostState, number> = {
    draft: 0, approved: 0, rejected: 0, copied: 0, emailed: 0, published: 0, failed: 0,
  };
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}

function normalizeCounts(raw: Record<string, number>): Record<GrowthPostState, number> {
  const counts: Record<GrowthPostState, number> = {
    draft: 0, approved: 0, rejected: 0, copied: 0, emailed: 0, published: 0, failed: 0,
  };
  for (const [key, value] of Object.entries(raw)) {
    if (key in counts && typeof value === 'number') counts[key as GrowthPostState] = value;
  }
  return counts;
}

async function loadPost(db: Firestore, id: string): Promise<{ data: Record<string, unknown>; post: GrowthPost }> {
  try {
    const snap = await db.collection(GROWTH_POSTS_COLLECTION).doc(id).get();
    if (!snap.exists) throw new GrowthPostsError('not_found', 'That post no longer exists.');
    const data = (snap.data() ?? {}) as Record<string, unknown>;
    const post = toPost(id, data);
    if (!post) throw new GrowthPostsError('not_found', 'That post is not readable.');
    return { data, post };
  } catch (error) {
    if (error instanceof GrowthPostsError) throw error;
    throw new GrowthPostsError('store_unavailable', 'The growth post store is unavailable right now.');
  }
}

async function savePatch(
  db: Firestore,
  id: string,
  patch: Record<string, unknown>,
): Promise<GrowthPost> {
  const body = { ...patch, updatedAt: iso() };
  try {
    await db.collection(GROWTH_POSTS_COLLECTION).doc(id).set(body, { merge: true });
  } catch (error) {
    if (error instanceof GrowthPostsError) throw error;
    throw new GrowthPostsError('store_unavailable', 'The growth post store is unavailable right now.');
  }
  await pbMirrorGrowthPost(id, { id, ...body });
  const { post } = await loadPost(db, id);
  return post;
}

/* ── Decisions ──────────────────────────────────────────────────────────── */

export type GrowthDecision = 'approve' | 'reject';

export async function decideGrowthPost(
  db: Firestore,
  params: { id: string; decision: GrowthDecision; actorUid: string; reason?: string },
): Promise<GrowthPost> {
  const { post } = await loadPost(db, params.id);
  const target: GrowthPostState = params.decision === 'approve' ? 'approved' : 'rejected';
  if (!canTransitionGrowthPost(post.status, target)) {
    throw new GrowthPostsError(
      'invalid_transition',
      `A ${post.status} post cannot become ${target}.`,
    );
  }
  return savePatch(db, params.id, {
    status: target,
    decidedBy: params.actorUid,
    decidedAt: iso(),
    ...(params.reason ? { reason: params.reason.slice(0, 300) } : {}),
  });
}

/* ── Publish (only channels that actually exist) ────────────────────────── */

export interface PublishResult {
  post: GrowthPost;
  channel: GrowthPublishChannel;
  /** `dev_captured` = captured in dev mode, NOT delivered. */
  emailStatus?: string;
  /** The platform's own message/record id — only on a confirmed publish. */
  remoteId?: string;
  outcome: 'copied' | 'emailed' | 'failed' | 'published';
  message: string;
}

async function resolveRecipient(db: Firestore, sellerId: string): Promise<{ email: string; name: string }> {
  if (!sellerId) return { email: '', name: 'Vidnov seller' };
  try {
    const shop = await db.collection('sellerShops').doc(sellerId).get();
    const data = (shop.data() ?? {}) as Record<string, unknown>;
    const email = str(data.contactEmail);
    const name = str(data.shopName);
    if (email) return { email, name: name || 'Vidnov seller' };
  } catch { /* fall through to the profile */ }
  try {
    const profile = await db.collection('userProfiles').doc(sellerId).get();
    const data = (profile.data() ?? {}) as Record<string, unknown>;
    return { email: str(data.email), name: str(data.displayName) || 'Vidnov seller' };
  } catch {
    return { email: '', name: 'Vidnov seller' };
  }
}

export async function publishGrowthPost(
  db: Firestore,
  params: {
    id: string;
    channel: GrowthPublishChannel;
    actorUid: string;
    /** Injectable fetch for tests — production omits it and uses global fetch. */
    fetchLike?: (input: string, init?: RequestInit) => Promise<Response>;
  },
): Promise<PublishResult> {
  const { post } = await loadPost(db, params.id);
  // Intended SUCCESS target — checked up front so an unapproved draft can
  // never reach any channel. Failures land on `failed`, which every
  // post-approval state may enter (and `failed` re-enters for retries).
  const target: GrowthPostState =
    params.channel === 'copy' ? 'copied' : params.channel === 'email' ? 'emailed' : 'published';
  if (post.status !== target && !canTransitionGrowthPost(post.status, target)) {
    throw new GrowthPostsError(
      'invalid_transition',
      `A ${post.status} post cannot be published on ${params.channel}.`,
    );
  }

  /* — copy: the admin's own clipboard; nothing is claimed as published — */
  if (params.channel === 'copy') {
    const updated = await savePatch(db, params.id, {
      status: 'copied',
      publishChannel: 'copy',
      publishedAt: iso(),
      decidedBy: post.decidedBy ?? params.actorUid,
    });
    return {
      post: updated,
      channel: 'copy',
      outcome: 'copied',
      message: 'Marked as copied — paste it into the network yourself. Nothing was published automatically.',
    };
  }

  /* — social (Phase 2A): the four free, approval-free networks — */
  if (isSocialChannel(params.channel)) {
    const gate = publishGate(params.channel, { env: process.env });
    if (!gate.allowed) throw new GrowthPostsError('not_configured', gate.reason);

    const shareUrl = appLink(post.sharePath);
    const text = buildPostText(
      { caption: post.caption, hashtags: post.hashtags, shareUrl },
      CHANNEL_TEXT_LIMITS[params.channel],
    );
    const outcome = await publishSocial({
      channel: params.channel,
      text,
      shareUrl,
      productName: post.productName,
      imageUrl: post.productImage,
      env: process.env,
      ...(params.fetchLike ? { fetchLike: params.fetchLike } : {}),
    });

    const nowIso = iso();
    const results: Record<string, GrowthPublishResult> = {
      ...(post.results ?? {}),
      [params.channel]: outcome.ok
        ? { state: 'published', remoteId: outcome.remoteId, at: nowIso, note: outcome.note }
        : { state: 'failed', at: nowIso, note: outcome.note },
    };

    if (outcome.ok) {
      // `published` is written in the SAME patch as the platform's own id —
      // there is no code path that claims it without a remoteId.
      const updated = await savePatch(db, params.id, {
        status: 'published',
        publishChannel: params.channel,
        publishedAt: nowIso,
        results,
        reason: null,
      });
      return {
        post: updated,
        channel: params.channel,
        remoteId: outcome.remoteId,
        outcome: 'published',
        message: outcome.note,
      };
    }

    // A failed attempt only marks the whole post `failed` when no channel
    // has succeeded yet; a post already published elsewhere stays published
    // and keeps this channel's failure visible in `results`.
    const anyPublished = Object.values(results).some((r) => r?.state === 'published');
    const updated = await savePatch(db, params.id, {
      status: anyPublished ? post.status : 'failed',
      results,
      reason: outcome.note,
      ...(anyPublished ? {} : { publishChannel: params.channel, publishedAt: nowIso }),
    });
    return {
      post: updated,
      channel: params.channel,
      outcome: 'failed',
      message: outcome.note,
    };
  }

  /* — email: needs credentials AND a real recipient — */
  const { email, name } = await resolveRecipient(db, post.sellerId);
  const gate = publishGate('email', { env: process.env, recipient: email });
  if (!gate.allowed) {
    throw new GrowthPostsError(
      email ? 'not_configured' : 'no_recipient',
      gate.reason,
    );
  }

  let result: { ok: boolean; status: string; devCaptured?: boolean; error?: string };
  try {
    result = await sendTemplateEmail({
      templateKey: 'growth-post',
      category: 'business',
      to: email,
      vars: {
        seller_name: name,
        product_name: post.productName,
        caption: post.caption,
        share_url: appLink(post.sharePath),
      },
    });
  } catch {
    result = { ok: false, status: 'FAILED', error: 'The email provider rejected the message.' };
  }

  if (!result.ok) {
    const updated = await savePatch(db, params.id, {
      status: 'failed',
      publishChannel: 'email',
      publishedAt: iso(),
      emailStatus: 'failed',
      reason: 'The email provider rejected the message.',
    });
    return {
      post: updated,
      channel: 'email',
      outcome: 'failed',
      message: 'The email provider rejected the message — this post is marked failed.',
    };
  }

  const devCaptured = Boolean(result.devCaptured);
  const status = (result.status || '').toUpperCase();
  const emailStatus = devCaptured
    ? 'dev_captured'
    : status === 'DELIVERED' ? 'delivered' : status.toLowerCase() || 'sent';

  const updated = await savePatch(db, params.id, {
    status: 'emailed',
    publishChannel: 'email',
    publishedAt: iso(),
    emailTo: email,
    emailStatus,
  });

  return {
    post: updated,
    channel: 'email',
    emailStatus,
    outcome: 'emailed',
    message: devCaptured
      ? 'Captured in development mode — recorded as dev_captured, NOT delivered.'
      : `Email accepted by the provider (${emailStatus}).`,
  };
}

/* ── Scheduling — the in-house Postiz layer ──────────────────────────── */

/**
 * Queue an APPROVED post for automatic publishing on specific social
 * channels at a future instant. This does NOT change the queue status — the
 * post stays exactly what it was and gains a pending action; the scheduler
 * tick (`runDueGrowthPosts`) is the only thing that later spends it.
 *
 * Bounds, in order:
 *   1. the post must still be able to reach `published` (drafts must be
 *      approved first; a rejected post can never be scheduled),
 *   2. channels are deduped social channels only — `copy` and `email` are
 *      human actions and stay manual,
 *   3. the instant must be a real date, at least a minute out and at most
 *      `scheduleMaxAheadDays` days ahead — no backlog bombs, no eternally
 *      armed posts.
 */
export async function scheduleGrowthPost(
  db: Firestore,
  params: { id: string; channels: string[]; at: string; actorUid: string; now?: Date },
): Promise<GrowthPost> {
  const now = params.now ?? new Date();
  const { post } = await loadPost(db, params.id);

  if (!canTransitionGrowthPost(post.status, 'published')) {
    throw new GrowthPostsError(
      'invalid_transition',
      `A ${post.status} post cannot be scheduled for publishing.`,
    );
  }

  const channels = [
    ...new Set((params.channels ?? []).map((c) => String(c).trim().toLowerCase()).filter(Boolean)),
  ];
  if (channels.length === 0 || channels.length > GROWTH_POST_LIMITS.schedulerChannelsMax) {
    throw new GrowthPostsError(
      'invalid_input',
      `Pick between one and ${GROWTH_POST_LIMITS.schedulerChannelsMax} social channels.`,
    );
  }
  for (const channel of channels) {
    if (!isSocialChannel(channel)) {
      throw new GrowthPostsError('invalid_input', `Unknown social channel: ${channel}.`);
    }
  }

  const atMs = Date.parse(params.at);
  if (Number.isNaN(atMs)) {
    throw new GrowthPostsError('invalid_input', 'The schedule time is not a valid date.');
  }
  if (atMs < now.getTime() + GROWTH_POST_LIMITS.scheduleMinAheadMs) {
    throw new GrowthPostsError('invalid_input', 'Pick a time at least a minute from now.');
  }
  if (atMs > now.getTime() + GROWTH_POST_LIMITS.scheduleMaxAheadDays * 86_400_000) {
    throw new GrowthPostsError(
      'invalid_input',
      `Scheduling is limited to ${GROWTH_POST_LIMITS.scheduleMaxAheadDays} days ahead.`,
    );
  }

  return savePatch(db, params.id, {
    scheduledAt: new Date(atMs).toISOString(),
    scheduledChannels: channels,
    scheduledBy: params.actorUid,
  });
}

/** Cancel a pending schedule. Idempotent — clearing an unset schedule is a no-op. */
export async function unscheduleGrowthPost(
  db: Firestore,
  params: { id: string; actorUid: string },
): Promise<GrowthPost> {
  await loadPost(db, params.id); // 404s honestly if the post vanished
  return savePatch(db, params.id, {
    scheduledAt: null,
    scheduledChannels: null,
    scheduledBy: null,
  });
}

/* ── Composer — write your own post, gated by the same real listing ──── */

/** Control characters stripped from admin-written copy (newlines survive). */
function sanitizeCaption(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Admin hashtags → the queue's plain-token shape: no `#`, ≤8, ≤30 chars. */
function normalizeHashtags(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const tags: string[] = [];
  for (const item of list) {
    const tag = String(item).replace(/^#/, '').replace(/\s+/g, '').slice(0, 30);
    if (tag && !tags.includes(tag)) tags.push(tag);
    if (tags.length >= 8) break;
  }
  return tags;
}

/**
 * Create an admin-written post about a REAL listing.
 *
 * The post is saved as a `draft` and waits for a person to approve it —
 * composing never auto-approves and never auto-publishes. The listing must
 * pass the `evaluateProductEligibility` gate (safe id, seller, name, price,
 * image, visible), so a composed post can never promote a hidden, price-less
 * or picture-less listing.
 */
export async function composeGrowthPost(
  db: Firestore,
  params: { productId: string; caption: string; hashtags?: string[]; actorUid: string; now?: Date },
): Promise<GrowthPost> {
  const now = params.now ?? new Date();
  const productId = String(params.productId ?? '').trim();
  if (!productId) {
    throw new GrowthPostsError('invalid_input', 'Pick a product to compose about.');
  }

  let raw: Record<string, unknown>;
  try {
    const snap = await db.collection('products').doc(productId).get();
    if (!snap.exists) throw new GrowthPostsError('not_found', 'That product no longer exists.');
    raw = (snap.data() ?? {}) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof GrowthPostsError) throw error;
    throw new GrowthPostsError('store_unavailable', 'The product store is unavailable right now.');
  }

  const eligibility = evaluateProductEligibility(productId, raw);
  if (!eligibility.eligible) {
    // The reason vocabulary is a fixed, safe enum (never upstream text).
    throw new GrowthPostsError(
      'invalid_input',
      `This listing is not eligible for promotion (${eligibility.reasons.join(', ')}).`,
    );
  }

  const caption = sanitizeCaption(params.caption);
  if (!caption) {
    throw new GrowthPostsError('invalid_input', 'Write the post copy first.');
  }
  if (caption.length > 4_000) {
    throw new GrowthPostsError('invalid_input', 'The post copy is too long (4,000 characters max).');
  }

  const candidate = toCandidate(productId, raw);
  const nowIso = iso(now);
  const body = {
    productId,
    sellerId: str(raw.sellerId),
    productName: candidate.name,
    ...(candidate.imageUrl ? { productImage: candidate.imageUrl } : {}),
    ...(Number.isFinite(candidate.price) ? { price: candidate.price } : {}),
    ...(candidate.currency ? { currency: candidate.currency } : {}),
    caption,
    hashtags: normalizeHashtags(params.hashtags),
    sharePath: sharePathFor(productId),
    // Manual first: a composed post enters the review queue as a draft. The
    // approval decision is always a separate, explicit human action.
    status: 'draft' as const,
    createdAt: nowIso,
    updatedAt: nowIso,
    draftedBy: params.actorUid,
  };

  try {
    const ref = await db.collection(GROWTH_POSTS_COLLECTION).add(body);
    await pbMirrorGrowthPost(ref.id, { id: ref.id, ...body });
    const { post } = await loadPost(db, ref.id);
    return post;
  } catch (error) {
    if (error instanceof GrowthPostsError) throw error;
    throw new GrowthPostsError('store_unavailable', 'The growth post store is unavailable right now.');
  }
}

/* ── Editing a post before approval ─────────────────────────────────────── */

/**
 * Rewrites the caption and/or hashtags of a post that has not been decided
 * yet. Editing never changes the state, never approves and never publishes —
 * it is the "type and edit the caption" step of the manual workflow.
 *
 * Only `draft` and `approved` posts may be edited: once a post is rejected it
 * is final, and once it has a per-channel result the copy that was published
 * must stay the copy on record.
 */
export async function updateGrowthPost(
  db: Firestore,
  params: { id: string; caption?: string; hashtags?: string[]; actorUid: string },
): Promise<GrowthPost> {
  const { post } = await loadPost(db, params.id);
  if (post.status !== 'draft' && post.status !== 'approved') {
    throw new GrowthPostsError(
      'invalid_transition',
      'Only a draft or an approved post can still be edited.',
    );
  }

  const patch: Record<string, unknown> = {};
  if (params.caption !== undefined) {
    const caption = sanitizeCaption(params.caption);
    if (!caption) {
      throw new GrowthPostsError('invalid_input', 'Write the post copy first.');
    }
    if (caption.length > 4_000) {
      throw new GrowthPostsError('invalid_input', 'The post copy is too long (4,000 characters max).');
    }
    patch.caption = caption;
  }
  if (params.hashtags !== undefined) {
    patch.hashtags = normalizeHashtags(params.hashtags);
  }
  if (Object.keys(patch).length === 0) {
    throw new GrowthPostsError('invalid_input', 'Nothing to update.');
  }

  return savePatch(db, params.id, patch);
}

/* ── The tick — publishes what is due, bounded and honest ───────────────── */

/** Counters only — per-post rows stay in the admin-queue (authenticated). */
export interface SchedulerReport {
  ranAt: string;
  actorUid: string;
  /** Posts whose `scheduledAt` had passed and whose state could still publish. */
  due: number;
  /** Channel attempts confirmed by the platform's own message id. */
  published: number;
  /** Channel attempts that failed, were unconfigured, or could not run. */
  failed: number;
  /** Schedules consumed (cleared) this run — pending action spent either way. */
  cleared: number;
}

/**
 * One scheduler pass: publish every post whose scheduled instant has passed,
 * one channel at a time, then CLEAR its schedule.
 *
 * Honesty rules carried over from `publishGrowthPost`:
 *   • `published` can only be written by that function, and only together
 *     with the platform's own id — this tick never sets a status itself;
 *   • a channel that is not configured throws before any network call; the
 *     tick records that as a failed attempt with the gate's env-NAMES note
 *     and leaves the post's own state untouched (nothing was attempted);
 *   • clearing happens AFTER the attempts: a store hiccup leaves the
 *     schedule armed (possible retry next tick) rather than silently
 *     dropping the post the admin asked to publish.
 *
 * Bounded by construction: ≤`schedulerPerRun` posts × ≤4 channels per run,
 * each provider call carrying its own timeout inside `social.ts`.
 */
export async function runDueGrowthPosts(
  db: Firestore,
  params: {
    actorUid: string;
    now?: Date;
    limit?: number;
    fetchLike?: (input: string, init?: RequestInit) => Promise<Response>;
  },
): Promise<SchedulerReport> {
  const now = params.now ?? new Date();
  const limit = Math.min(
    GROWTH_POST_LIMITS.schedulerPerRun,
    Math.max(1, params.limit ?? GROWTH_POST_LIMITS.schedulerPerRun),
  );
  const report: SchedulerReport = {
    ranAt: iso(now),
    actorUid: params.actorUid,
    due: 0,
    published: 0,
    failed: 0,
    cleared: 0,
  };

  const rows = await listGrowthPosts(db, { limit: GROWTH_POST_LIMITS.listLimit });
  const due = rows
    .filter(
      (p) =>
        typeof p.scheduledAt === 'string' &&
        p.scheduledAt !== '' &&
        !Number.isNaN(Date.parse(p.scheduledAt)) &&
        Date.parse(p.scheduledAt) <= now.getTime() &&
        canTransitionGrowthPost(p.status, 'published'),
    )
    .sort((a, b) => ((a.scheduledAt ?? '') <= (b.scheduledAt ?? '') ? -1 : 1))
    .slice(0, limit);

  report.due = due.length;

  for (const post of due) {
    for (const channel of post.scheduledChannels ?? []) {
      try {
        const result = await publishGrowthPost(db, {
          id: post.id,
          channel,
          actorUid: params.actorUid,
          ...(params.fetchLike ? { fetchLike: params.fetchLike } : {}),
        });
        if (result.outcome === 'published') report.published += 1;
        else report.failed += 1;
      } catch (error) {
        // not_configured / invalid_transition / store trouble: record the
        // attempt honestly (env-NAMES gate reason or a static message) and
        // keep going — one broken channel must not starve the others.
        report.failed += 1;
        const note = error instanceof GrowthPostsError ? error.message : 'The publish attempt did not complete.';
        try {
          const { post: fresh } = await loadPost(db, post.id);
          const results: Record<string, GrowthPublishResult> = {
            ...(fresh.results ?? {}),
            [channel]: { state: 'failed', at: iso(now), note },
          };
          await savePatch(db, post.id, { results });
        } catch {
          // Store unavailable — the counter in this report still records it.
        }
      }
    }

    try {
      await savePatch(db, post.id, {
        scheduledAt: null,
        scheduledChannels: null,
        scheduledBy: null,
      });
      report.cleared += 1;
    } catch {
      // Keep the schedule armed: the next tick retries instead of losing it.
    }
  }

  return report;
}
