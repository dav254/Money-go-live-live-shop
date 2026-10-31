/**
 * EMAIL SYSTEM — the guarantees the Stage 2 reliability work must never lose.
 *
 *   • provider failures are classified into safe categories, and production
 *     NEVER falls back to a provider that pretends to send;
 *   • only transient errors are retried, only within the attempt cap, never
 *     for one-time-link templates, suppressed recipients or dev mode;
 *   • webhook verification fails closed (secret, headers, timestamp, body);
 *   • `DELIVERED` can only come from a provider event — never from API
 *     acceptance;
 *   • the renderer strips the subject line from the body and wraps content
 *     in the branded, image-free responsive shell without weakening escaping;
 *   • the routes keep their gates: verification is single-use + hashed,
 *     the cron is triple-gated, admin endpoints verify the admin, and the
 *     token/job collections stay unreadable to clients.
 *
 * Run: npx tsx --test src/tests/email-system.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DUPLICATE_COOLDOWN_MS,
  RETRY_MAX_ATTEMPTS,
  bounceIsPermanent,
  classifySendError,
  classifyThrown,
  hasDuplicateCooldown,
  isTransientClass,
  isValidAddress,
  nextAttemptIso,
  normalizeAddress,
  parseEmailEvent,
  retryDelayMinutes,
  sanitizeEventId,
  shouldRetry,
  statusForEvent,
  verifyWebhookSignature,
} from '../lib/notifications/email-reliability';
import { renderTemplate } from '../lib/notifications/renderer';
import { getEmailProvider } from '../lib/notifications/email-provider';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/* ── Error classification ─────────────────────────────────────────────────── */

describe('error classification', () => {
  it('maps provider HTTP statuses to safe categories', () => {
    assert.equal(classifySendError(429), 'rate_limited');
    assert.equal(classifySendError(408), 'rate_limited');
    assert.equal(classifySendError(401), 'config');
    assert.equal(classifySendError(403), 'config');
    assert.equal(classifySendError(500), 'server');
    assert.equal(classifySendError(503), 'server');
    assert.equal(classifySendError(400), 'invalid');
    assert.equal(classifySendError(422), 'invalid');
  });

  it('recognises configuration problems from the message, not just status', () => {
    assert.equal(classifySendError(undefined, 'Email provider is not configured (EMAIL_PROVIDER / EMAIL_API_KEY missing).'), 'config');
    assert.equal(classifySendError(undefined, 'Unknown EMAIL_PROVIDER "smtp".'), 'unknown');
  });

  it('classifies thrown fetch errors as timeout/server, never by content', () => {
    const timeout = Object.assign(new Error('The operation timed out.'), { name: 'TimeoutError' });
    assert.equal(classifyThrown(timeout), 'timeout');
    assert.equal(classifyThrown(new Error('fetch failed')), 'server');
    assert.equal(classifyThrown(new Error('something odd')), 'unknown');
  });

  it('only three classes are transient', () => {
    assert.equal(isTransientClass('rate_limited'), true);
    assert.equal(isTransientClass('timeout'), true);
    assert.equal(isTransientClass('server'), true);
    assert.equal(isTransientClass('config'), false);
    assert.equal(isTransientClass('invalid'), false);
    assert.equal(isTransientClass('bounce'), false);
    assert.equal(isTransientClass(undefined), false);
  });
});

/* ── Retry policy ─────────────────────────────────────────────────────────── */

describe('retry policy', () => {
  it('retries a transient failure in production within the cap', () => {
    const decision = shouldRetry({
      templateKey: 'order-confirmation',
      attempts: 1,
      errorClass: 'server',
      mode: 'production',
    });
    assert.equal(decision.retry, true);
    assert.equal(decision.reason, 'transient');
  });

  it('never retries one-time-link templates (raw expiring tokens)', () => {
    for (const key of ['password-reset', 'verify-email']) {
      const decision = shouldRetry({ templateKey: key, attempts: 1, errorClass: 'server', mode: 'production' });
      assert.equal(decision.retry, false, key);
      assert.equal(decision.reason, 'one_time_link_template');
    }
  });

  it('never retries permanent errors, suppressed recipients, or dev mode', () => {
    assert.equal(
      shouldRetry({ templateKey: 'welcome', attempts: 1, errorClass: 'config', mode: 'production' }).reason,
      'permanent_error',
    );
    assert.equal(
      shouldRetry({ templateKey: 'welcome', attempts: 1, errorClass: 'server', mode: 'production', suppressed: true }).reason,
      'suppressed',
    );
    assert.equal(
      shouldRetry({ templateKey: 'welcome', attempts: 1, errorClass: 'server', mode: 'development' }).reason,
      'not_production',
    );
  });

  it('stops at the attempt cap', () => {
    assert.equal(RETRY_MAX_ATTEMPTS, 3);
    const decision = shouldRetry({
      templateKey: 'order-confirmation',
      attempts: RETRY_MAX_ATTEMPTS,
      errorClass: 'server',
      mode: 'production',
    });
    assert.equal(decision.retry, false);
    assert.equal(decision.reason, 'attempts_exhausted');
  });

  it('backoff grows exponentially but stays bounded', () => {
    assert.equal(retryDelayMinutes(1), 5);
    assert.equal(retryDelayMinutes(2), 15);
    assert.equal(retryDelayMinutes(3), 45);
    assert.ok(retryDelayMinutes(99) <= 60);

    const t0 = Date.parse('2026-10-29T12:00:00Z');
    const next = Date.parse(nextAttemptIso(t0, 1));
    assert.equal(next - t0, 5 * 60_000);
  });
});

