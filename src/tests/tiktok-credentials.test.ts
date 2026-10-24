/**
 * Social Reach security tests — OAuth state, credential-store privacy,
 * Firestore rules, the approval gate, job transitions and migration safety.
 *
 * Run: npx tsx --test src/tests/tiktok-credentials.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  issueOAuthState,
  verifyOAuthState,
  STATE_TTL_MS,
} from '../lib/tiktok/oauth-state';

const ROOT = join(__dirname, '..', '..');
const SECRET = 'test-secret-with-plenty-of-entropy-1234';

const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

describe('tiktok oauth state', () => {
  it('round-trips a valid state to the original uid', () => {
    const state = issueOAuthState('seller-uid-1', SECRET);
    assert.equal(verifyOAuthState(state, state, SECRET), 'seller-uid-1');
  });

  it('rejects a raw UID (the legacy state format)', () => {
    assert.equal(verifyOAuthState('seller-uid-1', 'seller-uid-1', SECRET), null);
  });

  it('rejects a tampered payload', () => {
    const state = issueOAuthState('seller-uid-1', SECRET);
    const parts = state.split('.');
    parts[1] = 'attacker-uid'; // rewrite the uid
    assert.equal(verifyOAuthState(parts.join('.'), parts.join('.'), SECRET), null);
  });

  it('rejects a tampered signature', () => {
    const state = issueOAuthState('seller-uid-1', SECRET);
    const forged = `${state.slice(0, -2)}xx`;
    assert.equal(verifyOAuthState(forged, forged, SECRET), null);
  });

  it('rejects an expired state', () => {
    const now = Date.now();
    const state = issueOAuthState('seller-uid-1', SECRET, now);
    assert.equal(verifyOAuthState(state, state, SECRET, now + STATE_TTL_MS + 1000), null);
    // …and accepts it inside the window.
    assert.equal(verifyOAuthState(state, state, SECRET, now + 1000), 'seller-uid-1');
  });

  it('rejects a cookie/state mismatch (browser binding)', () => {
    const state = issueOAuthState('seller-uid-1', SECRET);
    const otherState = issueOAuthState('seller-uid-1', SECRET);
    assert.equal(verifyOAuthState(state, otherState, SECRET), null);
    assert.equal(verifyOAuthState(state, null, SECRET), null);
    assert.equal(verifyOAuthState(state, '', SECRET), null);
  });

  it('rejects the wrong secret', () => {
    const state = issueOAuthState('seller-uid-1', SECRET);
    assert.equal(verifyOAuthState(state, state, 'a-completely-different-long-secret'), null);
    assert.equal(verifyOAuthState(state, state, null), null);
  });

  it('refuses weak/missing secrets at issue time (no silent fallback)', () => {
    assert.throws(() => issueOAuthState('seller-uid-1', 'short'));
  });

  it('never embeds the secret into the state', () => {
    const state = issueOAuthState('seller-uid-1', SECRET);
    assert.ok(!state.includes(SECRET));
  });
});

describe('firestore rules: credential collection', () => {
  const src = read('src', 'firestore.rules');
  const root = read('firestore.rules');

  it('both rules copies are identical', () => {
    assert.equal(root.trim(), src.trim(), 'firestore.rules and src/firestore.rules differ');
  });

  it('tiktok_connections is explicitly denied for clients', () => {
    for (const rules of [src, root]) {
      const block = rules.match(/match\s+\/tiktok_connections\/\{uid\}\s*\{([^}]*)\}/);
      assert.ok(block, 'missing match /tiktok_connections/{uid} block');
      assert.match(block[1], /allow\s+read,\s*write:\s*if\s+false/);
      assert.doesNotMatch(block[1], /if\s+true/);
    }
  });

  it('userProfiles public read (marketplace dependency) was NOT changed', () => {
    const block = src.match(/match\s+\/userProfiles\/\{userId\}\s*\{([^}]*)\}/);
    assert.ok(block);
    assert.match(block[1], /allow\s+read:\s*if\s+true/);
  });
});

describe('credential privacy in source', () => {
  const callback = read('src', 'app', 'api', 'tiktok', 'callback', 'route.ts');
  const store = read('src', 'lib', 'tiktok', 'store.ts');
  const status = read('src', 'app', 'api', 'social-reach', 'status', 'route.ts');
  const history = read('src', 'app', 'api', 'social-reach', 'history', 'route.ts');
  const post = read('src', 'app', 'api', 'social-reach', 'post', 'route.ts');

  it('callback no longer writes tokens into userProfiles', () => {
    // Code-level checks (comments explaining the migration are fine).
    assert.doesNotMatch(callback, /collection\(['"]userProfiles['"]\)/);
    assert.doesNotMatch(callback, /connections\.tiktok['"]?\s*:/);
    assert.match(callback, /saveTikTokConnection/);
  });

  it('callback validates state against the binding cookie', () => {
    assert.match(callback, /verifyOAuthState/);
    assert.match(callback, /STATE_COOKIE/);
  });

  it('store never logs token values', () => {
    // console.* may reference uid/error only — no token-ish identifiers.
    const logLines = store.split('\n').filter((l) => /console\.(log|info|debug|warn|error)/.test(l));
    for (const line of logLines) {
      assert.doesNotMatch(line, /accessToken|refreshToken|access_token|refresh_token/i, `suspicious log: ${line.trim()}`);
    }
  });

  it('API responses never serialise token fields', () => {
    for (const src of [status, history, post]) {
      // No object-literal keys named accessToken/refreshToken (what gets
      // JSON-serialised); local server-side variables reading a token are fine.
      assert.doesNotMatch(src, /\b(accessToken|refreshToken)\s*:/);
      assert.doesNotMatch(src, /client_secret/i);
      assert.doesNotMatch(src, /console\.(log|info|debug)[^\n]*(token|secret)/i);
    }
  });

  it('token store is never imported by client pages or components', () => {
    const { execSync } = require('child_process') as typeof import('child_process');
    const hits = execSync(
      `grep -rl "tiktok/store" "${join(ROOT, 'src', 'components')}" "${join(ROOT, 'src', 'app')}" 2>/dev/null || true`,
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean)
      // API routes are server-side and allowed; everything else is not.
      .filter((f) => !f.includes(`${join(ROOT, 'src', 'app', 'api')}`));
    assert.deepEqual(hits, [], `client code imports the token store: ${hits.join(', ')}`);
  });
});

describe('publishing approval gate', () => {
  const config = read('src', 'lib', 'social-reach', 'config.ts');

  it('is OFF by default when flags are absent', () => {
    delete process.env.SOCIAL_REACH_PUBLISHING_ENABLED;
    delete process.env.TIKTOK_DIRECT_POST_APPROVED;
    // Import lazily so env mutations above are visible.
    const { publishingGate } = require('../lib/social-reach/config') as typeof import('../lib/social-reach/config');
    const gate = publishingGate();
    assert.equal(gate.enabled, false);
    assert.equal(gate.approvalGranted, false);
  });

  it('requires BOTH flags to enable', () => {
    const { publishingGate } = require('../lib/social-reach/config') as typeof import('../lib/social-reach/config');
    process.env.SOCIAL_REACH_PUBLISHING_ENABLED = 'true';
    delete process.env.TIKTOK_DIRECT_POST_APPROVED;
    assert.equal(publishingGate().enabled, false);
    process.env.TIKTOK_DIRECT_POST_APPROVED = 'true';
    assert.equal(publishingGate().enabled, true);
    delete process.env.SOCIAL_REACH_PUBLISHING_ENABLED;
    delete process.env.TIKTOK_DIRECT_POST_APPROVED;
  });

  it('post route checks the gate before calling TikTok', () => {
    const post = read('src', 'app', 'api', 'social-reach', 'post', 'route.ts');
    assert.match(post, /publishingGate\(\)/);
    const gateAt = post.indexOf('const gate = publishingGate()');
    const submitAt = post.indexOf('await postVideoToTikTok(');
    assert.ok(gateAt >= 0 && submitAt > gateAt, 'gate must be checked before submit');
  });

  it('the default cost is server-side (not client)', () => {
    assert.match(config, /DEFAULT_POST_COST_POINTS\s*=\s*50/);
    const page = read('src', 'app', 'dashboard', 'seller', 'social-reach', 'page.tsx');
    assert.doesNotMatch(page, /postCost\s*=\s*\d/); // page only displays what the server reports
  });
});

describe('job money-safety transitions', () => {
  const { canTransition, jobDocId } = require('../lib/social-reach/jobs') as typeof import('../lib/social-reach/jobs');

  it('allows refund exactly once', () => {
    assert.equal(canTransition('FAILED', 'REFUNDED'), true);
    assert.equal(canTransition('REFUNDED', 'REFUNDED'), false);
    assert.equal(canTransition('PUBLISHED', 'REFUNDED'), false, 'a published post must never be refunded');
  });

  it('never transitions out of terminal states', () => {
    assert.equal(canTransition('PUBLISHED', 'SUBMITTING'), false);
    assert.equal(canTransition('REFUNDED', 'PUBLISHED'), false);
  });

  it('parks uncertain results and requires explicit settlement', () => {
    assert.equal(canTransition('SUBMITTING', 'UNKNOWN'), true);
    assert.equal(canTransition('UNKNOWN', 'REFUNDED'), true, 'reconciliation may refund');
    assert.equal(canTransition('UNKNOWN', 'PUBLISHED'), true, 'reconciliation may confirm');
  });

  it('job ids are deterministic per seller+key and reject bad keys', () => {
    const a = jobDocId('seller-1', 'abcd1234-efgh');
    assert.equal(a, jobDocId('seller-1', 'abcd1234-efgh'));
    assert.notEqual(a, jobDocId('seller-2', 'abcd1234-efgh'));
    assert.throws(() => jobDocId('seller-1', 'short'));
    assert.throws(() => jobDocId('seller-1', 'contains spaces here'));
  });
});

describe('migration script safety', () => {
  const script = read('scripts', 'migrate-tiktok-connections.ts');

  it('defaults to dry-run', () => {
    assert.match(script, /mode = process\.argv\.find.*?\?\? '--dry-run'/);
  });

  it('never prints values, only counts', () => {
    assert.doesNotMatch(script, /console\.(log|info)\([^)]*(accessToken|refreshToken)/);
    assert.doesNotMatch(script, /JSON\.stringify\([^)]*legacy/);
  });

  it('rollback only deletes migration-created documents', () => {
    assert.match(script, /where\('migration',\s*'==',\s*MIGRATION_TAG\)/);
    assert.doesNotMatch(script, /\.collection\('userProfiles'\)[\s\S]{0,200}?\.delete\(\)/, 'must never delete profile docs');
  });
});