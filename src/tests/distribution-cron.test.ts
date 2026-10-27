/**
 * DISTRIBUTION CRON — the gate must fail closed, and the pass must be honest.
 *
 * Why these tests exist: the scheduler entry point is the ONLY piece of the
 * distribution engine that is reachable without a signed-in user. Every other
 * route is protected by `verifyAdminUid`; this one is protected by a shared
 * secret and a feature flag, so the failure modes that matter are all
 * authorization-shaped:
 *
 *   • disabled → no work, silent 204 (it must not start life reachable);
 *   • enabled with NO secret configured → refuse (an unauthenticated trigger
 *     for outbound API spend is worse than an endpoint that does not run);
 *   • wrong/garbage/empty secret → refuse, timing-safe compare;
 *   • correct secret → allowed, via header or the legacy query shape.
 *
 * The gate is a pure function (`authorizeCronSchedule`), so these are REAL
 * behavioral assertions, not source reading. The route itself is checked for
 * wiring: gate before work, reconcile before engine, counters-only response,
 * static logs, and the overlap guard.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { authorizeCronSchedule, secretsMatch } from '../lib/vidnov-core/distribution/cron-auth';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
/** Comments stripped — the route documents the code it replaced. */
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const ROUTE = 'src/app/api/distribution/cron/route.ts';

/* ── 1. The gate, behaviorally ──────────────────────────────────────────── */

describe('the scheduler gate fails closed', () => {
  it('disabled → 204 and no work, regardless of the secret presented', () => {
    const withRightSecret = authorizeCronSchedule({ enabled: false, secret: 's3cret' }, 's3cret');
    const withNoSecret = authorizeCronSchedule({ enabled: false, secret: '' }, '');
    assert.deepEqual(withRightSecret, { allowed: false, status: 204 });
    assert.deepEqual(withNoSecret, { allowed: false, status: 204 });
    // The disabled answer must not reveal whether the secret would have matched.
    assert.equal(withRightSecret.allowed, false);
  });

  it('enabled WITHOUT a configured secret → 403, never a pass-through', () => {
    // The dangerous misconfiguration: the flag says run, the secret is unset.
    // An empty expected secret must never match anything, including empty.
    assert.deepEqual(
      authorizeCronSchedule({ enabled: true, secret: '' }, ''),
      { allowed: false, status: 403 },
    );
    assert.deepEqual(
      authorizeCronSchedule({ enabled: true, secret: '   ' }, 'anything'),
      { allowed: false, status: 403 },
      'a whitespace-only secret is not a secret',
    );
  });

  it('enabled with a secret: only the exact secret is allowed', () => {
    const env = { enabled: true, secret: 'correct-horse-battery-staple' };
    assert.deepEqual(authorizeCronSchedule(env, 'correct-horse-battery-staple'), { allowed: true });

    for (const bad of [
      '',
      'correct-horse',
      'Correct-horse-battery-staple',
      'correct-horse-battery-staple ',
      'correct-horse-battery-staple\n',
      "' OR '1'='1",
      'a'.repeat(5000),
    ]) {
      assert.deepEqual(
        authorizeCronSchedule(env, bad),
        { allowed: false, status: 403 },
        `presentation ${JSON.stringify(bad.slice(0, 30))} must be refused`,
      );
    }
  });

  it('the comparison is timing-safe (digests, not raw string ===)', () => {
    // Function-level guarantee: it must be the SHA-256 + timingSafeEqual path.
    const source = readCode('src/lib/vidnov-core/distribution/cron-auth.ts');
    assert.ok(source.includes('timingSafeEqual'), 'the compare must be constant-time');
    assert.ok(source.includes("createHash('sha256')"), 'over fixed-length digests');
    assert.equal(
      /\bexpected\s*===\s*presented|presented\s*===\s*expected/.test(source),
      false,
      'a direct string comparison is a timing oracle',
    );
    // Behavior: equal values match, length differences never throw.
    assert.equal(secretsMatch('abc', 'abc'), true);
    assert.equal(secretsMatch('abc', 'abd'), false);
    assert.equal(secretsMatch('abc', 'a-very-much-longer-presentation-value'), false);
    assert.equal(secretsMatch('', ''), false, 'two empty strings must never match');
  });

  it('the decision carries no reason a probe could enumerate', () => {
    const reasons = [
      authorizeCronSchedule({ enabled: false, secret: '' }, 'x'),
      authorizeCronSchedule({ enabled: true, secret: '' }, 'x'),
      authorizeCronSchedule({ enabled: true, secret: 'k' }, 'wrong'),
    ];
    for (const d of reasons) {
      assert.deepEqual(Object.keys(d).sort(), ['allowed', 'status'].sort());
      assert.equal(d.allowed, false);
      // Two different failures can share a status only if both are 403 — the
      // point is that no message field exists at all.
      assert.equal('message' in d, false);
    }
  });
});

