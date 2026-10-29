/**
 * SHOP OPPORTUNITY AGENT — canonical types, ids & state machines (pure).
 *
 * The agent discovers local businesses (configurable geo scout), scores them
 * against transparent criteria, prepares an invitation package, and runs a
 * human-approved outreach queue — then follows the candidate through to
 * registration, shop and product publication using evidence read from the
 * existing marketplace.
 *
 * Design rules (mirrored by the tests):
 *   • Deterministic ids everywhere ⇒ dedup is structural, not best-effort.
 *   • Stages are an explicit state machine; no free-form status strings.
 *   • Suppression / opt-out are FLAGS, reachable from any stage — opting out
 *     must always be possible and never loses history.
 *   • Source data carries a retention deadline at ingest; expired candidates
 *     are ineligible for outreach until refreshed from the source.
 *   • Only PERMITTED business fields are stored (name, category, area,
 *     source site/contact, evidence). Raw provider payloads are never kept.
 *   • The stored score/criteria are computed SERVER-side from the stored
 *     fields — a client can never submit a score or an evidence string.
 */

import { createHash, createHmac } from 'crypto';

/* ── Collections ─────────────────────────────────────────────────────────── */

export const CANDIDATES_COLLECTION = 'shopAgentCandidates';
export const MESSAGES_COLLECTION = 'shopAgentMessages';
export const PACKAGES_COLLECTION = 'shopAgentPackages';
export const SUPPRESSION_COLLECTION = 'shopAgentSuppression';
export const CONTACTS_COLLECTION = 'shopAgentContacts';
export const CAMPAIGN_DOC_ID = 'shopAgentCampaign/main';

/**
 * The `?camp=` attribution value carried by every invitation link (validated
 * by the event spine against `^[A-Za-z0-9_-]{1,64}$`). One constant shared by
 * link building and the funnel reader, so counting can never drift from
 * sending.
 */
export const CAMPAIGN_TRACKING_ID = 'shopagent';

/** Template/format version — bumping it changes message ids (a new campaign
 *  may contact the same business once more; the old message doc stays). */
export const PACKAGE_VERSION = 'v1';

/* ── Sources & retention ─────────────────────────────────────────────────── */

export const SCOUT_SOURCES = ['google_places', 'manual'] as const;
export type ScoutSource = (typeof SCOUT_SOURCES)[number];

/**
 * Source-specific retention (days from ingest). Places data may be cached
 * only briefly under Google's terms, so it expires first; manually supplied
 * leads are the admin's own records and kept longer. An expired candidate is
 * never eligible for outreach until a fresh retrieval refreshes it.
 */
export const SOURCE_RETENTION_DAYS: Record<ScoutSource, number> = {
  google_places: 30,
  manual: 365,
};

/** Attribution string required whenever a third-party source supplied data. */
export const SOURCE_ATTRIBUTION: Record<ScoutSource, string> = {
  google_places: 'Google',
  manual: 'Admin-entered lead',
};

export function retentionDaysFor(source: ScoutSource): number {
  return SOURCE_RETENTION_DAYS[source] ?? SOURCE_RETENTION_DAYS.manual;
}

/* ── Pilot configuration ─────────────────────────────────────────────────── */

/**
 * Pilot geography: Karura and nearby areas in Kiambu, Kenya. The centre point
 * below is an APPROXIMATE default for the pilot — confirm/adjust it in the
 * scout request before the first run (radius and categories are always
 * request-supplied and bounded).
 */
export const PILOT_AREA = {
  label: 'Karura & environs, Kiambu',
  lat: -1.18,
  lng: 36.78,
  radiusKm: 10,
} as const;

export const DEFAULT_CATEGORIES = [
  'clothing',
  'shoes',
  'electronics',
  'furniture',
  'beauty',
  'restaurants',
  'local_services',
] as const;
export type OpportunityCategory = (typeof DEFAULT_CATEGORIES)[number];

