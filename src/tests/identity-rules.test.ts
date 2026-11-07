import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  MIN_PASSWORD_LENGTH,
  isUsableEmail,
  isUsablePassword,
  normaliseRole,
} from '@/lib/auth/identity-rules';
import { consentStateFrom } from '@/lib/cookie-consent';

/**
 * Account rules and the identity wiring.
 *
 * The pure rules are tested directly; the wiring is checked as source text
 * because the property that matters is architectural — "no path from a request
 * body to an admin role", "no second identity store", "no password in a log" —
 * and those are grep-able facts, not runtime behaviour.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(process.cwd(), dir))) {
    const rel = `${dir}/${entry}`;
    const stat = statSync(join(process.cwd(), rel));
    if (stat.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(rel);
  }
  return out;
}

test('a client-supplied admin role is always downgraded to buyer', () => {
  assert.equal(normaliseRole('admin'), 'buyer');
  assert.equal(normaliseRole('ADMIN'), 'buyer');
  assert.equal(normaliseRole(' Admin '), 'buyer');
  assert.equal(normaliseRole('superuser'), 'buyer');
  assert.equal(normaliseRole(undefined), 'buyer');
  assert.equal(normaliseRole({ role: 'admin' }), 'buyer');
});

test('the three self-service roles survive normalisation', () => {
  assert.equal(normaliseRole('buyer'), 'buyer');
  assert.equal(normaliseRole('Seller'), 'seller');
  assert.equal(normaliseRole('reseller'), 'reseller');
});

test('emails are validated strictly enough to reject typos', () => {
  assert.equal(isUsableEmail('person@vidnov.com'), true);
  assert.equal(isUsableEmail('  person@vidnov.com  '), true);
  assert.equal(isUsableEmail('person@vidnov'), false);
  assert.equal(isUsableEmail('person vidnov.com'), false);
  assert.equal(isUsableEmail(''), false);
  assert.equal(isUsableEmail(null), false);
  assert.equal(isUsableEmail(42), false);
  assert.equal(isUsableEmail(`${'a'.repeat(250)}@b.com`), false);
});

test('passwords below the shared minimum are refused everywhere', () => {
  assert.equal(MIN_PASSWORD_LENGTH, 8);
  assert.equal(isUsablePassword('short'), false);
  assert.equal(isUsablePassword('1234567'), false);
  assert.equal(isUsablePassword('12345678'), true);
  assert.equal(isUsablePassword(undefined), false);
  assert.equal(isUsablePassword('x'.repeat(201)), false);
});

test('the register and login routes are server-side and never cache a session', () => {
  for (const path of [
    'src/app/api/auth/v2/register/route.ts',
    'src/app/api/auth/v2/login/route.ts',
  ]) {
    const source = read(path);
    assert.match(source, /runtime = 'nodejs'/, `${path} must run on node`);
    assert.match(source, /dynamic = 'force-dynamic'/, `${path} must not be prerendered`);
    assert.match(source, /Cache-Control': 'no-store'/, `${path} must never cache a session`);
  }
});

test('registration and login delegate to the PocketBase identity service', () => {
  const register = read('src/app/api/auth/v2/register/route.ts');
  const login = read('src/app/api/auth/v2/login/route.ts');
  assert.match(register, /registerAccount/);
  assert.match(login, /signInAccount/);
  // Credentials must never be logged.
  for (const source of [register, login]) {
    assert.doesNotMatch(source, /console\.log/);
  }
});

test('no authentication route reads a role from the request beyond the clamped set', () => {
  assert.doesNotMatch(read('src/lib/auth/identity.ts'), /admin['"]\s*[,)]/);
});

test('the web client falls back to Firebase ONLY when the identity store is missing', () => {
  const client = read('src/lib/auth/client.ts');
  const fallbackGuards = [...client.matchAll(/if \(isUnconfigured\(payload\)\)/g)];
  assert.equal(fallbackGuards.length, 2, 'login and register each keep one guarded fallback');
  assert.match(client, /signInWithCustomToken/, 'the session must come from the bridge token');
});

test('the Android client authenticates through the Vidnov API, not Identity Toolkit', () => {
  const mobile = read('mobile/src/lib/firebase-auth.ts');
  assert.match(mobile, /\/api\/auth\/v2\/login/);
  assert.match(mobile, /\/api\/auth\/v2\/register/);
  // The legacy Firebase call survives only behind the unconfigured guard.
  const guarded = /payload\.code === 'identity_unconfigured'[\s\S]{0,120}legacyIdentityCall/;
  assert.match(mobile, guarded);
});

test('a password reset writes the new credential to PocketBase as well', () => {
  const route = read('src/app/api/auth/reset-password/route.ts');
  assert.match(route, /applyNewPassword\(data\.uid, newPassword\)/);
});

test('every file that imports the identity service imports it server-side', () => {
  const appFiles = walk('src/app').filter((file) => read(file).includes("@/lib/auth/identity"));
  for (const file of appFiles) {
    assert.ok(file.includes('/api/'), `${file} must be a route handler, not a page`);
  }
});

test('marketing consent is never inherited from an analytics decision', () => {
  // Someone who answered the old banner: analytics yes, marketing never asked.
  assert.deepEqual(consentStateFrom('granted', null), { analytics: 'granted', marketing: null });
  assert.deepEqual(consentStateFrom('false', null), { analytics: 'denied', marketing: null });
  // An explicit marketing refusal is kept.
  assert.deepEqual(consentStateFrom('denied', 'denied'), { analytics: 'denied', marketing: 'denied' });
});
