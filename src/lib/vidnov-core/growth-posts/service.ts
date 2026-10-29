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
 *     actual model response — a failed generation is reported, never saved;
 *   • every state change goes through `canTransitionGrowthPost`;
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
import { draftSocialPost } from './ai';
import { publishSocial } from './social';
import {
  CHANNEL_TEXT_LIMITS,
  buildPostText,
  draftsRemainingToday,
  growthProviderStatuses,
  publishGate,
  selectDraftTargets,
  sharePathFor,
  type DraftCandidate,
} from './drafts';
import {
  GROWTH_POSTS_COLLECTION,
  GROWTH_POST_LIMITS,
  canTransitionGrowthPost,
  clampDraftLimit,
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
  };
}

async function readCollection(db: Firestore, name: string, cap: number): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>();
  try {
    const snap = await db.collection(name).limit(cap).get();
    snap.forEach((doc) => out.set(doc.id, (doc.data() ?? {}) as Record<string, unknown>));
    return out;
  } catch {
    // Firestore unavailable (blocked project / quota) — caller decides the
    // fallback: the VPS mirror answers for growthPosts, and the draft run
    // genuinely cannot proceed without a product catalogue.
    throw new GrowthPostsError('store_unavailable', 'The product store is unavailable right now.');
  }
}

/* ── The nightly draft run ──────────────────────────────────────────────── */

export interface DraftRunReport {
  ranAt: string;
  actorUid: string;
  limit: number;
  scanned: number;
  drafted: number;
  failed: number;
  skippedCooldown: number;
  skippedIncomplete: number;
  dailyBudgetRemaining: number;
  aiStatus: 'configured' | 'not_configured';
  posts: Array<{ id: string; productId: string; status: GrowthPostState }>;
}

export interface DraftRunParams {
  db: Firestore;
  actorUid: string;
  limit?: number;
  /** Injectable clock for tests. */
  now?: Date;
}

export async function runGrowthDraftJob(params: DraftRunParams): Promise<DraftRunReport> {
  const { db, actorUid } = params;
  const now = params.now ?? new Date();
  const providers = growthProviderStatuses();

  if (providers.ai.status !== 'configured') {
    throw new GrowthPostsError('not_configured', 'AI drafting is not configured (GEMINI_API_KEY missing).');
  }

  let limit = clampDraftLimit(params.limit);
  const report: DraftRunReport = {
    ranAt: iso(now),
    actorUid,
    limit,
    scanned: 0,
    drafted: 0,
    failed: 0,
    skippedCooldown: 0,
    skippedIncomplete: 0,
    dailyBudgetRemaining: GROWTH_POST_LIMITS.perDay,
    aiStatus: providers.ai.status,
    posts: [],
  };

  // Existing posts give us BOTH the per-product cooldown and today's budget.
  let existing: Map<string, Record<string, unknown>>;
  try {
    existing = await readCollection(db, GROWTH_POSTS_COLLECTION, 200);
  } catch (error) {
    // The queue store is mirrored: when Firestore cannot answer, the VPS copy
    // still tells us what was drafted today so the budget stays honest.
    const mirrored = await pbListGrowthPosts(200);
    existing = new Map(mirrored.map((row) => [String(row.id ?? ''), row]));
    if (mirrored.length === 0 && error instanceof GrowthPostsError) throw error;
  }

  const cooldownMs = GROWTH_POST_LIMITS.cooldownDays * 86_400_000;
  const cooldown = new Set<string>();
  let createdToday = 0;
  const today = now.toISOString().slice(0, 10);
  for (const doc of existing.values()) {
    if (typeof doc.productId === 'string' && doc.productId) {
      const created = str(doc.createdAt);
      if (!created || now.getTime() - Date.parse(created) < cooldownMs) cooldown.add(doc.productId);
    }
    if (str(doc.createdAt).slice(0, 10) === today) createdToday += 1;
  }

  const remainingToday = draftsRemainingToday(createdToday);
  report.dailyBudgetRemaining = remainingToday;
  limit = Math.min(limit, remainingToday);
  report.limit = limit;
  if (limit <= 0) return report; // daily budget spent — nothing to do, no spend

  const products = await readCollection(db, 'products', GROWTH_POST_LIMITS.scanLimit);
  report.scanned = products.size;

  const candidates: DraftCandidate[] = [];
  for (const [id, raw] of products) {
    const eligibility = evaluateProductEligibility(id, raw);
    if (!eligibility.eligible) {
      report.skippedIncomplete += 1;
      continue;
    }
    candidates.push(toCandidate(id, raw));
  }

  const { selected, skipped } = selectDraftTargets(candidates, {
    limit,
    cooldownProductIds: cooldown,
    now: now.getTime(),
  });
  report.skippedCooldown = skipped.filter((s) => s.reason === 'cooldown').length;
  report.skippedIncomplete += skipped.filter((s) => s.reason === 'incomplete').length;

  for (const candidate of selected) {
    const sharePath = sharePathFor(candidate.id);
    const outcome = await draftSocialPost(candidate, sharePath);
    if (!outcome.ok) {
      // Not configured is a global gate (already checked); anything else is
      // a per-post failure that never enters the queue.
      report.failed += 1;
      continue;
    }

    const raw = products.get(candidate.id) ?? {};
    const nowIso = iso(now);
    const body = {
      productId: candidate.id,
      sellerId: str(raw.sellerId),
      productName: candidate.name,
      ...(candidate.imageUrl ? { productImage: candidate.imageUrl } : {}),
      ...(Number.isFinite(candidate.price) ? { price: candidate.price } : {}),
      ...(candidate.currency ? { currency: candidate.currency } : {}),
      caption: outcome.draft.caption,
      hashtags: outcome.draft.hashtags,
      sharePath,
      status: 'draft' as const,
      createdAt: nowIso,
      updatedAt: nowIso,
      draftedBy: actorUid,
    };

    try {
      const ref = await db.collection(GROWTH_POSTS_COLLECTION).add(body);
      await pbMirrorGrowthPost(ref.id, { id: ref.id, ...body });
      report.drafted += 1;
      report.posts.push({ id: ref.id, productId: candidate.id, status: 'draft' });
    } catch {
      report.failed += 1;
    }
  }

  report.dailyBudgetRemaining = Math.max(0, remainingToday - report.drafted);
  return report;
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
  params: { id: string; channel: GrowthPublishChannel; actorUid: string },
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