/** Hard bounds so a scout request can never fan out unbounded. */
export const SCOUT_LIMITS = {
  maxRadiusKm: 50,
  maxBatch: 50,
  defaultBatch: 20,
} as const;

/* ── Contact & compliance ────────────────────────────────────────────────── */

/**
 * How we are permitted to contact a business. `public_directory_business_
 * listing` means the source itself published the contact as a business
 * channel; `admin_attested_lead` means an admin supplied the lead and takes
 * responsibility for the basis. No basis ⇒ never eligible for outreach.
 */
export const CONTACT_BASES = ['public_directory_business_listing', 'admin_attested_lead'] as const;
export type ContactBasis = (typeof CONTACT_BASES)[number];

export const CONTACT_KINDS = ['email', 'phone', 'website_form'] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export interface ContactChannel {
  kind: ContactKind;
  /** As published by the source (or attested by the admin). Never invented. */
  value: string;
}

/** Normalised, stable key for suppression / max-one-contact enforcement. */
export function contactKey(channel: ContactChannel): string {
  const raw = channel.value.trim().toLowerCase();
  const cleaned = channel.kind === 'phone' ? raw.replace(/[^0-9+]/g, '') : raw.replace(/\s+/g, '');
  return createHash('sha256').update(`${channel.kind}:${cleaned}`).digest('hex').slice(0, 40);
}

export function contactKeyId(kind: ContactKind, value: string): string {
  return contactKey({ kind, value });
}

/* ── Candidate ───────────────────────────────────────────────────────────── */

export const CANDIDATE_STAGES = [
  'discovered',
  'eligible',
  'rejected',
  'invitation_approved',
  'message_sent',
  'replied',
  'onboarding',
  'registered',
  'shop_published',
  'product_published',
] as const;
export type CandidateStage = (typeof CANDIDATE_STAGES)[number];

/**
 * Monotonic funnel with exactly two review loops:
 *   • `rejected → eligible` — an admin re-review;
 *   • `invitation_approved → rejected` — withdrawal before anything was sent.
 * Everything else moves forward only, so stage counts can never double-count
 * a business in two funnel buckets at once.
 */
export const CANDIDATE_TRANSITIONS: Record<CandidateStage, readonly CandidateStage[]> = {
  discovered: ['eligible', 'rejected'],
  eligible: ['rejected', 'invitation_approved'],
  rejected: ['eligible'],
  invitation_approved: ['message_sent', 'rejected'],
  message_sent: ['replied'],
  replied: ['onboarding'],
  onboarding: ['registered'],
  registered: ['shop_published'],
  shop_published: ['product_published'],
  product_published: [],
};

export function canTransitionCandidate(from: CandidateStage, to: CandidateStage): boolean {
  if (from === to) return true;
  return (CANDIDATE_TRANSITIONS[from] ?? []).includes(to);
}

export interface Suppression {
  suppressed: boolean;
  /** `opt_out` | `manual` | `complaint` | `expired` — stored, never hidden. */
  reason?: string;
  at?: string;
  source?: 'recipient' | 'admin';
}

export interface ScoreCriterion {
  id: string;
  label: string;
  weight: number;
  met: boolean;
  /** Evidence-based explanation — never a rating or review count. */
  explanation: string;
}

export interface EligibilitySnapshot {
  score: number;
  maxScore: number;
  recommendation: 'eligible' | 'needs_review' | 'ineligible';
  criteria: ScoreCriterion[];
  computedAt: string;
}

