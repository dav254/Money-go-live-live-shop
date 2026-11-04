/**
 * SOCIAL ENGINE — shared types (pure module, no I/O).
 *
 * One vocabulary for every integration module the administrator readiness
 * dashboard renders. Nothing here reads env vars or the network, so the
 * state machine in `readiness.ts` can be unit-tested exhaustively.
 */

/**
 * The seven readiness states, in lifecycle order.
 *
 * NOT CONFIGURED → CONFIGURED → CONNECTED → TESTED → READY, with two
 * side states: APPROVAL_REQUIRED (provider approval missing) and ERROR
 * (a specific failure needs attention).
 *
 * Env vars existing is NEVER enough for READY: READY is reachable only by
 * a successful publish-level test (see `TestKind`).
 */
export const READINESS_STATES = [
  'NOT_CONFIGURED',
  'CONFIGURED',
  'CONNECTED',
  'TESTED',
  'READY',
  'APPROVAL_REQUIRED',
  'ERROR',
] as const;
export type ReadinessState = (typeof READINESS_STATES)[number];

/** Every integration module on the dashboard. */
export const MODULE_IDS = [
  'telegram',
  'tiktok',
  'bluesky',
  'tumblr',
  'mastodon',
  'discord',
  'facebook',
  'instagram',
  'google',
  'livekit',
  'pocketbase',
  'media',
  'urls',
  'publishing',
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export function isModuleId(value: string): value is ModuleId {
  return (MODULE_IDS as readonly string[]).includes(value);
}

/**
 * What a recorded test actually proved. The dashboard promotes a module's
 * state to match the STRONGEST recorded test:
 *
 *   auth        — credentials authenticate (bot getMe, app session, token).
 *   diagnostic  — the safe full check (auth + permissions/destination).
 *   publish     — a real, neutral publish (or the module's intended service
 *                 for infrastructure modules such as media) succeeded.
 */
export type TestKind = 'auth' | 'diagnostic' | 'publish';

/**
 * Which recorded test proves a module's intended service — comes from the
 * module spec (`readyBy`). A publish-level test is required for READY on
 * every platform that publishes; infrastructure modules are proven by their
 * diagnostic instead.
 */
export type ReadyBy = 'publish' | 'diagnostic' | 'none';

/**
 * One recorded test outcome. `note` is a STATIC or sanitized human string —
 * upstream response bodies and credentials never enter this record (see
 * `sanitizeErrorMessage` in distribution/job-utils).
 */
export interface TestRecord {
  kind: TestKind;
  ok: boolean;
  /** ISO timestamp. */
  at: string;
  /** Sanitized, safe-to-display note. Never contains secrets. */
  note: string;
  /** The platform's own id when this was a publish test. */
  remoteId?: string;
  /** Permission/destination verdict captured with the test, if any. */
  permissions?: { granted: boolean; note: string };
  /** Provider account label (handle/username) — never a token. */
  accountLabel?: string;
  /** Scope NAMES granted (names only). */
  scopes?: string[];
}

/** Account connection as stored server-side (tokens never leave encrypted). */
export interface ConnectionInfo {
  connected: boolean;
  /** Provider-supplied account label (handle, username, email). Never a token. */
  accountLabel?: string;
  scopes?: string[];
  connectedAt?: string;
  disconnectedAt?: string;
}

/** Provider-approval gate (TikTok direct publish, Google consent verification). */
export interface ApprovalInfo {
  required: boolean;
  granted: boolean;
  note: string;
}

/** Env var presence, NAME only — values are never surfaced anywhere. */
export interface EnvVarStatus {
  name: string;
  present: boolean;
  /** What this variable is for (never its value). */
  role: string;
  /** True when absent variables block the module entirely. */
  required: boolean;
}

/** The full, renderable readiness record for one module. */
export interface ModuleReadiness {
  id: ModuleId;
  label: string;
  /** Why this integration exists for Vidnov (one or two sentences). */
  purpose: string;
  state: ReadinessState;
  /** Names only, sorted. */
  requiredEnvVars: string[];
  missingEnvVars: string[];
  env: EnvVarStatus[];
  connection: ConnectionInfo;
  approval: ApprovalInfo;
  /** Permission/destination status for env-based channels (e.g. can post). */
  permissions: { granted: boolean; note: string };
  lastAuthTest?: TestRecord;
  lastDiagnostic?: TestRecord;
  lastPublishTest?: TestRecord;
  /** The most recent failure, kept for display even after later successes. */
  lastError?: { at: string; note: string };
  /**
   * A Share-to-TikTok-style handoff that was prepared but NOT confirmed
   * published. Displayed separately from `lastPublishTest` forever — a
   * handoff is never a published post (task §2).
   */
  lastHandoff?: { at: string; note: string };
  /** The single next thing an administrator must do. */
  nextStep: string;
  /** Activation guidance (short, safe — no secrets). */
  activation: string;
}

/**
 * The six attribution events, kept strictly SEPARATE (task §4): a share
 * handoff is not a publish, a visit is not an enquiry, an enquiry is not an
 * order. Only the engine's OWN actions are recorded here — incoming visits
 * and referrer clicks already flow through the existing growth-events
 * pipeline (`?ref=` / `?ch=` / `?camp=` on the URLs built in `url-tracking.ts`).
 * External metrics (views/likes/reach) are never recorded by this engine.
 */
export const ATTRIBUTION_EVENTS = [
  'share_handoff_initiated',
  'post_confirmed_published',
  'referral_link_clicked',
  'website_visit_received',
  'enquiry_submitted',
  'order_completed',
] as const;
export type AttributionEvent = (typeof ATTRIBUTION_EVENTS)[number];

/** Entry written to the audit trail on every state-changing action. */
export interface AuditEntry {
  module: ModuleId | 'engine';
  action: 'diagnostic' | 'publish_test' | 'connect' | 'disconnect' | 'status_view' | 'handoff' | 'approval';
  actorUid: string;
  outcome: 'ok' | 'failed' | 'refused';
  /** Sanitized note. */
  note?: string;
  /** Which of the six attribution events this entry corresponds to. */
  event?: AttributionEvent;
  at: string;
}
