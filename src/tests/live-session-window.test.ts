/**
 * PAID-SESSION WINDOW — unit tests for the rule that decides whether a seller
 * with a `live` session document is genuinely still broadcasting (→ show the
 * professional "already live" panel) or is stale (→ auto-recover, go live).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeSessionRemainingMs } from '../lib/live/session-window';

const MINUTE = 60_000;
const PAID_WINDOW = 70 * MINUTE;

test('a fresh legacy session is active for the full paid 70 minutes', () => {
  const now = 1_000_000_000;
  const session = { startTime: now - 60 * MINUTE, timeRemainingMs: PAID_WINDOW };
  const remaining = activeSessionRemainingMs(session, now, PAID_WINDOW);
  assert.equal(remaining, PAID_WINDOW - 60 * MINUTE);
  assert.ok(remaining > 0, '60 minutes in, 10 must remain — seller is NOT stale');
});

test('a session past its window reads as expired (0 remaining)', () => {
  const now = 1_000_000_000;
  const session = { startTime: now - 71 * MINUTE, timeRemainingMs: PAID_WINDOW };
  assert.equal(activeSessionRemainingMs(session, now, PAID_WINDOW), 0);
});

test('Firestore Timestamp-shaped startTime is understood', () => {
  const now = 1_000_000_000;
  const session = { startTime: { toMillis: () => now - 10 * MINUTE } };
  assert.ok(activeSessionRemainingMs(session, now, PAID_WINDOW) > 0);
});

test('missing or unusable startTime is stale, never blocking', () => {
  const now = 1_000_000_000;
  assert.equal(activeSessionRemainingMs(undefined, now, PAID_WINDOW), 0);
  assert.equal(activeSessionRemainingMs({}, now, PAID_WINDOW), 0);
  assert.equal(activeSessionRemainingMs({ startTime: 'garbage' }, now, PAID_WINDOW), 0);
});

test('legacy docs without timeRemainingMs fall back to the paid window default', () => {
  const now = 1_000_000_000;
  const session = { startTime: now - 10 * MINUTE };
  assert.equal(
    activeSessionRemainingMs(session, now, PAID_WINDOW),
    PAID_WINDOW - 10 * MINUTE,
    'legacy doc must still get the full 70-minute window, not instant-stale',
  );
});

test('zero/negative timeRemainingMs cannot strand a seller forever', () => {
  // The stuck-seller bug: a doc with timeRemainingMs: 0 (ended-ish leftovers)
  // must read expired so go-live recovers instead of 409-looping.
  const now = 1_000_000_000;
  const session = { startTime: now - 1 * MINUTE, timeRemainingMs: 0 };
  assert.equal(
    activeSessionRemainingMs(session, now, PAID_WINDOW),
    0,
    'zero window ⇒ stale ⇒ replaceable',
  );
});