/* ── Webhook verification (svix scheme) ───────────────────────────────────── */

function sign(secret: string, id: string, timestamp: string, body: string): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  return `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')}`;
}

describe('webhook signature verification', () => {
  const SECRET = `whsec_${Buffer.from('vidnov-webhook-secret-0123456789').toString('base64')}`;
  const ID = 'msg_2cxexample7';
  const BODY = JSON.stringify({ type: 'email.delivered', email: { id: 'abc123' } });

  it('accepts a correctly signed payload', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const result = verifyWebhookSignature({
      secret: SECRET,
      headers: { id: ID, timestamp, signature: sign(SECRET, ID, timestamp, BODY) },
      rawBody: BODY,
    });
    assert.deepEqual(result, { ok: true });
  });

  it('fails closed when the secret is missing', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const result = verifyWebhookSignature({
      secret: '',
      headers: { id: ID, timestamp, signature: 'v1,x' },
      rawBody: BODY,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing_secret');
  });

  it('fails when any header is missing', () => {
    const result = verifyWebhookSignature({ secret: SECRET, headers: {}, rawBody: BODY });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing_header');
  });

  it('rejects stale or future timestamps outside the tolerance', () => {
    const stale = String(Math.floor(Date.now() / 1000) - 600);
    const result = verifyWebhookSignature({
      secret: SECRET,
      headers: { id: ID, timestamp: stale, signature: sign(SECRET, ID, stale, BODY) },
      rawBody: BODY,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'bad_timestamp');
  });

  it('rejects a wrong secret and a tampered body', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const wrongSecret = verifyWebhookSignature({
      secret: `whsec_${Buffer.from('a-completely-different-secret-xx').toString('base64')}`,
      headers: { id: ID, timestamp, signature: sign(SECRET, ID, timestamp, BODY) },
      rawBody: BODY,
    });
    assert.equal(wrongSecret.ok, false);
    assert.equal(wrongSecret.reason, 'bad_signature');

    const tampered = verifyWebhookSignature({
      secret: SECRET,
      headers: { id: ID, timestamp, signature: sign(SECRET, ID, timestamp, BODY) },
      rawBody: BODY.replace('delivered', 'bounced'),
    });
    assert.equal(tampered.ok, false);
  });

  it('sanitizes event ids so headers can never shape a document id', () => {
    assert.equal(sanitizeEventId('msg_abc-123_XYZ'), 'msg_abc-123_XYZ');
    const evil = sanitizeEventId('../../etc/passwd');
    assert.match(evil, /^evt_[0-9a-f]{40}$/);
    assert.notEqual(evil, '../../etc/passwd');
  });
});

/* ── Provider events → status vocabulary ──────────────────────────────────── */

describe('provider event mapping', () => {
  it('maps every known event and refuses to guess unknown ones', () => {
    assert.equal(parseEmailEvent('email.sent'), 'sent');
    assert.equal(parseEmailEvent('email.delivered'), 'delivered');
    assert.equal(parseEmailEvent('email.delivery_delayed'), 'delayed');
    assert.equal(parseEmailEvent('email.bounced'), 'bounced');
    assert.equal(parseEmailEvent('email.failed'), 'failed');
    assert.equal(parseEmailEvent('email.complained'), 'complained');
    assert.equal(parseEmailEvent('email.something_new'), null);
    assert.equal(parseEmailEvent(''), null);
  });

  it('turns events into the exact status the evidence proves', () => {
    assert.equal(statusForEvent('delivered'), 'DELIVERED');
    assert.equal(statusForEvent('delayed'), 'DELAYED');
    assert.equal(statusForEvent('bounced'), 'BOUNCED');
    assert.equal(statusForEvent('complained'), 'BOUNCED');
    assert.equal(statusForEvent('failed'), 'FAILED');
    assert.equal(statusForEvent('sent'), 'SENT');
  });

  it('treats bounces as permanent unless explicitly transient', () => {
    assert.equal(bounceIsPermanent(undefined), true);
    assert.equal(bounceIsPermanent({}), true);
    assert.equal(bounceIsPermanent({ bounce: { type: 'permanent' } }), true);
    assert.equal(bounceIsPermanent({ bounce: { type: 'transient' } }), false);
    assert.equal(bounceIsPermanent({ bounce: { type: 'soft' } }), false);
  });
});

