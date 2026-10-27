/**
 * VIDNOV CORE ENGINE — canonical types.
 *
 * The engine REFERENCES existing entities (products/{productId},
 * userProfiles/{uid}, orders/{orderId}) and never copies them. Everything in
 * this file is pure data definitions: no Firestore imports, no I/O, safe to
 * import from tests and (where marked) client code.
 */

/* ── Canonical entity references ─────────────────────────────────────────── */

/** A document id — never a path, never a URL. */
export const DOC_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export interface ProductRef {
  productId: string;
}

export interface SellerRef {
  sellerId: string;
}

/* ── Distribution Hub ────────────────────────────────────────────────────── */

export const CHANNEL_IDS = [
  'google',
  'meta',
  'tiktok',
  // Free-first destinations (Core Engine — distribution control center).
  'sitemap',
  'indexnow',
  'bing',
  'search_console',
  'ga',
] as const;
export type ChannelId = (typeof CHANNEL_IDS)[number];

/**
 * Integration status of a channel for this deployment. `configured` may only
 * be true when real credentials/approvals exist; the adapters never upgrade
 * this on their own.
 */
export type IntegrationStatus = 'not_configured' | 'configured';

/**
 * Job lifecycle. `not_configured → ready → queued → processing → submitted →
 * live`, plus `failed` (retryable within limits) and `needs_attention`
 * (a human must look). A channel that lacks credentials can only ever reach
 * `ready` — no code path claims `live` without a real integration reporting it.
 */
export const JOB_STATUSES = [
  'not_configured',
  'ready',
  'queued',
  'processing',
  'submitted',
  'live',
  'failed',
  'needs_attention',
  // Distribution was deliberately HALTED because the product became private,
  // was deleted, changed owner or failed eligibility. `stopped` never claims
  // anything about the outside world — it only stops OUR future pushes, and
  // it is reachable from every state (stopping must always be possible).
  'stopped',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/**
 * Allowed transitions. Terminal-ish states: `live` and `needs_attention` only
 * move back through an explicit human/adapter action (re-queue), which is why
 * `live → queued` and `needs_attention → queued` are permitted but nothing
 * skips forward past its neighbours.
 */
export const JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  not_configured: ['ready', 'failed', 'stopped'],
  ready: ['queued', 'not_configured', 'failed', 'stopped'],
  queued: ['processing', 'failed', 'needs_attention', 'stopped'],
  processing: ['submitted', 'failed', 'needs_attention', 'stopped'],
  submitted: ['live', 'failed', 'needs_attention', 'stopped'],
  live: ['queued', 'needs_attention', 'stopped'],
  failed: ['queued', 'not_configured', 'stopped'],
  needs_attention: ['queued', 'failed', 'stopped'],
  // A stopped job only comes back through `ready`, which is the one state a
  // fresh eligibility re-check must pass before anything can queue again.
  stopped: ['ready'],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return true; // idempotent re-assert
  return (JOB_TRANSITIONS[from] ?? []).includes(to);
}

/** Safe, non-secret error classification. Raw upstream bodies are never stored. */
export const ERROR_CLASSES = [
  'auth',
  'validation',
  'rate_limited',
  'transient',
  'not_configured',
  'unknown',
] as const;
export type ErrorClass = (typeof ERROR_CLASSES)[number];

/** Only these classes are worth an automatic retry. */
export const RETRYABLE_ERROR_CLASSES: readonly ErrorClass[] = [
  'rate_limited',
  'transient',
];

/** Hard cap on automatic attempts per job. */
export const MAX_JOB_ATTEMPTS = 3;

export interface SafeJobError {
  class: ErrorClass;
  /** Short, human-readable, credential-free message. */
  message: string;
  attempt: number;
  at: string; // ISO timestamp
}

/* ── Destination confirmation (per-destination publication truth) ───────── */

