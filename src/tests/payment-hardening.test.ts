/**
 * PAYMENT & PRIVACY HARDENING (stabilization session).
 * Run: npx tsx --test src/tests/payment-hardening.test.ts
 *
 * Source-level guards for the security fixes in this session — same style
 * as security-rules.test.ts (no network or database needed):
 *   1. the PayPal webhook cannot process unverified events and cannot
 *      double-credit a retried transaction;
 *   2. the profile API never round-trips credential-shaped fields;
 *   3. unconfigured payment gateways are hidden instead of offered;
 *   4. homepage figures/demo rooms are labelled honestly;
 *   5. sensitive local folders stay out of git.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('PayPal webhook hardening', () => {
  const src = read('src/app/api/webhooks/paypal/route.ts');

  it('refuses events entirely when PayPal is not configured (410)', () => {
    assert.ok(src.includes('paypalConfigured()'));
    assert.ok(src.includes('status: 410'), 'unconfigured deployment must answer 410');
  });

  it('verifies the PayPal transmission signature before processing', () => {
    assert.ok(src.includes('verify-webhook-signature'), 'must call PayPal verification API');
    assert.ok(src.includes('paypal-transmission-sig'), 'must read the signed headers');
    assert.ok(src.includes("verification_status === 'SUCCESS'"), 'fail closed without SUCCESS');
    assert.ok(src.includes('status: 401'), 'unverified events are rejected');
    // Ordering: the gate and verification must come before any event handling.
    const verifyIdx = src.indexOf('await verifyPaypalSignature');
    const handleIdx = src.indexOf("event.event_type === 'CHECKOUT.ORDER.APPROVED'");
    assert.ok(verifyIdx !== -1 && handleIdx !== -1 && verifyIdx < handleIdx,
      'verification must run before processing');
  });

  it('rejects unsigned deliveries (missing headers never pass)', () => {
    assert.ok(
      /if \(!authAlgo \|\| !certUrl[\s\S]{0,200}return false/.test(src),
      'missing PAYPAL-* headers must fail closed',
    );
    assert.ok(src.includes('catch {\n    return false;'), 'network failure must fail closed');
  });

  it('cannot double-credit a retried transaction', () => {
    assert.ok(src.includes('alreadyProcessed'), 'pre-check by transaction id');
    assert.ok(src.includes("where('transactionId', '=='"), 'queries the payment row');
    assert.ok(
      src.includes('paymentDocId(transactionId)'),
      'deterministic payment document id on the PayPal transaction',
    );
    assert.ok(src.includes('duplicate-ignored'), 'retry short-circuits with an ack');
  });

  it('validates credited points and ids before use', () => {
    assert.ok(src.includes('Math.floor(Number(metadata.points))'), 'points are integral');
    assert.ok(src.includes('!(points > 0)'), 'rejects zero/negative/NaN credits');
    assert.ok(src.includes('points > 1_000_000'), 'bounds the credit');
    assert.ok(
      src.includes('/^[A-Za-z0-9_-]{1,128}$/.test(userId)'),
      'userId must be a bare id before it becomes a document path',
    );
    assert.ok(
      src.includes('/^[A-Za-z0-9_-]{1,128}$/.test(orderId)'),
      'orderId must be a bare id before it becomes a document path',
    );
  });
});

describe('profile API never leaks credential-shaped fields', () => {
  const src = read('src/app/api/auth/profile/route.ts');

  it('sanitizes every profile it returns', () => {
    assert.ok(src.includes('SENSITIVE_FIELD'), 'a redaction list must exist');
    assert.ok(src.includes('publicProfile('), 'a sanitizer must exist');
    const returns = src.match(/profile: publicProfile\(/g) ?? [];
    assert.ok(returns.length >= 3, `all 3 profile responses must be sanitized, found ${returns.length}`);
    assert.equal(
      /NextResponse\.json\(\{ ok: true, profile \}\)/.test(src),
      false,
      'the raw profile must never be serialized directly',
    );
  });

  it('the redaction list covers legacy TikTok token storage', () => {
    assert.ok(/connections/.test(src), 'legacy tokens lived under `connections`');
    assert.ok(/accessToken|access\[Tt\]oken/.test(src), 'access tokens are redacted');
    assert.ok(/refreshToken|refresh\[Tt\]oken/.test(src), 'refresh tokens are redacted');
  });
});

describe('payment methods with missing credentials are not offered', () => {
  it('website checkout probes gateway availability before rendering PayPal', () => {
    const src = read('src/app/checkout/[orderId]/page.tsx');
    assert.ok(src.includes("fetch('/api/create-payment-intent')"), 'probe exists');
    assert.ok(src.includes('setGateways'), 'probe result is stored');
    assert.ok(
      src.includes('gateways?.paypal !== false'),
      'PayPal button renders only while the probe has not said no',
    );
  });

  it('buy-points dialog hides unconfigured gateways', () => {
    const src = read('src/components/ai/buy-points-dialog.tsx');
    assert.ok(src.includes("fetch('/api/create-payment-intent')"), 'probe exists');
    assert.ok(src.includes("gateways?.paypal === false ? 'hidden'"), 'PayPal hidden when unavailable');
    assert.ok(src.includes("gateways?.paystack === false ? 'hidden'"), 'Paystack hidden when unavailable');
  });

  it('the availability probe itself never exposes credentials', () => {
    const src = read('src/app/api/create-payment-intent/route.ts');
    assert.ok(src.includes('paystack: !!process.env.PAYSTACK_SECRET_KEY'));
    assert.ok(!/PAYSTACK_SECRET_KEY[^)]*\}/.test(src.replace('!!process.env.PAYSTACK_SECRET_KEY', '')),
      'probe returns booleans only');
    assert.equal(src.includes('PAYPAL_CLIENT_SECRET:'), false, 'never echo secret values');
  });
});

describe('homepage honesty labels', () => {
  const src = read('src/app/page.tsx');

  it('hero figures are labelled as illustrative', () => {
    assert.ok(
      src.includes('Illustrative preview figures'),
      'fabricated stats need a visible disclaimer',
    );
  });

  it('demo room tiles carry a visible Sample tag and honest caption', () => {
    assert.ok(/demo && \(\s*[\s\S]{0,200}Sample/.test(src), 'demo tiles must show the Sample badge');
    assert.ok(src.includes('What a live room looks like'), 'demo caption must not claim live viewers');
    assert.equal(
      src.includes("href={demo ? '/buyer/discovery'"),
      true,
      'demo tiles must not pretend to open a real room',
    );
  });

  it('the intro video still uses only the configured asset', () => {
    assert.ok(src.includes('process.env.NEXT_PUBLIC_VIDNOV_INTRO_VIDEO_URL'));
  });
});

describe('repository hygiene', () => {
  it('.gitignore excludes local backup archives and media uploads', () => {
    const gi = read('.gitignore');
    assert.ok(gi.includes('.backups/'), 'migration backups must never be committable');
    assert.ok(gi.includes('uploads/'), 'user uploads must stay out of the repo');
    assert.ok(gi.includes('node_modules'), 'deps stay out of the repo');
  });
});