/* ── Addresses & duplicate cooldown ───────────────────────────────────────── */

describe('addresses and duplicate cooldown', () => {
  it('validates and normalizes recipients conservatively', () => {
    assert.equal(isValidAddress('a@b.co'), true);
    assert.equal(isValidAddress('First.Last+tag@example.com'), true);
    assert.equal(isValidAddress('not-an-email'), false);
    assert.equal(isValidAddress('a@b'), false);
    assert.equal(isValidAddress('a <b@c.de>'), false);
    assert.equal(isValidAddress(''), false);
    assert.equal(normalizeAddress('  USER@Example.COM '), 'user@example.com');
  });

  it('suppresses duplicate verification/reset/welcome fires inside the window', () => {
    const now = Date.now();
    assert.equal(hasDuplicateCooldown('verify-email', now - 1_000, now), true);
    assert.equal(hasDuplicateCooldown('verify-email', now - DUPLICATE_COOLDOWN_MS - 1, now), false);
    assert.equal(hasDuplicateCooldown('verify-email', null, now), false);
    assert.equal(hasDuplicateCooldown('order-confirmation', now - 100, now), false);
  });
});

/* ── Renderer: subject stripping + branded shell ──────────────────────────── */

describe('renderer (subject + branding)', () => {
  it('moves the subject line out of the body — it never repeats inline', () => {
    const out = renderTemplate('subject: Welcome, {{user_name}}\nBody starts here.', { user_name: 'Ada' });
    assert.equal(out.subject, 'Welcome, Ada');
    assert.equal(out.text, 'Body starts here.');
    assert.ok(!out.html.includes('subject:'), 'html must not contain the subject header line');
    assert.ok(!out.html.includes('Welcome, Ada') || out.html.includes('<title>'), 'subject only in <title>');
  });

  it('templates without a subject line keep their exact text (legacy callers)', () => {
    const out = renderTemplate('Hi {{user_name}}, total {{currency}} {{amount}}', {
      user_name: 'Ada', currency: 'KES', amount: '250',
    });
    assert.equal(out.text, 'Hi Ada, total KES 250');
    assert.equal(out.subject, undefined);
  });

  it('wraps HTML in the responsive, image-free branded shell', () => {
    const out = renderTemplate('subject: Hello\nContent line', {});
    assert.ok(out.html.startsWith('<!DOCTYPE html>'));
    assert.match(out.html, /max-width:560px/);        // mobile-friendly card
    assert.match(out.html, /#ff4d2e/);                // Vidnov coral
    assert.match(out.html, /<meta name="viewport"/);  // responsive
    assert.doesNotMatch(out.html, /<img/i);           // no tracking pixels / CDN
    assert.match(out.html, /Content line/);
  });

  it('link vars become coral CTA buttons with escaped hrefs', () => {
    const out = renderTemplate('Reset: {{reset_link}}', { reset_link: 'https://app.example/reset?token=a&b' });
    assert.match(out.html, /<a href="https:\/\/app\.example\/reset\?token=a&amp;b"/);
    assert.match(out.html, /background:#ff4d2e/);
  });

  it('still escapes variable content after the redesign (no HTML injection)', () => {
    const out = renderTemplate('Hi {{user_name}}', { user_name: '<img src=x onerror=alert(1)>' });
    assert.match(out.html, /&lt;img/);
    assert.doesNotMatch(out.html, /<img/i);
  });
});

/* ── Provider honesty ─────────────────────────────────────────────────────── */

describe('provider selection honesty', () => {
  it('production without credentials fails instead of pretending to send', () => {
    const provider = getEmailProvider(undefined, undefined, 'production');
    assert.equal(provider.id, 'unconfigured');
  });

  it('development keeps the console fallback (nothing is meant to deliver)', () => {
    assert.equal(getEmailProvider(undefined, undefined, 'development').id, 'console');
    assert.equal(getEmailProvider('smtp', 'k', 'development').id, 'console');
  });

  it('an unknown production provider name fails loudly', () => {
    assert.equal(getEmailProvider('smtp', 'k', 'production').id, 'unconfigured');
  });

  it('the unconfigured provider reports accepted:false', async () => {
    const provider = getEmailProvider(undefined, undefined, 'production');
    const result = await provider.send({
      to: 'a@b.co', from: 'x@y.z', subject: 's', text: 't', html: '<p>t</p>',
    });
    assert.equal(result.accepted, false);
    assert.match(result.error ?? '', /not configured/);
  });

  it('the configured providers keep their real endpoints', async () => {
    assert.equal(getEmailProvider('resend', 're_key', 'production').id, 'resend');
    assert.equal(getEmailProvider('postmark', 'pm_key', 'production').id, 'postmark');
    assert.equal(getEmailProvider('sendgrid', 'SG.key', 'production').id, 'sendgrid');
  });
});

/* ── Source-level guarantees (routes & service wiring) ────────────────────── */

describe('email routes and wiring (source level)', () => {
  it('signup issues a hashed verification link instead of an empty confirm link', () => {
    const source = read('src/app/api/auth/welcome/route.ts');
    assert.ok(source.includes('issueEmailVerification'));
    assert.ok(source.includes("'verify-email'"));
    assert.ok(source.includes('verification_link'));
  });

  it('verification route hashes before lookup and is single-use + expiring', () => {
    const source = read('src/app/api/auth/verify-email/route.ts');
    assert.ok(source.includes('hashToken(raw)'));
    assert.ok(source.includes('emailVerified: true'));
    assert.ok(source.includes('usedAt'));
    assert.ok(source.includes('expiresAt'));
    assert.ok(source.includes('MAX_ATTEMPTS'));
    // The token is consumed through the hashed lookup BEFORE any mutation.
    assert.ok(source.indexOf('hashToken(raw)') < source.indexOf('updateUser'));
    // Domain hygiene: never hardcode the production domain.
    assert.doesNotMatch(source, /vidnov\.com/);
  });

  it('the webhook verifies the signature before parsing anything, and fails closed', () => {
    const source = read('src/app/api/webhooks/email/route.ts');
    assert.ok(source.includes('EMAIL_WEBHOOK_SECRET'));
    assert.ok(source.includes('status: 503'), 'missing secret must refuse');
    assert.ok(source.includes('status: 401'), 'bad signature must refuse');
    // Compare CALL sites (last occurrence), not import statements.
    assert.ok(
      source.lastIndexOf('verifyWebhookSignature') < source.lastIndexOf('JSON.parse'),
      'signature must be verified before the payload is parsed',
    );
    // Dedupe record is written only AFTER the effects.
    assert.ok(
      source.lastIndexOf('updateLogStatusByProviderId') < source.lastIndexOf('recordWebhookEvent'),
      'effects must run before the idempotency record',
    );
  });

  it('the retry cron keeps all three gates and the attempt cap', () => {
    const source = read('src/app/api/email/cron/route.ts');
    assert.ok(source.includes('VIDNOV_CRON_ENABLED'));
    assert.ok(source.includes('EMAIL_RETRY_CRON_ENABLED'));
    assert.ok(source.includes('CRON_SECRET'));
    assert.ok(source.includes('authorizeCronSchedule'));
    assert.ok(source.includes('RETRY_MAX_ATTEMPTS'));
    assert.ok(source.includes('status: 409'), 'overlapping passes must be refused');
  });

  it('the send service never talks to a provider directly', () => {
    const source = read('src/lib/notifications/email-service.ts');
    assert.ok(!source.includes('api.resend.com'), 'providers live in email-provider.ts only');
    assert.ok(source.includes('getEmailProvider(cfg.emailProvider, cfg.emailApiKey, cfg.emailMode)'));
    assert.ok(source.includes('isSuppressed'), 'suppression is checked before every production send');
    assert.ok(source.includes('hasDuplicateCooldown'), 'one-time mail is deduplicated');
    // `accepted` must never be reported as delivered anywhere.
    assert.doesNotMatch(source, /status:\s*'DELIVERED'/);
  });

  it('admin communication endpoints verify the admin on BOTH methods', () => {
    const source = read('src/app/api/admin/communication/route.ts');
    assert.equal((source.match(/await verifyAdminUid/g) ?? []).length, 2);
    assert.ok(source.includes("'suppressions'"));
    assert.ok(source.includes("'webhook-events'"));
    assert.ok(source.includes('offset('), 'pagination must be bounded by page');
  });

  it('the support notification route resolves recipients server-side', () => {
    const source = read('src/app/api/support/notify/route.ts');
    assert.ok(source.includes('verifyUserUid'));
    assert.ok(source.includes('getAuth().getUser(uid)'), 'address comes from Auth, never the body');
    assert.ok(!/body\??\.\s*email/.test(source), 'the request body must never carry the recipient');
  });

  it('the new token/job collections stay unreadable to clients', () => {
    for (const c of ['emailVerificationTokens', 'emailJobs', 'emailSuppressions', 'emailWebhookEvents']) {
      const re = new RegExp(`match\\s+/${c}/\\{[\\s\\S]*?allow\\s+(read|get|list)[\\s\\S]*?if\\s+true`);
      assert.doesNotMatch(read('src/firestore.rules'), re, `${c} must not be client-readable`);
    }
  });
});
