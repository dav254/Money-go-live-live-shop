/**
 * SHOP OPPORTUNITY AGENT — service layer (Firestore + adapters injected).
 *
 * The full candidate pipeline, with every gate enforced HERE (routes stay
 * thin and always pass a route-verified admin uid):
 *
 *   ingest (dedup + retention) → analysis (server-side score) → package
 *   (honest copy + tracked link) → approval (human) → send (bounded,
 *   budgeted, suppression-checked, idempotent) → stage evidence → funnel.
 *
 * Invariants (asserted by tests):
 *   • Dedup: candidates are create-if-absent on a deterministic id; messages
 *     and packages have deterministic ids, so enqueueing twice is ONE doc.
 *   • Approval: nothing sends from `pending_approval`, and a paused or
 *     unacknowledged campaign blocks the entire batch.
 *   • Suppression/opt-out/retirement: a suppressed, opted-out or expired
 *     candidate's message is cancelled at send time — never dispatched.
 *   • Max one contact per business: a `shopAgentContacts` doc (keyed by the
 *     contact hash) is created in the SAME transaction that claims the send;
 *     if one exists the message is cancelled instead of sent twice.
 *   • Budget/rate: daily count and spend are reserved atomically before any
 *     provider call — a burst cannot overshoot the configured limits.
 *   • Retries: transient/rate-limited failures requeue to `approved` until
 *     MAX_MESSAGE_ATTEMPTS; auth/validation/not_configured failures never
 *     retry. Every attempt stores a sanitized, credential-free error.
 *   • Honesty: `sent` = provider ACCEPTED the message, `dev_captured` =
 *     development-mode capture (NOT sent), `delivered` only from a provider
 *     delivery confirmation. Unknown stays unknown — never a fabricated 0.
 *
 * No firebase/server import here: tests drive an in-memory fake.
 */

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { classifyError, sanitizeErrorMessage } from '../distribution/job-utils';
import type { ErrorClass } from '../types';
import {
  CAMPAIGN_DEFAULTS,
  CAMPAIGN_DOC_ID,
  CANDIDATES_COLLECTION,
  CONTACTS_COLLECTION,
  MESSAGES_COLLECTION,
  PACKAGES_COLLECTION,
  SUPPRESSION_COLLECTION,
  canTransitionCandidate,
  contactKey,
  contactKeyId,
  messageDocId,
  packageDocId,
  suppressionDocId,
  type AssetRecord,
  type CandidateStage,
  type MessageState,
  type OutreachChannel,
  type ShopAgentCampaign,
  type ShopAgentCandidate,
  type ShopAgentPackage,
} from './types';
import { scoreInputFromCandidate, scoreOpportunity } from './scoring';
import { buildInvitationPackage, type CopyError } from './messages';
import { isExpired, type CandidateRecord } from './scout';

export class ShopAgentError extends Error {
  constructor(
    public readonly code:
      | 'not_found'
      | 'forbidden'
      | 'invalid_state'
      | 'gate'
      | 'budget'
      | 'retention'
      | 'copy',
    message: string,
  ) {
    super(message);
    this.name = 'ShopAgentError';
  }
}

/** Admin-scoped write trail (bounded, sanitized) — appended by key actions. */
const AUDIT_COLLECTION = 'shopAgentAudit';

async function audit(
  db: Firestore,
  entry: { action: string; actorUid: string; targetId?: string; detail?: Record<string, unknown> },
): Promise<void> {
  try {
    await db.collection(AUDIT_COLLECTION).add({
      ...entry,
      at: FieldValue.serverTimestamp(),
    });
  } catch {
    // Audit is best-effort: never block the operation it describes.
  }
}

/* ── Campaign ────────────────────────────────────────────────────────────── */

export async function getCampaign(db: Firestore): Promise<ShopAgentCampaign> {
  const snap = await db.doc(CAMPAIGN_DOC_ID).get();
  const data = (snap.data() ?? {}) as Partial<ShopAgentCampaign>;
  if (!snap.exists) {
    return { id: 'main', ...CAMPAIGN_DEFAULTS, updatedAt: new Date().toISOString() };
  }
  return {
    ...CAMPAIGN_DEFAULTS,
    ...data,
    id: 'main',
    costPerMessageMinor: { ...CAMPAIGN_DEFAULTS.costPerMessageMinor, ...(data.costPerMessageMinor ?? {}) },
    sendCountByDate: data.sendCountByDate ?? {},
    spendMinorByDate: data.spendMinorByDate ?? {},
  } as ShopAgentCampaign;
}

