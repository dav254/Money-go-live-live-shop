import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSENT_COOKIE,
  CONSENT_DURATION_DAYS,
  parseConsentCookie,
  serializeConsentCookie,
} from '@/lib/cookie-consent';

/**
 * The consent cookie is the switch the analytics gate reads, so its mapping
 * and serialization are load-bearing: a parse regression would either re-prompt
 * every returning visitor or silently re-enable analytics for people who
 * declined.
 */

test('consent parsing maps the current values', () => {
  assert.equal(parseConsentCookie('granted'), 'granted');
  assert.equal(parseConsentCookie('denied'), 'denied');
});

test('consent parsing still understands the legacy banner values', () => {
  assert.equal(parseConsentCookie('true'), 'granted');
  assert.equal(parseConsentCookie('false'), 'denied');
});

test('consent parsing treats missing or unknown values as undecided', () => {
  assert.equal(parseConsentCookie(null), null);
  assert.equal(parseConsentCookie(undefined), null);
  assert.equal(parseConsentCookie(''), null);
  assert.equal(parseConsentCookie('maybe'), null);
});

test('consent parsing is case- and whitespace-tolerant', () => {
  assert.equal(parseConsentCookie(' Granted '), 'granted');
  assert.equal(parseConsentCookie('DENIED'), 'denied');
});

test('consent cookie serializes with name, path, SameSite and a future expiry', () => {
  const now = Date.UTC(2026, 0, 1);
  const serialized = serializeConsentCookie('granted', now, false);

  assert.ok(serialized.startsWith(`${CONSENT_COOKIE}=granted`));
  assert.ok(serialized.includes('path=/'));
  assert.ok(serialized.includes('SameSite=Lax'));
  assert.ok(!serialized.includes('Secure'));

  const expiryMatch = serialized.match(/expires=([^;]+)/i);
  assert.ok(expiryMatch, 'serialized cookie must carry an expiry date');
  const expiry = Date.parse(expiryMatch[1]);
  const expected = now + CONSENT_DURATION_DAYS * 24 * 60 * 60 * 1000;
  assert.ok(!Number.isNaN(expiry));
  assert.equal(expiry, expected);
});

test('consent cookie adds the Secure flag over https', () => {
  assert.ok(serializeConsentCookie('denied', Date.now(), true).includes('Secure'));
});
