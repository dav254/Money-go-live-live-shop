/**
 * GROWTH EVENT SPINE — shared, PURE validation and identity helpers.
 *
 * Phase 1 of the Growth Engine: real exposure measurement + share
 * attribution. This module is imported by BOTH the browser (fire-and-forget
 * tracking helpers) and the server (`POST /api/events`), so the exact rules
 * the client is held to are the same rules the server enforces — and both
 * are unit-testable without a database.
 *
 * Security invariants encoded here:
 *   • the wire format carries ONLY { type, targetKind, targetId, platform?,
 *     dwellMs?, sid?, ref? } — counters, seller ids, prices, order values and
 *     any other client-supplied number are not parseable fields, so a forged
 *     body cannot influence them (unknown keys are dropped by construction);
 *   • `sid` in the wire format is LEGACY only (old cached bundles may still
 *     send it): the server parses it and then IGNORES it — anonymous session
 *     identity is an httpOnly cookie `vn_evs` that POST /api/events mints
 *     server-side, so page JavaScript can never supply, read or rotate it;
 *   • the server hashes that session value with a day bucket BEFORE storage —
 *   • a `view` only becomes a QUALIFIED view when the client attests a
 *     documented dwell threshold (VIEW_QUALIFY_MS) — a page that merely
 *     loaded is not proof a human saw the product. Raw events are still
 *     recorded (qualified: false) so the distinction is measurable.
 *
 * Retention: every event document carries `expiresAt` (EVENT_RETENTION_DAYS)
 * so a Firestore TTL policy on that field reclaims the collection without a
 * custom cleanup job. Deduplication is per (type, target, viewer, day): one
 * write per viewer per target per day, never one per refresh.
 */

/* ── Limits & whitelists ────────────────────────────────────────────────── */

/** Max JSON body size accepted by /api/events (bytes). */
export const MAX_EVENT_BYTES = 2048;

/**
 * Documented dwell threshold: a view counts publicly only after the product
 * page stayed the active, visible document for at least this long.
 * (Client-attested — the server enforces dedup, ownership and bounds; this
 * is a quality gate against accidental loads, not a bot-proof guarantee.)
 */
export const VIEW_QUALIFY_MS = 2000;

/** Event retention window (days) — mirrored into each doc's `expiresAt`. */
export const EVENT_RETENTION_DAYS = 30;

export const EVENT_TYPES = ['view', 'click'] as const;
export type GrowthEventType = (typeof EVENT_TYPES)[number];

export const TARGET_KINDS = ['product', 'shop'] as const;
export type GrowthTargetKind = (typeof TARGET_KINDS)[number];

/** Share platforms we recognise — anything else becomes 'other'. */
export const SHARE_PLATFORMS = [
  'whatsapp',
  'facebook',
  'instagram',
  'twitter',
  'telegram',
  'tiktok',
  'copy',
  'qr',
  'native',
  'other',
] as const;
export type SharePlatform = (typeof SHARE_PLATFORMS)[number];

/** Client nonce rules: random, opaque, long enough not to be guessable. */
export const SID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

/** Bare document ids — never paths, never URLs. */
export const TARGET_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** A view may not claim more dwell than this (sanity bound). */
export const MAX_DWELL_MS = 600_000;

export interface ParsedEvent {
  type: GrowthEventType;
  targetKind: GrowthTargetKind;
  targetId: string;
  platform?: SharePlatform;
  /** Client-attested time the page stayed visible, for views. */
  dwellMs?: number;
  /** Legacy client nonce — parsed for backward compat, IGNORED by the route. */
  sid?: string;
  /** Normalised referral code carried on the arriving link, if any. */
  ref?: string;
}

export type ParseResult =
  | { ok: true; value: ParsedEvent }
  | { ok: false; error: string };

/* ── Validation ─────────────────────────────────────────────────────────── */

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Validates one event request body. Unknown keys (viewCount, sellerId,
 * price, …) are NOT copied into the result — the parsed object literally
 * cannot carry a counter or an ownership claim.
 */