/* ── 2. Route wiring ────────────────────────────────────────────────────── */

describe('the cron route runs nothing before the gate and returns only counters', () => {
  it('authorizes before any database work', () => {
    const source = readCode(ROUTE);
    const gate = source.indexOf('function authorize(');
    // The call site, not the definition — `runPass` is defined before `handle`.
    const run = source.indexOf('const pass: Promise<CronReport> = runPass()');
    const denied = source.indexOf('const denied = authorize(request)');
    assert.ok(gate > 0, 'the gate exists');
    assert.ok(denied > 0, 'the gate is consulted');
    assert.ok(run > 0, 'the pass is invoked');
    assert.ok(
      denied < run,
      'the gate must run before the pass — authorization precedes work',
    );
    assert.ok(
      source.indexOf('const denied = authorize(request)') <
        source.indexOf('if (denied) return denied'),
      'a denied request returns immediately',
    );
  });

  it('reconciles first, then runs the engine (queues truthful before submit)', () => {
    const source = readCode(ROUTE);
    const rec = source.indexOf('reconcileDistribution({');
    const eng = source.indexOf('runDistributionEngine({');
    assert.ok(rec > 0 && eng > 0, 'both passes are called');
    assert.ok(rec < eng, 'sweep must precede submission or jobs stay stale');
  });

  it('runs as the scheduler, not as a fabricated admin user', () => {
    const source = readCode(ROUTE);
    assert.ok(
      source.includes("const CRON_ACTOR = 'system:cron'"),
      'the audit trail must name the scheduler honestly',
    );
    assert.equal(
      /actorUid:\s*'[^']+'/.test(source.replace('system:cron', '')),
      false,
      'no hard-coded user uid may be passed to the engine',
    );
  });

  it('returns counters only — no per-job rows, no payloads, no listing samples', () => {
    const source = readCode(ROUTE);
    // The report object literal must not carry the bounded detail arrays.
    assert.equal(/\bjobs\s*:/.test(source), false, 'per-job rows stay admin-only');
    assert.equal(/\bineligible\s*:/.test(source), false, 'listing samples stay admin-only');
    assert.equal(/\bpayload\s*:/.test(source), false, 'payloads never leave the process');
    // Both detail fields exist in the types — they are deliberately unused here.
    const full = read(ROUTE);
    assert.ok(full.includes('eng.jobs'), 'the omission is deliberate and documented');
  });

  it('overlapping scheduler hits are rejected instead of double-spending quota', () => {
    const source = readCode(ROUTE);
    assert.ok(source.includes('inFlight'), 'an in-process overlap guard exists');
    assert.ok(source.includes("'in_progress'"), 'the second caller is told why');
    assert.ok(source.includes('409'), 'and it is a conflict, not a silent skip');
    assert.ok(
      source.includes('inFlight === pass'),
      'the guard is released only by the pass that set it',
    );
  });

  it('logs are static strings — no error objects, payloads or credentials', () => {
    const source = readCode(ROUTE);
    const logs = source.match(/console\.(error|warn|log)\([^)]*\)/g) ?? [];
    assert.ok(logs.length > 0, 'a failed pass must still be observable');
    for (const line of logs) {
      assert.ok(
        /^console\.error\('[^']*'\)$/.test(line),
        `log must be one static string, got: ${line}`,
      );
    }
    assert.equal(/console\.(log|info|debug)/.test(source), false, 'no debug logging in a cron path');
  });

  it('the handler is exposed as both GET and POST for the existing scheduler', () => {
    const source = readCode(ROUTE);
    assert.ok(source.includes('export async function GET('));
    assert.ok(source.includes('export async function POST('));
    assert.ok(source.includes("export const runtime = 'nodejs'"), 'node runtime for crypto + admin SDK');
  });
});