export interface ShopAgentCandidate {
  id: string;
  source: ScoutSource;
  /** Provider id (place_id) or a stable manual key. Used for dedup only. */
  sourceId: string;
  sourceAttribution: string;
  sourceRetrievedAt: string;
  /** ISO — retention deadline for this source's data. */
  expiresAt: string;
  name: string;
  category: string;
  area: string | null;
  website: string | null;
  contact: ContactChannel | null;
  /** Permitted basis for contacting this business (null ⇒ not contactable). */
  contactBasis: ContactBasis | null;
  /** Source-derived facts only. Ratings/reviews are forbidden inputs. */
  evidence: string[];
  stage: CandidateStage;
  suppression: Suppression;
  eligibility: EligibilitySnapshot | null;
  linkedUid: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

/* ── Outreach messages ───────────────────────────────────────────────────── */

export const OUTREACH_CHANNELS = ['email', 'sms', 'whatsapp'] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export const MESSAGE_STATES = [
  'pending_approval',
  'approved',
  'sending',
  'sent',
  'dev_captured',
  'delivered',
  'failed',
  'cancelled',
] as const;
export type MessageState = (typeof MESSAGE_STATES)[number];

export const MESSAGE_TRANSITIONS: Record<MessageState, readonly MessageState[]> = {
  pending_approval: ['approved', 'cancelled'],
  approved: ['sending', 'cancelled'],
  // `sending → approved` is the bounded retry requeue (attempt cap enforced
  // separately); everything else is a real provider outcome.
  sending: ['sent', 'dev_captured', 'delivered', 'failed', 'approved', 'cancelled'],
  sent: ['delivered'],
  dev_captured: [],
  delivered: [],
  failed: ['approved', 'cancelled'],
  cancelled: [],
};

export function canTransitionMessage(from: MessageState, to: MessageState): boolean {
  if (from === to) return true;
  return (MESSAGE_TRANSITIONS[from] ?? []).includes(to);
}

export const MAX_MESSAGE_ATTEMPTS = 3;

/* ── Package (draft marketing kit) ───────────────────────────────────────── */

export const ASSET_STATES = [
  'draft',
  'generated',
  'approved',
  'rejected',
  'not_configured',
  'failed',
  'disabled',
] as const;
export type AssetState = (typeof ASSET_STATES)[number];

export interface AssetRecord {
  state: AssetState;
  /** Public URL when actually generated/approved — null otherwise. */
  url: string | null;
  mediaId: string | null;
  provider: string | null;
  at: string | null;
  /** Credential-free, single-line reason for not_configured/failed/disabled. */
  note: string | null;
}

export interface MessageVariants {
  subject: string;
  email: string;
  whatsapp: string;
  sms: string;
  /** Tracked registration link (existing `camp` attribution parameter). */
  registrationLink: string;
  optOutLink: string;
}

export interface ShopAgentPackage {
  id: string;
  candidateId: string;
  version: string;
  state: 'draft' | 'approved' | 'rejected';
  variants: MessageVariants;
  poster: AssetRecord;
  video: AssetRecord;
  /** Copy provenance: `template` = deterministic, always honest. */
  copySource: 'template';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/* ── Campaign configuration (one doc) ────────────────────────────────────── */

export interface ShopAgentCampaign {
  id: string;
  /** Global kill switch — sending is impossible while true. */
  paused: boolean;
  /** Double gate: the campaign must be acknowledged AND each message approved. */
  complianceAcknowledged: boolean;
  senderName: string;
  dailyMessageLimit: number;
  dailyBudgetMinor: number;
  currency: 'KES';
  /** Estimated cost per delivered attempt, minor units, by channel. */
  costPerMessageMinor: Record<OutreachChannel, number>;
  /** Date-keyed counters (server-written inside the send transaction). */
  sendCountByDate: Record<string, number>;
  spendMinorByDate: Record<string, number>;
  updatedBy: string | null;
  updatedAt: string;
}

export const CAMPAIGN_DEFAULTS: Omit<ShopAgentCampaign, 'id' | 'updatedAt'> = {
  paused: true, // messaging is OFF until an admin deliberately resumes it
  complianceAcknowledged: false,
  senderName: 'Vidnov Growth Team',
  dailyMessageLimit: 10,
  dailyBudgetMinor: 100_000, // KES 1,000/day default cap (minor units)
  currency: 'KES',
  costPerMessageMinor: { email: 0, sms: 0, whatsapp: 0 },
  sendCountByDate: {},
  spendMinorByDate: {},
  updatedBy: null,
};

/* ── Deterministic ids (dedup & idempotency) ─────────────────────────────── */

function sha(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 40);
}

/** One candidate per (source, sourceId) — a re-scout is a no-op on existing. */
export function candidateDocId(source: ScoutSource, sourceId: string): string {
  return `sac_${sha(`${source}:${sourceId.trim().toLowerCase()}`)}`;
}

/** One message per (candidate, channel, version) — enqueueing twice is one doc. */
export function messageDocId(candidateId: string, channel: OutreachChannel): string {
  return `sam_${sha(`${candidateId}:${channel}:${PACKAGE_VERSION}`)}`;
}

/** One package per candidate — regeneration overwrites the same doc. */
export function packageDocId(candidateId: string): string {
  return `sap_${sha(`${candidateId}:${PACKAGE_VERSION}`)}`;
}

export function suppressionDocId(key: string): string {
  return `sas_${key}`;
}

export function contactDocId(key: string): string {
  return `sat_${key}`;
}

/* ── Opt-out tokens (HMAC — public endpoint, no session) ─────────────────── */

/**
 * The opt-out link a recipient can use without any account. The token binds
 * the candidate id with an HMAC keyed by a server-side secret: forging one
 * requires the secret, and a leaked token only ever opts THAT contact out.
 * With no secret configured, no message can be sent at all (fail closed),
 * so the opt-out path can never be missing while outreach is live.
 */
export function optOutToken(candidateId: string, secret: string): string {
  return createHmac('sha256', secret).update(`optout:${candidateId}`).digest('base64url').slice(0, 40);
}

export function verifyOptOutToken(candidateId: string, secret: string, token: string): boolean {
  if (!candidateId || !secret || !token) return false;
  const expected = optOutToken(candidateId, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(token.slice(0, 64));
  return a.length === b.length && a.equals(b); // length-checked, constant-ish
}

/**
 * The server-side signing secret for outreach (opt-out tokens). A dedicated
 * `VIDNOV_SHOP_AGENT_SECRET` is preferred; `CRON_SECRET` is accepted so an
 * existing deployment can enable outreach without a new variable. Empty ⇒
 * outreach and the opt-out endpoint both fail closed — no secret, no send.
 */
export function outreachSecret(env: Record<string, string | undefined> = process.env): string {
  return env.VIDNOV_SHOP_AGENT_SECRET || env.CRON_SECRET || '';
}

/* ── Message copy bounds & fabrication guard (pure) ──────────────────────── */

export const COPY_LIMITS = {
  subject: 120,
  email: 4000,
  whatsapp: 1024,
  sms: 306, // 2 GSM-7 segments — Kenyan short-message norms
} as const;

/**
 * Claims no outreach copy may ever make. Marketing copy that promises
 * outcomes, invents testimonials or implies endorsement is rejected at
 * build time — the guard runs on every generated package and is asserted
 * directly by the tests.
 */
export const FABRICATION_PATTERNS: Array<[RegExp, string]> = [
  [/guarantee[ds]?\s+(customers|sales|income|profit|results|revenue)/i, 'guaranteed outcome'],
  [/we\s+promise/i, 'promise of results'],
  [/\btestimonial/i, 'testimonial claim'],
  [/proven\s+results/i, 'unverifiable result claim'],
  [/\b100%\s+(profit|income|success)\b/i, 'guaranteed outcome'],
  [/endorsed\s+by/i, 'endorsement claim'],
];

/** Returns the first fabrication hit, or null. Pure. */
export function findFabrication(text: string): string | null {
  for (const [pattern, label] of FABRICATION_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return null;
}