export interface CampaignPatch {
  paused?: boolean;
  complianceAcknowledged?: boolean;
  senderName?: string;
  dailyMessageLimit?: number;
  dailyBudgetMinor?: number;
}

/** Admin updates campaign controls. Bounded; unknown keys are never written. */
export async function updateCampaign(
  db: Firestore,
  patch: CampaignPatch,
  actorUid: string,
): Promise<ShopAgentCampaign> {
  const current = await getCampaign(db);
  const next: Partial<ShopAgentCampaign> = {};
  if (typeof patch.paused === 'boolean') next.paused = patch.paused;
  if (typeof patch.complianceAcknowledged === 'boolean') next.complianceAcknowledged = patch.complianceAcknowledged;
  if (typeof patch.senderName === 'string' && patch.senderName.trim()) {
    next.senderName = patch.senderName.trim().slice(0, 60);
  }
  if (typeof patch.dailyMessageLimit === 'number') {
    next.dailyMessageLimit = Math.max(0, Math.min(200, Math.floor(patch.dailyMessageLimit)));
  }
  if (typeof patch.dailyBudgetMinor === 'number') {
    next.dailyBudgetMinor = Math.max(0, Math.min(10_000_000, Math.floor(patch.dailyBudgetMinor)));
  }
  await db
    .doc(CAMPAIGN_DOC_ID)
    .set(
      { ...CAMPAIGN_DEFAULTS, ...current, ...next, updatedBy: actorUid, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  await audit(db, { action: 'campaign_updated', actorUid, detail: { ...next } });
  return getCampaign(db);
}

/* ── Ingest (dedup + retention) ──────────────────────────────────────────── */

export interface IngestResult {
  added: number;
  duplicates: number;
  ids: string[];
}

/**
 * Persists scout output with structural dedup: the deterministic id makes a
 * re-run of the same source a no-op (existing rows only refresh lastSeenAt).
 */
export async function ingestCandidates(
  db: Firestore,
  records: CandidateRecord[],
  actorUid: string,
  now: Date = new Date(),
): Promise<IngestResult> {
  const iso = now.toISOString();
  let added = 0;
  let duplicates = 0;
  const ids: string[] = [];

  for (const record of records) {
    const ref = db.collection(CANDIDATES_COLLECTION).doc(record.id);
    try {
      const fresh: ShopAgentCandidate = {
        ...record,
        stage: 'discovered',
        suppression: { suppressed: false },
        eligibility: null,
        linkedUid: null,
        notes: null,
        createdAt: iso,
        updatedAt: iso,
        lastSeenAt: iso,
      };
      await ref.create(fresh as unknown as Record<string, unknown>);
      added += 1;
      ids.push(record.id);
    } catch (err) {
      const code = (err as { code?: number | string })?.code;
      if (code !== 6 && code !== 'already-exists') throw err;
      duplicates += 1;
      const existing = await ref.get();
      const data = existing.data() as Partial<ShopAgentCandidate> | undefined;
      ids.push(existing.exists ? String(data?.id ?? record.id) : record.id);
      if (existing.exists) {
        // Refresh the retrieval clock only — stage, review and suppression
        // decisions are never overwritten by a re-scout.
        await ref.update({ lastSeenAt: iso });
      }
    }
  }

  await audit(db, {
    action: 'scout_ingested',
    actorUid,
    detail: { added, duplicates, sourceRecords: records.length },
  });
  return { added, duplicates, ids };
}

/* ── Reads ───────────────────────────────────────────────────────────────── */

export interface ListParams {
  stage?: CandidateStage;
  limit?: number;
}

export async function listCandidates(db: Firestore, params: ListParams = {}): Promise<ShopAgentCandidate[]> {
  const limit = Math.max(1, Math.min(200, Math.floor(params.limit ?? 100)));
  let query = db.collection(CANDIDATES_COLLECTION).limit(limit);
  if (params.stage) query = query.where('stage', '==', params.stage);
  const snap = await query.get();
  return snap.docs.map((d) => ({ ...(d.data() as ShopAgentCandidate), id: d.id }));
}

export async function getCandidate(db: Firestore, id: string): Promise<ShopAgentCandidate | null> {
  const snap = await db.collection(CANDIDATES_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return { ...(snap.data() as ShopAgentCandidate), id: snap.id };
}

/* ── Analysis & review ───────────────────────────────────────────────────── */

/**
 * Recomputes the eligibility snapshot from the STORED source fields and
 * persists it. Scores are always server-derived — a request body containing
 * a score is simply ignored by every caller.
 */
export async function analyzeCandidate(db: Firestore, id: string, now: Date = new Date()): Promise<ShopAgentCandidate> {
  const candidate = await getCandidate(db, id);
  if (!candidate) throw new ShopAgentError('not_found', 'Candidate not found.');
  const eligibility = scoreOpportunity(scoreInputFromCandidate(candidate, now));
  await db.collection(CANDIDATES_COLLECTION).doc(id).update({
    eligibility: { ...eligibility, computedAt: now.toISOString() },
    updatedAt: now.toISOString(),
  });
  return { ...candidate, eligibility };
}

export interface ReviewParams {
  candidateId: string;
  decision: 'approve' | 'reject';
  actorUid: string;
  note?: string;
  now?: Date;
}

/**
 * Admin review: `approve` runs the full server-side analysis first and only
 * moves the candidate to `eligible` when the rubric says `eligible` — an
 * approval of an ineligible candidate is refused with the reason, never
 * silently accepted. `reject` always moves (with the note stored).
 */
export async function reviewCandidate(db: Firestore, params: ReviewParams): Promise<ShopAgentCandidate> {
  const { candidateId, decision, actorUid } = params;
  const now = params.now ?? new Date();
  const candidate = await analyzeCandidate(db, candidateId, now);
  const eligibility = candidate.eligibility!;

  if (decision === 'reject') {
    const target: CandidateStage = 'rejected';
    if (!canTransitionCandidate(candidate.stage, target)) {
      throw new ShopAgentError('invalid_state', `Cannot reject a candidate in stage “${candidate.stage}”.`);
    }
    await db.collection(CANDIDATES_COLLECTION).doc(candidateId).update({
      stage: target,
      notes: params.note?.slice(0, 300) ?? null,
      updatedAt: now.toISOString(),
    });
    await audit(db, { action: 'candidate_rejected', actorUid, targetId: candidateId });
    return { ...candidate, stage: target };
  }

  if (eligibility.recommendation !== 'eligible') {
    throw new ShopAgentError(
      'gate',
      `Candidate does not qualify as eligible (${eligibility.score}/${eligibility.maxScore}: ${eligibility.recommendation}).`,
    );
  }
  const target: CandidateStage = 'eligible';
  if (!canTransitionCandidate(candidate.stage, target)) {
    throw new ShopAgentError('invalid_state', `Cannot move a candidate in stage “${candidate.stage}” to eligible.`);
  }
  await db.collection(CANDIDATES_COLLECTION).doc(candidateId).update({
    stage: target,
    notes: params.note?.slice(0, 300) ?? candidate.notes,
    updatedAt: now.toISOString(),
  });
  await audit(db, { action: 'candidate_approved', actorUid, targetId: candidateId });
  return { ...candidate, stage: target };
}

/** Stages that REQUIRE server-verified evidence before they may be claimed. */
export const EVIDENCE_GATED_STAGES: readonly CandidateStage[] = ['registered', 'shop_published', 'product_published'];

export interface AdvanceParams {
  candidateId: string;
  to: CandidateStage;
  actorUid: string;
  /** Route-verified evidence (uid exists / shop exists / product exists). */
  evidenceOk: boolean;
  now?: Date;
}

/**
 * Funnel progression for the post-contact stages. Gated stages are refused
 * unless the route proved the claim against real data — a client cannot mark
 * a business "registered" or "shop published" without that verification.
 */
export async function advanceStage(db: Firestore, params: AdvanceParams): Promise<ShopAgentCandidate> {
  const { candidateId, to, actorUid, evidenceOk } = params;
  const now = params.now ?? new Date();
  const candidate = await getCandidate(db, candidateId);
  if (!candidate) throw new ShopAgentError('not_found', 'Candidate not found.');
  if (EVIDENCE_GATED_STAGES.includes(to) && !evidenceOk) {
    throw new ShopAgentError('gate', `Stage “${to}” requires verified evidence from real marketplace data.`);
  }
  if (!canTransitionCandidate(candidate.stage, to)) {
    throw new ShopAgentError('invalid_state', `Cannot move a candidate from “${candidate.stage}” to “${to}”.`);
  }
  if (candidate.stage === to) return candidate; // idempotent re-assert
  await db.collection(CANDIDATES_COLLECTION).doc(candidateId).update({
    stage: to,
    updatedAt: now.toISOString(),
  });
  await audit(db, { action: 'stage_advanced', actorUid, targetId: candidateId, detail: { from: candidate.stage, to } });
  return { ...candidate, stage: to };
}

/* ── Suppression & opt-out ───────────────────────────────────────────────── */

export interface SuppressParams {
  candidateId?: string;
  /** Direct contact key (when opting out without a candidate lookup). */
  contactKeyId?: string;
  reason: 'opt_out' | 'manual' | 'complaint';
  source: 'recipient' | 'admin';
  actorUid?: string;
  now?: Date;
}

/**
 * Writes the suppression entry AND cancels any message still waiting for
 * approval — an opted-out recipient must never reach the dispatch path.
 * Idempotent: repeated opt-outs converge to one suppression doc.
 */
export async function suppressContact(db: Firestore, params: SuppressParams): Promise<{ suppressed: true; cancelled: number }> {
  const now = params.now ?? new Date();
  const iso = now.toISOString();

  let candidate: ShopAgentCandidate | null = null;
  if (params.candidateId) {
    candidate = await getCandidate(db, params.candidateId);
    if (!candidate) throw new ShopAgentError('not_found', 'Candidate not found.');
  }

  const key =
    params.contactKeyId ??
    (candidate?.contact ? contactKey(candidate.contact) : null) ??
    (params.candidateId ? contactKeyId('website_form', params.candidateId) : null);
  if (!key) throw new ShopAgentError('gate', 'No contact to suppress.');

  await db
    .collection(SUPPRESSION_COLLECTION)
    .doc(suppressionDocId(key))
    .set(
      {
        key,
        candidateId: params.candidateId ?? candidate?.id ?? null,
        reason: params.reason,
        source: params.source,
        at: iso,
      },
      { merge: true },
    );

  if (candidate) {
    await db.collection(CANDIDATES_COLLECTION).doc(candidate.id).update({
      suppression: { suppressed: true, reason: params.reason, at: iso, source: params.source },
      updatedAt: iso,
    });
    // Cancel anything not yet dispatched.
    const open = await db
      .collection(MESSAGES_COLLECTION)
      .where('candidateId', '==', candidate.id)
      .limit(50)
      .get();
    let cancelled = 0;
    for (const doc of open.docs) {
      const data = doc.data() as { state?: MessageState };
      const state = data.state ?? 'pending_approval';
      if (state === 'pending_approval' || state === 'approved') {
        await doc.ref.update({ state: 'cancelled', cancelReason: params.reason, updatedAt: iso });
        cancelled += 1;
      }
    }
    if (params.actorUid) {
      await audit(db, {
        action: 'contact_suppressed',
        actorUid: params.actorUid,
        targetId: candidate.id,
        detail: { reason: params.reason, source: params.source, cancelled },
      });
    }
    return { suppressed: true, cancelled };
  }

  return { suppressed: true, cancelled: 0 };
}

/** True when the contact behind this candidate is suppressed (any reason). */
export async function isContactSuppressed(db: Firestore, candidate: ShopAgentCandidate): Promise<boolean> {
  if (candidate.suppression.suppressed) return true;
  if (!candidate.contact) return false;
  const key = contactKey(candidate.contact);
  const snap = await db.collection(SUPPRESSION_COLLECTION).doc(suppressionDocId(key)).get();
  return snap.exists;
}

/* ── Package creation ────────────────────────────────────────────────────── */

/** Which outreach channel a contact kind maps to (null = not sendable). */
export function sendableChannel(candidate: ShopAgentCandidate): OutreachChannel | null {
  const contact = candidate.contact;
  if (!contact) return null;
  if (contact.kind === 'email') return 'email';
  if (contact.kind === 'phone') return 'sms';
  return null; // website_form: a URL, not a messaging address — manual follow-up
}

export interface CreatePackageParams {
  candidateId: string;
  actorUid: string;
  secret: string;
  siteOrigin: string;
  now?: Date;
}

export interface CreatePackageResult {
  packageId: string;
  alreadyExisted: boolean;
  messageId: string | null;
  /** True when the copy was stored for review in `pending_approval`. */
  messageQueued: boolean;
  manualFollowUpOnly: boolean;
}

/**
 * Builds the draft marketing package and queues its message for human
 * approval. Requires stage `eligible` (the review gate upstream), an
 * unexpired candidate and a suppression check — a suppressed business never
 * gets fresh outreach material queued. Deterministic ids make a double-click
 * idempotent.
 */
export async function createPackage(db: Firestore, params: CreatePackageParams): Promise<CreatePackageResult> {
  const now = params.now ?? new Date();
  const candidate = await getCandidate(db, params.candidateId);
  if (!candidate) throw new ShopAgentError('not_found', 'Candidate not found.');
  if (candidate.stage !== 'eligible') {
    throw new ShopAgentError('invalid_state', 'Only reviewed, eligible candidates can receive a package.');
  }
  if (isExpired(candidate.expiresAt, now)) {
    throw new ShopAgentError('retention', 'Source data has expired — refresh from the source before packaging.');
  }
  if (await isContactSuppressed(db, candidate)) {
    throw new ShopAgentError('forbidden', 'This contact is suppressed — no outreach material will be created.');
  }

  const campaign = await getCampaign(db);
  const variants = buildInvitationPackage({
    candidate,
    campaignId: campaign.id === 'main' ? 'shopagent' : campaign.id,
    secret: params.secret,
    siteOrigin: params.siteOrigin,
    senderName: campaign.senderName,
  });

  const pkgId = packageDocId(candidate.id);
  const pkgRef = db.collection(PACKAGES_COLLECTION).doc(pkgId);
  const iso = now.toISOString();
  const pkgDoc: ShopAgentPackage = {
    id: pkgId,
    candidateId: candidate.id,
    version: 'v1',
    state: 'draft',
    variants,
    poster: { state: 'draft', url: null, mediaId: null, provider: null, at: null, note: 'Not generated yet.' },
    video: {
      state: 'disabled',
      url: null,
      mediaId: null,
      provider: null,
      at: null,
      note: 'Video generation is disabled for outreach: cost gate not approved. Enable only after an explicit budget decision.',
    },
    copySource: 'template',
    createdBy: params.actorUid,
    createdAt: iso,
    updatedAt: iso,
  };

  let alreadyExisted = false;
  try {
    await pkgRef.create(pkgDoc as unknown as Record<string, unknown>);
  } catch (err) {
    const code = (err as { code?: number | string })?.code;
    if (code !== 6 && code !== 'already-exists') throw err;
    alreadyExisted = true;
  }

  const channel = sendableChannel(candidate);
  if (!channel) {
    return { packageId: pkgId, alreadyExisted, messageId: null, messageQueued: false, manualFollowUpOnly: true };
  }

  const msgId = messageDocId(candidate.id, channel);
  const msgRef = db.collection(MESSAGES_COLLECTION).doc(msgId);
  let messageQueued = false;
  try {
    await msgRef.create({
      id: msgId,
      candidateId: candidate.id,
      channel,
      state: 'pending_approval' as MessageState,
      attempts: 0,
      lastError: null,
      subject: variants.subject,
      body: variants[channel === 'email' ? 'email' : channel === 'whatsapp' ? 'whatsapp' : 'sms'],
      optOutLink: variants.optOutLink,
      contactKeyId: contactKey(candidate.contact!),
      createdBy: params.actorUid,
      createdAt: iso,
      updatedAt: iso,
    });
    messageQueued = true;
  } catch (err) {
    const code = (err as { code?: number | string })?.code;
    if (code !== 6 && code !== 'already-exists') throw err;
  }

  if (!alreadyExisted) {
    await audit(db, { action: 'package_created', actorUid: params.actorUid, targetId: candidate.id, detail: { messageId: msgId } });
  }
  return { packageId: pkgId, alreadyExisted, messageId: msgId, messageQueued, manualFollowUpOnly: false };
}

/* ── Message approval ────────────────────────────────────────────────────── */

export interface ApproveResult {
  approved: number;
  alreadyApproved: number;
  refused: Array<{ id: string; reason: string }>;
}

/**
 * Human approval gate. Only `pending_approval` messages move; each approval
 * also advances the candidate to `invitation_approved` (idempotently).
 * A suppressed candidate's message is cancelled instead of approved — the
 * gate never becomes a hole in the suppression rule.
 */
export async function approveMessages(
  db: Firestore,
  ids: string[],
  actorUid: string,
  now: Date = new Date(),
): Promise<ApproveResult> {
  const iso = now.toISOString();
  const result: ApproveResult = { approved: 0, alreadyApproved: 0, refused: [] };

  for (const id of ids.slice(0, 100)) {
    const ref = db.collection(MESSAGES_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      result.refused.push({ id, reason: 'Message not found.' });
      continue;
    }
    const msg = snap.data() as { state?: MessageState; candidateId?: string };
    const state = msg.state ?? 'pending_approval';
    if (state === 'approved') {
      result.alreadyApproved += 1;
      continue;
    }
    if (state !== 'pending_approval') {
      result.refused.push({ id, reason: `Message is “${state}” — approval only applies to pending messages.` });
      continue;
    }
    const candidate = msg.candidateId ? await getCandidate(db, msg.candidateId) : null;
    if (candidate && (await isContactSuppressed(db, candidate))) {
      await ref.update({ state: 'cancelled', cancelReason: 'suppressed', updatedAt: iso });
      result.refused.push({ id, reason: 'Contact is suppressed — message cancelled instead of approved.' });
      continue;
    }
    await ref.update({ state: 'approved' as MessageState, approvedBy: actorUid, approvedAt: iso, updatedAt: iso });
    result.approved += 1;
    if (candidate && canTransitionCandidate(candidate.stage, 'invitation_approved')) {
      await db.collection(CANDIDATES_COLLECTION).doc(candidate.id).update({
        stage: 'invitation_approved',
        updatedAt: iso,
      });
    }
  }
  await audit(db, { action: 'messages_approved', actorUid, detail: { count: result.approved, refused: result.refused.length } });
  return result;
}

export async function cancelMessages(db: Firestore, ids: string[], actorUid: string, now: Date = new Date()): Promise<number> {
  const iso = now.toISOString();
  let cancelled = 0;
  for (const id of ids.slice(0, 100)) {
    const ref = db.collection(MESSAGES_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const state = (snap.data() as { state?: MessageState }).state ?? 'pending_approval';
    if (state !== 'pending_approval' && state !== 'approved') continue;
    await ref.update({ state: 'cancelled' as MessageState, cancelReason: 'admin', cancelledBy: actorUid, updatedAt: iso });
    cancelled += 1;
  }
  await audit(db, { action: 'messages_cancelled', actorUid, detail: { count: cancelled } });
  return cancelled;
}

/* ── Sending ─────────────────────────────────────────────────────────────── */

export type SendOutcome =
  | { kind: 'sent'; providerStatus: string; receiptId?: string }
  | { kind: 'delivered'; providerStatus: string; receiptId?: string }
  | { kind: 'dev_captured'; providerStatus: string }
  | { kind: 'not_configured'; message: string }
  | { kind: 'error'; message: string };

export interface SendRequest {
  messageId: string;
  channel: OutreachChannel;
  to: string;
  subject: string;
  body: string;
  candidateId: string;
}

export interface SendDeps {
  /** Dispatches one message through the configured provider for its channel. */
  send: (req: SendRequest) => Promise<SendOutcome>;
  now?: Date;
  /** Bounded batch size (also capped by the daily limit). */
  limit?: number;
}

export interface BatchReport {
  attempted: number;
  sent: number;
  delivered: number;
  devCaptured: number;
  failed: number;
  cancelled: number;
  requeued: number;
  skipped: number;
  stoppedBecause: 'daily_limit' | 'budget' | 'campaign_paused' | 'compliance' | null;
  errors: Array<{ messageId: string; class: ErrorClass; message: string }>;
}

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Sends approved messages, one at a time, with every gate re-checked at
 * dispatch time (state can change between approval and send). Each send:
 *
 *   1. claims `approved → sending` + reserves daily count/spend + verifies
 *      the max-one-contact doc in ONE transaction (concurrency-safe);
 *   2. dispatches through the injected provider;
 *   3. finalizes honestly (`sent`/`dev_captured`/`delivered`/`failed` or a
 *      bounded requeue back to `approved`).
 *
 * Returns a report — never throws for per-message failures.
 */
export async function sendApprovedBatch(db: Firestore, deps: SendDeps): Promise<BatchReport> {
  const now = deps.now ?? new Date();
  const iso = now.toISOString();
  const today = dayKey(now);
  const limit = Math.max(1, Math.min(200, Math.floor(deps.limit ?? 10)));

  const report: BatchReport = {
    attempted: 0,
    sent: 0,
    delivered: 0,
    devCaptured: 0,
    failed: 0,
    cancelled: 0,
    requeued: 0,
    skipped: 0,
    stoppedBecause: null,
    errors: [],
  };

  const campaign = await getCampaign(db);
  if (campaign.paused) {
    report.stoppedBecause = 'campaign_paused';
    return report;
  }
  if (!campaign.complianceAcknowledged) {
    report.stoppedBecause = 'compliance';
    return report;
  }

  const pending = await db.collection(MESSAGES_COLLECTION).where('state', '==', 'approved').limit(limit).get();

  for (const docSnap of pending.docs) {
    if (report.attempted >= limit) break;
    const msg = docSnap.data() as {
      id?: string;
      candidateId?: string;
      channel?: OutreachChannel;
      subject?: string;
      body?: string;
      attempts?: number;
      state?: MessageState;
    };
    const messageId = msg.id ?? docSnap.id;
    const candidate = msg.candidateId ? await getCandidate(db, msg.candidateId) : null;
    if (!candidate) {
      await docSnap.ref.update({ state: 'cancelled' as MessageState, cancelReason: 'candidate_missing', updatedAt: iso });
      report.cancelled += 1;
      continue;
    }

    /* Gate 1: suppression / retention / max-one-contact — cancel, never send. */
    if (await isContactSuppressed(db, candidate)) {
      await docSnap.ref.update({ state: 'cancelled' as MessageState, cancelReason: 'suppressed', updatedAt: iso });
      report.cancelled += 1;
      continue;
    }
    if (isExpired(candidate.expiresAt, now)) {
      await docSnap.ref.update({ state: 'cancelled' as MessageState, cancelReason: 'retention_expired', updatedAt: iso });
      report.cancelled += 1;
      continue;
    }

    const contact = candidate.contact;
    const to = contact?.value ?? '';
    if (!to) {
      await docSnap.ref.update({ state: 'cancelled' as MessageState, cancelReason: 'no_contact', updatedAt: iso });
      report.cancelled += 1;
      continue;
    }

    const channel: OutreachChannel = msg.channel ?? 'email';
    const costMinor = campaign.costPerMessageMinor[channel] ?? 0;
    const contactId = contactKeyId(contact!.kind, to);

    /* Claim: state + daily quota + spend + max-one-contact in one tx. */
    const claim = await db.runTransaction(async (tx) => {
      const msgRef = db.collection(MESSAGES_COLLECTION).doc(messageId);
      const campRef = db.doc(CAMPAIGN_DOC_ID);
      const contactRef = db.collection(CONTACTS_COLLECTION).doc(contactId);
      const [msgSnap, campSnap, contactSnap] = await Promise.all([tx.get(msgRef), tx.get(campRef), tx.get(contactRef)]);

      if (!msgSnap.exists) return { ok: false as const, reason: 'gone' as const };
      const stateNow = (msgSnap.data() as { state?: MessageState }).state;
      if (stateNow !== 'approved') return { ok: false as const, reason: 'state' as const };
      if (contactSnap.exists) return { ok: false as const, reason: 'already_contacted' as const };

      const camp = { ...CAMPAIGN_DEFAULTS, ...(campSnap.data() ?? {}) } as ShopAgentCampaign;
      if (camp.paused) return { ok: false as const, reason: 'paused' as const };
      const sentSoFar = camp.sendCountByDate[today] ?? 0;
      const spentSoFar = camp.spendMinorByDate[today] ?? 0;
      if (sentSoFar >= camp.dailyMessageLimit) return { ok: false as const, reason: 'daily_limit' as const };
      if (spentSoFar + costMinor > camp.dailyBudgetMinor) return { ok: false as const, reason: 'budget' as const };

      tx.update(msgRef, { state: 'sending' as MessageState, updatedAt: iso });
      tx.set(
        campRef,
        {
          sendCountByDate: { ...camp.sendCountByDate, [today]: sentSoFar + 1 },
          spendMinorByDate: { ...camp.spendMinorByDate, [today]: spentSoFar + costMinor },
          updatedAt: iso,
        },
        { merge: true },
      );
      // Reserve the contact slot BEFORE dispatch: two batches racing for the
      // same business can only ever produce one send.
      tx.set(contactRef, { candidateId: candidate.id, messageId, reservedAt: iso });
      return { ok: true as const };
    });

    if (!claim.ok) {
      if (claim.reason === 'daily_limit') report.stoppedBecause = 'daily_limit';
      else if (claim.reason === 'budget') report.stoppedBecause = 'budget';
      else if (claim.reason === 'paused') report.stoppedBecause = 'campaign_paused';
      else if (claim.reason === 'already_contacted') {
        await docSnap.ref.update({ state: 'cancelled' as MessageState, cancelReason: 'already_contacted', updatedAt: iso });
        report.cancelled += 1;
      } else {
        report.skipped += 1;
      }
      if (report.stoppedBecause) break;
      continue;
    }

    report.attempted += 1;
    const attempts = (msg.attempts ?? 0) + 1;

    /* Dispatch (per-message failure must never abort the batch). */
    let outcome: SendOutcome;
    try {
      outcome = await deps.send({
        messageId,
        channel,
        to,
        subject: msg.subject ?? '',
        body: msg.body ?? '',
        candidateId: candidate.id,
      });
    } catch (err) {
      outcome = { kind: 'error', message: sanitizeErrorMessage(err) };
    }

    if (outcome.kind === 'sent' || outcome.kind === 'delivered' || outcome.kind === 'dev_captured') {
      const finalState: MessageState =
        outcome.kind === 'sent' ? 'sent' : outcome.kind === 'delivered' ? 'delivered' : 'dev_captured';
      await db.collection(MESSAGES_COLLECTION).doc(messageId).update({
        state: finalState,
        attempts,
        providerStatus: outcome.providerStatus,
        sentAt: iso,
        updatedAt: iso,
      });
      if (finalState === 'sent') report.sent += 1;
      else if (finalState === 'delivered') report.delivered += 1;
      else report.devCaptured += 1;

      // Stage evidence: only a REAL accepted send advances the funnel.
      if (finalState !== 'dev_captured' && canTransitionCandidate(candidate.stage, 'message_sent')) {
        await db.collection(CANDIDATES_COLLECTION).doc(candidate.id).update({
          stage: 'message_sent',
          updatedAt: iso,
        });
      }
      if (finalState === 'dev_captured') {
        // Nothing actually left the building: release the contact slot so a
        // later production-configured run can REALLY contact this business.
        await db.collection(CONTACTS_COLLECTION).doc(contactId).delete().catch(() => undefined);
      }
      continue;
    }

    /* Failure paths — classified, bounded, truthful. */
    const errorClass: ErrorClass =
      outcome.kind === 'not_configured' ? 'not_configured' : classifyError(new Error(outcome.message));
    const retryable =
      outcome.kind !== 'not_configured' &&
      attempts < 3 &&
      (errorClass === 'transient' || errorClass === 'rate_limited');

    await db.collection(MESSAGES_COLLECTION).doc(messageId).update({
      state: retryable ? ('approved' as MessageState) : ('failed' as MessageState),
      attempts,
      lastError: { class: errorClass, message: sanitizeErrorMessage(outcome.message), at: iso },
      updatedAt: iso,
    });

    // The reservation stays consumed (the attempt happened and may have cost
    // money) but the CONTACT slot is released on every failure: the same
    // message may still retry, and a permanently failed one must not leave
    // the business silently uncontactable forever. Success keeps the slot —
    // that is the max-one-contact guarantee.
    await db.collection(CONTACTS_COLLECTION).doc(contactId).delete().catch(() => undefined);
    if (!retryable) {
      report.failed += 1;
    } else {
      report.requeued += 1;
    }
    report.errors.push({ messageId, class: errorClass, message: sanitizeErrorMessage(outcome.message) });
  }

  return report;
}

/** Maps the email service result onto the honest outcome vocabulary. */
export function mapEmailResult(result: {
  ok: boolean;
  status: string;
  devCaptured?: boolean;
  error?: string;
}): SendOutcome {
  if (!result.ok) return { kind: 'error', message: result.error || 'Email provider rejected the message.' };
  if (result.devCaptured) {
    return { kind: 'dev_captured', providerStatus: 'development_capture' };
  }
  const status = (result.status || '').toUpperCase();
  if (status === 'DELIVERED') return { kind: 'delivered', providerStatus: status.toLowerCase() };
  if (status === 'SENT' || status === 'QUEUED' || status === 'SENDING') {
    return { kind: 'sent', providerStatus: status.toLowerCase() };
  }
  return { kind: 'error', message: `Unexpected email status: ${status || 'unknown'}.` };
}

/* ── Evidence helpers for gated stages ───────────────────────────────────── */

/**
 * Stage claim verification against REAL data, given route-resolved evidence:
 *   • `registered`     — an auth/profile uid exists;
 *   • `shop_published` — a sellerShops document exists for that uid;
 *   • `product_published` — at least one visible product exists for that uid.
 * The route performs the reads (it owns the admin SDK) and passes results in;
 * this keeps the rule itself pure and testable.
 */
/** Persists a generated/approved asset record onto the package (admin action). */
export async function recordAsset(
  db: Firestore,
  params: {
    packageId: string;
    asset: 'poster' | 'video';
    record: AssetRecord;
    actorUid: string;
    now?: Date;
  },
): Promise<ShopAgentPackage> {
  const ref = db.collection(PACKAGES_COLLECTION).doc(params.packageId);
  const snap = await ref.get();
  if (!snap.exists) throw new ShopAgentError('not_found', 'Package not found.');
  const iso = (params.now ?? new Date()).toISOString();
  await ref.update({ [params.asset]: params.record, updatedAt: iso });
  await audit(db, {
    action: `asset_${params.asset}_${params.record.state}`,
    actorUid: params.actorUid,
    targetId: params.packageId,
    detail: { note: params.record.note ?? null },
  });
  return { ...(snap.data() as ShopAgentPackage), id: snap.id };
}

export function evidenceSatisfied(
  stage: CandidateStage,
  evidence: { uidExists: boolean; shopExists: boolean; visibleProductCount: number },
): boolean {
  switch (stage) {
    case 'registered':
      return evidence.uidExists;
    case 'shop_published':
      return evidence.shopExists;
    case 'product_published':
      return evidence.visibleProductCount > 0;
    default:
      return true;
  }
}

export { AUDIT_COLLECTION, type CopyError };