export function parseEventInput(body: unknown): ParseResult {
  if (!isRecord(body)) return { ok: false, error: 'Invalid payload.' };

  const type = body.type;
  if (typeof type !== 'string' || !(EVENT_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: 'Unknown event type.' };
  }

  const targetKind = body.targetKind;
  if (typeof targetKind !== 'string' || !(TARGET_KINDS as readonly string[]).includes(targetKind)) {
    return { ok: false, error: 'Unknown target kind.' };
  }

  const targetId = body.targetId;
  if (typeof targetId !== 'string' || !TARGET_ID_PATTERN.test(targetId)) {
    return { ok: false, error: 'Invalid target id.' };
  }

  // A view is only meaningful for a listing; shops are share-only in phase 1.
  if (type === 'view' && targetKind !== 'product') {
    return { ok: false, error: 'Views are product-only.' };
  }

  const value: ParsedEvent = { type: type as GrowthEventType, targetKind: targetKind as GrowthTargetKind, targetId };

  if (body.platform !== undefined) {
    if (typeof body.platform !== 'string') return { ok: false, error: 'Invalid platform.' };
    const platform = (SHARE_PLATFORMS as readonly string[]).includes(body.platform)
      ? (body.platform as SharePlatform)
      : 'other';
    value.platform = platform;
  }
  if (type === 'click' && !value.platform) value.platform = 'other';

  if (body.dwellMs !== undefined && body.dwellMs !== null) {
    const dwell = Number(body.dwellMs);
    if (!Number.isFinite(dwell) || dwell < 0 || dwell > MAX_DWELL_MS) {
      return { ok: false, error: 'Invalid dwell.' };
    }
    value.dwellMs = Math.round(dwell);
  }

  if (body.sid !== undefined && body.sid !== null) {
    if (typeof body.sid !== 'string' || !SID_PATTERN.test(body.sid)) {
      return { ok: false, error: 'Invalid session.' };
    }
    value.sid = body.sid;
  }

  if (body.ref !== undefined && body.ref !== null && body.ref !== '') {
    if (typeof body.ref !== 'string' || body.ref.length > 64) {
      return { ok: false, error: 'Invalid ref.' };
    }
    value.ref = body.ref;
  }

  return { ok: true, value };
}

/** True when an attested view meets the documented quality threshold. */
export function isQualifiedView(event: Pick<ParsedEvent, 'type' | 'dwellMs'>): boolean {
  if (event.type !== 'view') return true; // a share click is itself an action
  return (event.dwellMs ?? 0) >= VIEW_QUALIFY_MS;
}

/* ── Time & dedup identity ──────────────────────────────────────────────── */

/** Day bucket in UTC — stable for dedupe regardless of the client's clock. */
export function eventDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The dedupe document id: one document per (type, target, viewer-hash, day).
 * Bounded by unique viewers per day — a refresh hits an existing id and
 * writes nothing.
 */
export function dedupeDocId(
  type: string,
  targetKind: string,
  targetId: string,
  day: string,
  viewerHash: string,
): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '');
  return [safe(type), safe(targetKind), safe(targetId), safe(day), safe(viewerHash)]
    .join('_')
    .slice(0, 400);
}

/** `expiresAt` for a new event document (TTL field). */
export function eventExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/* ── Share attribution (reuses the established referral code format) ────── */

/**
 * Appends the visitor's referrer code to a same-site path:
 * `/products/x?ref=<code>` — the SAME `ref` parameter name and code format
 * the invite/signup flow already uses (`normaliseReferralCode` in
 * lib/referrals), so one code directory serves both rewards and attribution.
 */
export function withShareRef(url: string, code: string | null | undefined): string {
  if (!code) return url;
  const clean = code.trim().toLowerCase();
  if (!clean || !/^[a-z0-9-]{1,40}$/.test(clean)) return url;
  if (/[?&]ref=/.test(url)) return url; // never stack a second ref
  return `${url}${url.includes('?') ? '&' : '?'}ref=${encodeURIComponent(clean)}`;
}