/**
 * What we can honestly claim about ONE destination for ONE listing.
 *
 * The job `status` is the workflow (prepared → queued → submitted → …);
 * this is the OUTSIDE-WORLD claim, tracked separately per destination:
 *
 *   • `none`      — nothing submitted yet;
 *   • `accepted`  — the remote API accepted our request (HTTP success ONLY:
 *                   this is the most an unverified 2xx may ever claim);
 *   • `published` — our own verified source of truth confirms the listing is
 *                   publicly served there (e.g. the URL is present in the
 *                   live sitemap);
 *   • `indexed`   — a remote API that reports index state confirmed it;
 *   • `unknown`   — the response was ambiguous (timeout, no status API):
 *                   we know NOTHING, and say so;
 *   • `failed`    — the destination rejected the submission.
 *
 * `published`/`indexed` may ONLY be set by a verification step reading a real
 * confirmation — never because an API returned HTTP success.
 */
export const CONFIRMATION_STATES = [
  'none',
  'accepted',
  'published',
  'indexed',
  'unknown',
  'failed',
] as const;
export type ConfirmationState = (typeof CONFIRMATION_STATES)[number];

/** States that require a VERIFIED confirmation before they may be claimed. */
export const VERIFIED_CONFIRMATION_STATES: readonly ConfirmationState[] = [
  'published',
  'indexed',
];

/** Per-destination confirmation record stored on the job document. */
export interface JobConfirmation {
  state: ConfirmationState;
  /** Remote identifier (request id / confirmed URL) — sanitized, no secrets. */
  remoteId?: string | null;
  /** ISO timestamp of the last state change. */
  at: string;
  /** ISO timestamp when a verification step confirmed it (if ever). */
  verifiedAt?: string | null;
  /** Short, credential-free note for the admin view. */
  message?: string | null;
}

/** One persisted submission attempt — bounded history, sanitized fields. */
export interface SubmissionRecord {
  /** ISO timestamp. */
  at: string;
  attempt: number;
  outcome: 'accepted' | 'rejected' | 'unknown' | 'error';
  /** Remote request id, when the API returned one — never a token. */
  remoteId?: string;
  /** HTTP status code only — response BODIES are never stored. */
  responseStatus?: number;
  errorClass?: ErrorClass;
  /** Sanitized, single-line, ≤200 chars. */
  message?: string;
}

/** Submission history kept per job (newest first, hard-bounded). */
export const MAX_SUBMISSION_LOG = 5;

/** Admin re-queues of dead-letter jobs are explicitly bounded. */
export const MAX_ADMIN_REQUEUES = 2;

/* ── Core events ─────────────────────────────────────────────────────────── */

/**
 * Meaningful activities the engine can record. Product views and share
 * clicks already flow through the Growth Engine spine (`view`/`click` in
 * src/lib/growth); this enum covers the rest of the journey.
 *
 * `distribution_job_succeeded | distribution_job_failed |
 * opportunity_task_approved` are emitted by this engine's own services.
 * The remaining types exist so future wiring (checkout, buyer requests)
 * uses ONE vocabulary instead of inventing per-feature event names.
 */
export const CORE_EVENT_TYPES = [
  'product_viewed',
  'share_link_opened',
  'qualified_enquiry_created',
  'buyer_request_submitted',
  'seller_offer_submitted',
  'order_confirmed',
  'order_completed',
  'distribution_job_succeeded',
  'distribution_job_failed',
  'opportunity_task_approved',
] as const;
export type CoreEventType = (typeof CORE_EVENT_TYPES)[number];

/**
 * `server` events are server-verified outcomes and may feed verified metrics.
 * `client_observation` events are observational only and must never be treated
 * as proof of a sale, a completed task or a payable reward.
 */
export type EventOrigin = 'server' | 'client_observation';

/** What the event is about. */
export const EVENT_ENTITY_KINDS = [
  'product',
  'shop',
  'order',
  'opportunity',
  'application',
  'distribution_job',
] as const;
export type EventEntityKind = (typeof EVENT_ENTITY_KINDS)[number];

/** Attribution captured from a Vidnov tracking link — never a client claim. */
export interface Attribution {
  /** Existing referral/invite code format (see lib/referrals + growth spine). */
  ref?: string;
  /** Distribution channel identifier, e.g. `google`, `meta`, `tiktok`. */
  channel?: ChannelId;
  /** Optional campaign id supplied when the tracked link was created. */
  campaign?: string;
}

/* ── Generic API envelopes ───────────────────────────────────────────────── */

/** Standard safe error shape for engine routes: no stacks, no secrets. */
export interface EngineError {
  error: string;
}
