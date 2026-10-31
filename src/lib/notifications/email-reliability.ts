/**
 * VIDNOV email reliability — PURE module (no I/O, no Firestore, no fetch).
 *
 * Everything here is deterministic and unit-tested:
 *
 *   • error classification — a provider failure is reduced to a safe category
 *     (`rate_limited | timeout | server | config | invalid | unknown`), never
 *     an upstream body, so logs and retries can reason about causes instead
 *     of strings;
 *   • retry policy — ONLY transient classes are retried, only up to
 *     `RETRY_MAX_ATTEMPTS`, never for one-time-link templates, never for a
 *     suppressed address, never in development mode;
 *   • webhook verification — the Resend (svix) HMAC scheme, timing-safe,
 *     with a ±5 minute timestamp tolerance and fail-closed behaviour;
 *   • event mapping — provider webhook event → the `EmailStatus` vocabulary,
 *     so nothing is ever called `DELIVERED` because the API accepted a send;
 *   • duplicate cooldown — a re-fired verification/reset/welcome within the
 *     cooldown window is skipped instead of spamming the same recipient.
 *
 * Storage-side operations live in `email-store.ts`; the send pipeline lives
 * in `email-service.ts`.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/* ── Error classification ───────────────────────────────────────────────── */

export type ErrorClass =
  | 'rate_limited'
  | 'timeout'
  | 'server'
  | 'config'
  | 'invalid'
  | 'bounce'
  | 'suppressed'
  | 'unknown';

/** Classes that may legitimately succeed on a later attempt. */
const TRANSIENT_CLASSES: ReadonlySet<ErrorClass> = new Set(['rate_limited', 'timeout', 'server']);

export function isTransientClass(errorClass: string | undefined): boolean {
  return TRANSIENT_CLASSES.has(errorClass as ErrorClass);
}

/**
 * Maps an HTTP status (and optionally the small error body the provider
 * returned) onto a safe category. Never returns upstream text.
 */
export function classifySendError(status?: number, body?: string): ErrorClass {
  const text = (body ?? '').toLowerCase();
  if (text.includes('not configured') || text.includes('missing credentials')) return 'config';
  if (status === 429 || status === 408) return 'rate_limited';
  if (status === 401 || status === 403) return 'config';
  if (status !== undefined && status >= 500) return 'server';
  if (status !== undefined && status >= 400) return 'invalid';
  if (/timed? ?out|abort|network|econn|fetch failed/.test(text)) return 'timeout';
  return 'unknown';
}

/** Classifies a thrown fetch error (the response never arrived). */
export function classifyThrown(error: unknown): ErrorClass {
  const name = (error as { name?: string } | null)?.name ?? '';
  const message = (error as { message?: string } | null)?.message ?? '';
  if (name === 'TimeoutError' || name === 'AbortError' || /timed? ?out|abort/i.test(message)) {
    return 'timeout';
  }
  if (/econn|network|fetch failed|socket|dns/i.test(message)) return 'server';
  return 'unknown';
}

/* ── Retry policy ────────────────────────────────────────────────────────── */

/** Hard cap on attempts (1 initial + retries). */
export const RETRY_MAX_ATTEMPTS = 3;

/**
 * One-time-link templates are NEVER retried from a stored job: their bodies
 * contain raw expiring tokens, and a user who needs one can simply request it
 * again (which already invalidates the previous token).
 */
export const RETRY_EXCLUDED_TEMPLATES: readonly string[] = ['password-reset', 'verify-email'];

export interface RetryDecisionInput {
  templateKey: string;
  /** Attempts already made INCLUDING the one that just failed. */
  attempts: number;
  errorClass?: string | undefined;
  suppressed?: boolean;
  mode: 'development' | 'production';
}

/**
 * The single gate every retry passes through. Denies are explainable:
 * excluded template, cap reached, permanent class, suppression, or dev mode.
 */
export function shouldRetry(input: RetryDecisionInput): { retry: boolean; reason: string } {
  if (input.mode !== 'production') return { retry: false, reason: 'not_production' };
  if (input.suppressed) return { retry: false, reason: 'suppressed' };
  if (RETRY_EXCLUDED_TEMPLATES.includes(input.templateKey)) {
    return { retry: false, reason: 'one_time_link_template' };
  }
  if (input.attempts >= RETRY_MAX_ATTEMPTS) return { retry: false, reason: 'attempts_exhausted' };
  if (!isTransientClass(input.errorClass)) return { retry: false, reason: 'permanent_error' };
  return { retry: true, reason: 'transient' };
}

/**
 * Bounded exponential backoff in minutes: 5 → 15 → 45, never above
 * `RETRY_BACKOFF_MAX_MINUTES` no matter how the attempt count grows.
 */
export const RETRY_BACKOFF_MAX_MINUTES = 60;

export function retryDelayMinutes(attempt: number): number {
  const n = Math.max(1, Math.floor(attempt));
  return Math.min(RETRY_BACKOFF_MAX_MINUTES, 5 * 3 ** (n - 1));
}

export function nextAttemptIso(nowMs: number, attempt: number): string {
  return new Date(nowMs + retryDelayMinutes(attempt) * 60_000).toISOString();
}

/* ── Webhook signature verification (svix scheme used by Resend) ─────────── */

export const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60_000;

export interface WebhookHeaders {
  /** `svix-id` — the event's delivery id (also our idempotency key). */
  id?: string | undefined;
  /** `svix-timestamp` — unix seconds. */
  timestamp?: string | undefined;
  /** `svix-signature` — space-separated `v1,<base64>` entries. */
  signature?: string | undefined;
}

export type WebhookVerifyReason =
  | 'missing_secret'
  | 'missing_header'
  | 'bad_timestamp'
  | 'bad_signature';

