/**
 * PAID-SESSION WINDOW — the one rule that decides whether a `liveSessions`
 * document marked `live` is genuinely still broadcasting or is a stale
 * leftover that must not block the seller.
 *
 * A session is active while `startTime + timeRemainingMs` is in the future:
 *  - `timeRemainingMs` is written as 70 minutes at creation (what 100 points
 *    buy), so the window matches the charged duration exactly;
 *  - a document with NO `timeRemainingMs` (pre-field legacy shape) falls back
 *    to the paid default window;
 *  - a `timeRemainingMs` of zero/negative — the shape the end-session PUT
 *    writes — means half-ended: expired by definition, so a stale doc can
 *    never strand a seller in an "already live" loop;
 *  - no usable `startTime` also reads as 0 remaining — stale, replaceable.
 *
 * Zero external dependencies on purpose: pure logic, unit-testable without
 * Firestore, imported by the session-creation route.
 */

/** Accepts Firestore Timestamps, Dates, epoch numbers — anything time-like. */
function toMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  const candidate = value as { toMillis?: () => number; seconds?: number } | null;
  if (candidate && typeof candidate.toMillis === 'function') return candidate.toMillis();
  if (candidate && typeof candidate.seconds === 'number') return candidate.seconds * 1000;
  return 0;
}

/**
 * Milliseconds left on the session's paid window (0 = expired/stale).
 *
 * `windowMs` is the session-length default used when the document predates
 * per-session `timeRemainingMs` (legacy docs).
 */
export function activeSessionRemainingMs(
  session:
    | { startTime?: unknown; timeRemainingMs?: unknown }
    | undefined,
  now: number,
  windowMs: number,
): number {
  if (!session) return 0;
  const start = toMs(session.startTime);
  if (!start) return 0;
  // Absent field ⇒ legacy doc ⇒ default paid window. Present-but-≤0 ⇒
  // half-ended (the end PUT writes 0) ⇒ window of 0 ⇒ expired, replaceable.
  const windowForDoc =
    typeof session.timeRemainingMs === 'number' && Number.isFinite(session.timeRemainingMs)
      ? Math.max(0, session.timeRemainingMs)
      : windowMs;
  return Math.max(0, start + windowForDoc - now);
}
