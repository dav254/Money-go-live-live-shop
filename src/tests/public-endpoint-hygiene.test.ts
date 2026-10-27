/**
 * PUBLIC ENDPOINT HYGIENE — the endpoints a signed-out visitor can reach.
 *
 * These are the only routes that answer without a token, so they are audited
 * as a class: none may leak secrets or raw upstream text, the deprecated /
 * dangerous ones must stay disabled, and the health/status payloads must stay
 * to their documented shape. Source-level (no network), same style as
 * payment-hardening.test.ts.
 *
 * Audited in this file (the complete no-auth set found by the section audit):
 *   transactions (410), checkout/simulate (410), mux (410), media/status
 *   (id-gated poll), system-status (health only), d1/health (setup check),
 *   auth/forgot-password (anti-enumeration), live/watchdog (secret-gated).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

describe('dangerous or deprecated endpoints stay disabled', () => {
  it('payment simulation, legacy transactions and mux answer 410 with no side effects', () => {
    for (const rel of [
      'src/app/api/checkout/simulate/route.ts',
      'src/app/api/transactions/route.ts',
      'src/app/api/mux/route.ts',
    ]) {
      const source = readCode(rel);
      assert.ok(source.includes('410'), `${rel} must refuse with 410`);
      assert.equal(
        /db\.collection|addDoc|add\(/.test(source),
        false,
        `${rel} must not touch data while disabled`,
      );
    }
  });
});

describe('the D1 setup check never echoes upstream error text to an anonymous caller', () => {
  const source = readCode('src/app/api/d1/health/route.ts');

  it('returns a static message on failure, not the raw error', () => {
    assert.equal(
      source.includes('error instanceof Error ? error.message'),
      false,
      'raw upstream messages must not leave the server',
    );
    assert.ok(
      source.includes("message: 'D1 query failed."),
      'the caller gets one honest, static sentence',
    );
  });

  it('logs statically and still reports the unconfigured state honestly', () => {
    const logs = source.match(/console\.(error|warn|log)\([^)]*\)/g) ?? [];
    for (const line of logs) {
      assert.ok(
        /^console\.error\('[^']*'\)$/.test(line),
        `static log required: ${line}`,
      );
    }
    assert.ok(source.includes('status: 503'), 'not-configured stays a 503 with the key NAMES only');
    assert.ok(source.includes('Settings → Environment'), 'fix instructions, never values');
  });
});

describe('the public status endpoint exposes health only', () => {
  const source = readCode('src/app/api/system-status/route.ts');

  it('the response body is just services + latency (no config values)', () => {
    assert.ok(source.includes('NextResponse.json({ services, apiResponseTime })'));
    assert.equal(
      /NextResponse\.json\(\s*\{[^}]*process\.env/.test(source),
      false,
      'no environment value may be serialised into the response',
    );
    // Health state is derived from PRESENCE only — names are logged server-side, never returned.
    assert.ok(source.includes('!!process.env[') || source.includes('!!process.env.'), 'presence checks only');
  });
});

describe('the media status poll is id-gated and shape-limited', () => {
  const source = readCode('src/app/api/media/status/route.ts');

  it('requires an id and returns only render-status fields (no storage paths)', () => {
    assert.ok(source.includes("searchParams.get('id')"), 'an id is required');
    assert.ok(source.includes("status: 'FAILED'"), 'unknown ids fail instead of polling forever');
    // The JSON keys it may return, pinned: no ownerId, no storagePath, no seller data.
    for (const forbidden of ['storagePath', 'ownerId', 'sellerId', 'userId']) {
      assert.equal(
        new RegExp(`\\b${forbidden}:`).test(source),
        false,
        `${forbidden} must never be returned by the public poll`,
      );
    }
  });
});

describe('password reset cannot be used to enumerate accounts', () => {
  const source = readCode('src/app/api/auth/forgot-password/route.ts');
  it('answers every unknown account with the same generic response', () => {
    assert.ok(source.includes('genericAuthResponse'), 'a generic response is shared by all paths');
    assert.ok(source.includes('400'), 'malformed input is still rejected');
  });
});

describe('scheduled endpoints fail closed when unconfigured', () => {
  it('the live watchdog refuses without its secret', () => {
    const source = readCode('src/app/api/live/watchdog/route.ts');
    assert.ok(source.includes('x-watchdog-secret'), 'secret header required');
    assert.ok(source.includes('status: 503'), 'unconfigured → refuse, never run');
    assert.ok(source.includes('status: 403'), 'wrong secret → refuse');
  });

  it('the distribution cron refuses without its gate (see distribution-cron tests)', () => {
    const source = readCode('src/app/api/distribution/cron/route.ts');
    assert.ok(source.includes('authorizeCronSchedule'), 'the shared fail-closed gate is used');
    assert.ok(source.includes('status: 204'), 'disabled is a silent no-op');
  });
});