export interface WebhookVerifyResult {
  ok: boolean;
  reason?: WebhookVerifyReason;
}

/**
 * Timing-safe HMAC-SHA256 verification of the svix signing scheme:
 *   signed content = `${id}.${timestamp}.${rawBody}`
 * Secret forms accepted: `whsec_<base64>` (svix default) or a raw string.
 * FAILS CLOSED: no secret, no headers, stale timestamps or any mismatch →
 * `ok: false`.
 */
export function verifyWebhookSignature(opts: {
  secret: string;
  headers: WebhookHeaders;
  rawBody: string;
  nowMs?: number;
}): WebhookVerifyResult {
  const secret = (opts.secret ?? '').trim();
  if (!secret) return { ok: false, reason: 'missing_secret' };

  const { id, timestamp, signature } = opts.headers;
  if (!id || !timestamp || !signature) return { ok: false, reason: 'missing_header' };

  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > WEBHOOK_TIMESTAMP_TOLERANCE_MS / 1000) {
    return { ok: false, reason: 'bad_timestamp' };
  }

  const secretBytes = decodeSecret(secret);
  const expected = createHmac('sha256', secretBytes)
    .update(`${id}.${timestamp}.${opts.rawBody}`)
    .digest('base64');

  // Multiple space-separated signatures may be present; any valid v1 wins.
  const candidates = signature.split(' ').filter(Boolean);
  for (const candidate of candidates) {
    const [, value] = candidate.split(',', 2);
    if (!value) continue;
    if (constantTimeEqualBase64(value, expected)) return { ok: true };
  }
  return { ok: false, reason: 'bad_signature' };
}

function decodeSecret(secret: string): Buffer {
  const trimmed = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  try {
    const decoded = Buffer.from(trimmed, 'base64');
    // A base64 round-trip that matches means it really was base64.
    if (decoded.length > 0 && decoded.toString('base64').replace(/=+$/, '') === trimmed.replace(/=+$/, '')) {
      return decoded;
    }
  } catch {
    /* fall through to raw bytes */
  }
  return Buffer.from(secret, 'utf8');
}

function constantTimeEqualBase64(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'base64');
  const bufB = Buffer.from(b, 'base64');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * A stable, safe document id for an incoming event (idempotency key).
 * Only `[A-Za-z0-9_-]` pass through; anything else is hashed so a forged
 * header can never shape a document id.
 */
export function sanitizeEventId(raw: string): string {
  const value = (raw ?? '').trim();
  if (/^[A-Za-z0-9_-]{1,128}$/.test(value)) return value;
  return `evt_${createHash('sha256').update(value.slice(0, 512)).digest('hex').slice(0, 40)}`;
}

/* ── Provider event → status vocabulary ─────────────────────────────────── */

export type EmailEventType = 'sent' | 'delivered' | 'delayed' | 'bounced' | 'failed' | 'complained';

/** `null` for unknown/ignored event types — never guessed. */
export function parseEmailEvent(type: string): EmailEventType | null {
  switch (type) {
    case 'email.sent': return 'sent';
    case 'email.delivered': return 'delivered';
    case 'email.delivery_delayed': return 'delayed';
    case 'email.bounced': return 'bounced';
    case 'email.failed': return 'failed';
    case 'email.complained': return 'complained';
    default: return null;
  }
}

/** The `EmailStatus` a confirmed event proves. `null` = no status change. */
export function statusForEvent(
  event: EmailEventType,
): 'SENT' | 'DELIVERED' | 'DELAYED' | 'BOUNCED' | 'FAILED' | null {
  switch (event) {
    case 'sent': return 'SENT';
    case 'delivered': return 'DELIVERED';
    case 'delayed': return 'DELAYED';
    case 'bounced': return 'BOUNCED';
    case 'failed': return 'FAILED';
    case 'complained': return 'BOUNCED';
    default: return null;
  }
}

/**
 * A bounce is treated as PERMANENT (→ suppression, never retried) unless the
 * payload explicitly marks it transient — when in doubt we suppress, because
 * repeatedly mailing a hard-bouncing address is how domains get blocklisted.
 */
export function bounceIsPermanent(payload: Record<string, unknown> | undefined): boolean {
  const bounce = (payload?.bounce ?? payload?.['bounce'] ?? {}) as Record<string, unknown>;
  const kind = String(bounce.type ?? bounce.kind ?? '').toLowerCase();
  if (['transient', 'soft', 'temporary'].includes(kind)) return false;
  return true;
}

/* ── Addresses ───────────────────────────────────────────────────────────── */

/** RFC-ish, deliberately conservative: bounded, no display names. */
export function isValidAddress(address: string): boolean {
  const value = (address ?? '').trim();
  if (!value || value.length > 254) return false;
  if (value.includes('<') || value.includes('>') || /[\s,;]/.test(value)) return false;
  return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(value);
}

export function normalizeAddress(address: string): string {
  return (address ?? '').trim().toLowerCase();
}

/* ── Duplicate-send cooldown ─────────────────────────────────────────────── */

/** Templates that must never double-fire inside the cooldown window. */
export const DUPLICATE_COOLDOWN_TEMPLATES: readonly string[] = [
  'verify-email',
  'welcome',
  'password-reset',
];

export const DUPLICATE_COOLDOWN_MS = 60_000;

export function hasDuplicateCooldown(
  templateKey: string,
  lastSentAtMs: number | null | undefined,
  nowMs: number,
): boolean {
  if (!DUPLICATE_COOLDOWN_TEMPLATES.includes(templateKey)) return false;
  if (lastSentAtMs === null || lastSentAtMs === undefined) return false;
  return nowMs - lastSentAtMs < DUPLICATE_COOLDOWN_MS;
}
