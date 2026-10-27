/**
 * VIDNOV CORE ENGINE — release routes, policy and wiring tests.
 *
 * Complements src/tests/vidnov-core.test.ts (design invariants) with the
 * pieces added for the release:
 *   • `evaluateTransition` — the pure policy every route state change goes
 *     through (reserved states, state machine, retry gating, reachability);
 *   • `applyJobTransition` / `retryDistributionJob` — ownership, idempotency,
 *     attempt caps, event tracking and event-failure handling against an
 *     in-memory fake Firestore (no credentials, no network);
 *   • source-level guarantees for the new route handlers (authenticated,
 *     schema-validated, no env reads, no self-declared success);
 *   • the search page's switch to the bounded API and its bounded retry;
 *   • the admin review UI wiring to the existing review API;
 *   • the ledger staying design-only (nothing imports it).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Firestore } from 'firebase-admin/firestore';

import { CHANNEL_ENV_REQUIREMENTS } from '../lib/vidnov-core/distribution/channels';
import {
  ADAPTER_ONLY_STATES,
  REFUSAL_MESSAGES,
  canRetry,
  evaluateTransition,
} from '../lib/vidnov-core/distribution/job-utils';
import {
  DistributionError,
  applyJobTransition,
  distributionErrorStatus,
  retryDistributionJob,
} from '../lib/vidnov-core/distribution/service';
import { MAX_JOB_ATTEMPTS, type JobStatus } from '../lib/vidnov-core/types';
import {
  distributionJobIdSchema,
  listDistributionJobsSchema,
  retryJobSchema,
  transitionJobSchema,
} from '../lib/vidnov-core/validation';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/* ── In-memory fake Firestore (create/get/update/transaction + failures) ── */

type Row = Record<string, unknown>;

interface FakeOptions {
  /** Collections whose `.create()` fails — to exercise event-write failures. */
  failCreate?: string[];
}

function fakeDb(seed: Record<string, Record<string, Row>> = {}, options: FakeOptions = {}) {
  const store: Record<string, Map<string, Row>> = {};
  for (const [name, docs] of Object.entries(seed)) {
    store[name] = new Map(Object.entries(docs));
  }
  const map = (name: string): Map<string, Row> => (store[name] ??= new Map());

  const docRef = (name: string, id: string) => ({
    async get() {
      const d = map(name).get(id);
      return { exists: d !== undefined, data: () => d };
    },
    async create(data: Row) {
      if (options.failCreate?.includes(name)) {
        throw Object.assign(new Error('write denied'), { code: 7 });
      }
      if (map(name).has(id)) throw Object.assign(new Error('already exists'), { code: 6 });
      map(name).set(id, { ...data });
    },
    async update(data: Row) {
      const cur = map(name).get(id);
      if (!cur) throw Object.assign(new Error('not found'), { code: 5 });
      map(name).set(id, { ...cur, ...data });
    },
  });

  const collection = (name: string) => ({
    doc: (id: string) => docRef(name, id),
    where: (field: string, _op: string, value: unknown) => {
      const filtered = Array.from(map(name), ([id, data]) => ({ id, data })).filter(
        (r) => r.data[field] === value,
      );
      return {
        limit: (n: number) => ({
          get: async () => ({ docs: filtered.slice(0, n).map((r) => ({ id: r.id, data: () => r.data })) }),
          count: () => ({ get: async () => ({ data: () => ({ count: filtered.length }) }) }),
        }),
      };
    },
    limit: (n: number) => ({
      get: async () => ({
        docs: Array.from(map(name), ([id, data]) => ({ id, data })).slice(0, n).map((r) => ({
          id: r.id,
          data: () => r.data,
        })),
      }),
    }),
    add: async (data: Row) => {
      const id = `auto_${map(name).size + 1}`;
      map(name).set(id, { ...data });
      return { id };
    },
  });

  // Serialise transactions the way Firestore resolves write conflicts.
  let txChain: Promise<unknown> = Promise.resolve();
  const db = {
    collection,
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const run = txChain.then(async () => {
        const tx = {
          get: (ref: { get: () => Promise<{ exists: boolean; data: () => Row | undefined }> }) => ref.get(),
          update: (ref: { update: (d: Row) => Promise<void> }, data: Row) => ref.update(data),
        };
        return fn(tx);
      });
      txChain = run.catch(() => undefined);
      return run;
    },
  };

  return { db: db as unknown as Firestore, store, map };
}

/** Realistic deterministic job id (dj_ + 40 hex, see distributionJobId). */
const jobId = (seed: string) => `dj_${seed.repeat(40).slice(0, 40)}`;

function seedJob(overrides: Row = {}): Record<string, Record<string, Row>> {
  return {
    distributionJobs: {
      [jobId('a')]: {
        productId: 'p1',
        sellerId: 'seller1',
        channel: 'google',
        status: 'ready',
        attempts: 0,
        lastError: null,
        supportedActions: [],
        ...overrides,
      },
    },
  };
}

const OWNER = { uid: 'seller1', isAdmin: false };
const STRANGER = { uid: 'someone-else', isAdmin: false };
const ADMIN = { uid: 'admin1', isAdmin: true };

async function rejects(fn: () => Promise<unknown>, code: string, message?: string) {
  try {
    await fn();
    assert.fail(`expected DistributionError ${code}`);
  } catch (err) {
    assert.ok(err instanceof DistributionError, `expected DistributionError, got ${String(err)}`);
    assert.equal(err.code, code, message ?? `expected code ${code}`);
    return err;
  }
}

/** Temporarily provides the env a channel needs so it reports "configured". */
async function withChannelConfigured<T>(channel: 'google' | 'meta' | 'tiktok', fn: () => Promise<T>): Promise<T> {
  const keys = CHANNEL_ENV_REQUIREMENTS[channel];
  const saved = keys.map((k) => process.env[k]);
  for (const k of keys) process.env[k] = `test-${k.toLowerCase()}`;
  try {
    return await fn();
  } finally {
    keys.forEach((k, i) => {
      const prev = saved[i];
      if (prev === undefined) delete process.env[k];
      else process.env[k] = prev;
    });
  }
}

/* ── Policy ──────────────────────────────────────────────────────────────── */

describe('distribution transition policy (pure)', () => {
  it('adapter-only states are refused for every caller, configured or not', () => {
    for (const to of ADAPTER_ONLY_STATES) {
      const decision = evaluateTransition({ from: 'ready', to, reachable: ['ready', 'queued', 'submitted', 'live', 'processing'] });
      assert.equal(decision.allowed, false, `${to} must never be reachable through the policy`);
      assert.equal(decision.refusal, 'reserved');
      assert.equal(decision.message, REFUSAL_MESSAGES.reserved);
    }
  });

  it('same-state re-assert is idempotent and always allowed', () => {
    assert.equal(evaluateTransition({ from: 'queued', to: 'queued', reachable: [] }).allowed, true);
    assert.equal(evaluateTransition({ from: 'live', to: 'live', reachable: [] }).allowed, true);
  });

  it('the shared state machine still refuses skips', () => {
    const d = evaluateTransition({ from: 'not_configured', to: 'queued', reachable: ['not_configured', 'ready', 'queued'] });
    assert.equal(d.allowed, false);
    assert.equal(d.refusal, 'invalid_transition');
  });

  it('failed → queued is a retry: refused by default, allowed only with allowRetry', () => {
    const reachable: readonly JobStatus[] = ['ready', 'failed', 'queued'];
    assert.equal(evaluateTransition({ from: 'failed', to: 'queued', reachable }).refusal, 'retry_not_allowed');
    assert.equal(evaluateTransition({ from: 'failed', to: 'queued', reachable, allowRetry: true }).allowed, true);
  });

  it('an unconfigured channel cannot leave its reachable states', () => {
    // Exact list channels report when their credentials are absent.
    const unconfigured: readonly JobStatus[] = ['not_configured', 'ready', 'failed', 'needs_attention'];
    assert.equal(evaluateTransition({ from: 'ready', to: 'queued', reachable: unconfigured }).refusal, 'not_configured');
    // Flagging trouble is still reachable — and legal for a queued job.
    assert.equal(evaluateTransition({ from: 'queued', to: 'needs_attention', reachable: unconfigured }).allowed, true);
    assert.equal(evaluateTransition({ from: 'ready', to: 'needs_attention', reachable: unconfigured }).refusal, 'invalid_transition');
  });

  it('refusal messages are static and credential-free', () => {
    for (const message of Object.values(REFUSAL_MESSAGES)) {
      assert.ok(message.length > 0 && message.length <= 120);
      assert.ok(!/token|secret|key=|http/i.test(message), `refusal must not leak details: ${message}`);
    }
  });

  it('error codes map to sane HTTP statuses', () => {
    assert.equal(distributionErrorStatus('not_found'), 404);
    assert.equal(distributionErrorStatus('forbidden'), 403);
    assert.equal(distributionErrorStatus('invalid_product'), 400);
    assert.equal(distributionErrorStatus('not_configured'), 409);
    assert.equal(distributionErrorStatus('retry_exhausted'), 409);
    assert.equal(distributionErrorStatus('retry_not_allowed'), 409);
    assert.equal(distributionErrorStatus('invalid_transition'), 409);
  });
});

/* ── Transition service ──────────────────────────────────────────────────── */

describe('applyJobTransition (authenticated state changes)', () => {
  it('refuses a caller who does not own the stored job', async () => {
    const { db } = fakeDb(seedJob());
    await rejects(
      () => applyJobTransition({ db, jobId: jobId('a'), to: 'failed', actor: STRANGER }),
      'forbidden',
    );
    // Nothing changed.
    assert.equal((await db.collection('distributionJobs').doc(jobId('a')).get()).data()?.status, 'ready');
  });

  it('lets an admin act on any job', async () => {
    const { db } = fakeDb(seedJob({ status: 'queued' }));
    const result = await applyJobTransition({ db, jobId: jobId('a'), to: 'needs_attention', actor: ADMIN });
    assert.equal(result.status, 'needs_attention');
    assert.equal(result.changed, true);
  });

  it('never lets a route claim processing/submitted/live', async () => {
    const { db } = fakeDb(seedJob({ status: 'queued' }));
    for (const to of ['processing', 'submitted', 'live'] as const) {
      await rejects(
        () => applyJobTransition({ db, jobId: jobId('a'), to, actor: OWNER }),
        'invalid_transition',
        `${to} must be refused`,
      );
    }
    assert.equal((await db.collection('distributionJobs').doc(jobId('a')).get()).data()?.status, 'queued');
  });

  it('refuses to advance an unconfigured channel but allows flagging it', async () => {
    const { db } = fakeDb(seedJob()); // channel google, env absent
    await rejects(
      () => applyJobTransition({ db, jobId: jobId('a'), to: 'queued', actor: OWNER }),
      'not_configured',
    );
    const flagged = await applyJobTransition({ db, jobId: jobId('a'), to: 'failed', actor: OWNER });
    assert.equal(flagged.status, 'failed');
  });

  it('refuses failed → queued unless the caller is the retry action', async () => {
    const { db } = fakeDb(seedJob({ status: 'failed', attempts: 1 }));
    await rejects(
      () => applyJobTransition({ db, jobId: jobId('a'), to: 'queued', actor: OWNER }),
      'retry_not_allowed',
    );
  });

  it('re-asserting the current state changes nothing and writes no event', async () => {
    const { db, map } = fakeDb(seedJob());
    const result = await applyJobTransition({ db, jobId: jobId('a'), to: 'ready', actor: OWNER });
    assert.equal(result.changed, false);
    assert.equal(result.status, 'ready');
    assert.equal(map('contentEvents').size, 0, 'no duplicate outcome event for a no-op');
  });

  it('records exactly ONE verified failure event, and a failed event write never blocks the transition', async () => {
    // First: normal path.
    const ok = fakeDb(seedJob());
    const first = await applyJobTransition({ db: ok.db, jobId: jobId('a'), to: 'failed', actor: OWNER });
    assert.equal(first.eventRecorded, true);
    assert.equal(ok.map('contentEvents').size, 1);

    // Same state again → idempotent, no second event.
    const again = await applyJobTransition({ db: ok.db, jobId: jobId('a'), to: 'failed', actor: OWNER });
    assert.equal(again.changed, false);
    assert.equal(ok.map('contentEvents').size, 1, 'a retried failure records one event, not two');

    // Second: event collection rejects writes → status still changes.
    const broken = fakeDb(seedJob(), { failCreate: ['contentEvents'] });
    const result = await applyJobTransition({ db: broken.db, jobId: jobId('a'), to: 'failed', actor: OWNER });
    assert.equal(result.status, 'failed', 'the decision/transition still commits');
    assert.equal(result.eventRecorded, false, 'the missing event is surfaced, never hidden');
  });

  it('bounds attempts on repeated failures and stops with retry_exhausted', async () => {
    const { db } = fakeDb(seedJob({ status: 'failed', attempts: MAX_JOB_ATTEMPTS }));
    await rejects(
      () => retryDistributionJob({ db, jobId: jobId('a'), actor: OWNER }),
      'retry_exhausted',
    );
  });
});

/* ── Retry service ───────────────────────────────────────────────────────── */

describe('retryDistributionJob (safe retry)', () => {
  it('only failed jobs are retryable', async () => {
    const { db } = fakeDb(seedJob({ status: 'ready' }));
    await rejects(() => retryDistributionJob({ db, jobId: jobId('a'), actor: OWNER }), 'invalid_transition');
  });

  it('a stranger cannot retry someone else\'s job', async () => {
    const { db } = fakeDb(seedJob({ status: 'failed', attempts: 1 }));
    await rejects(() => retryDistributionJob({ db, jobId: jobId('a'), actor: STRANGER }), 'forbidden');
  });

  it('non-retryable failure classes (auth/validation) are refused — config must change first', async () => {
    for (const cls of ['auth', 'validation', 'not_configured', 'unknown'] as const) {
      assert.equal(
        canRetry({ status: 'failed', attempts: 1, lastError: { class: cls, message: 'x', attempt: 1, at: '' } }),
        false,
        `class ${cls} is not auto-retryable`,
      );
      const { db } = fakeDb(
        seedJob({
          status: 'failed',
          attempts: 1,
          lastError: { class: cls, message: 'nope', attempt: 1, at: new Date().toISOString() },
        }),
      );
      await rejects(
        () => retryDistributionJob({ db, jobId: jobId('a'), actor: OWNER }),
        'retry_not_allowed',
        `class ${cls} must not be auto-retried`,
      );
    }
  });

  it('a retryable transient failure is queued only when the channel is configured', async () => {
    const error = { class: 'transient' as const, message: 'upstream timeout', attempt: 1, at: new Date().toISOString() };
    const unconfigured = fakeDb(seedJob({ status: 'failed', attempts: 1, lastError: error }));
    await rejects(
      () => retryDistributionJob({ db: unconfigured.db, jobId: jobId('a'), actor: OWNER }),
      'not_configured',
      'no credentials ⇒ nothing may go back to queued',
    );

    const configured = fakeDb(seedJob({ status: 'failed', attempts: 1, lastError: error }));
    await withChannelConfigured('google', async () => {
      const result = await retryDistributionJob({ db: configured.db, jobId: jobId('a'), actor: OWNER });
      assert.equal(result.status, 'queued');
      assert.equal(result.changed, true);
    });
    // Double-tap: already queued ⇒ idempotent no-op, not a second attempt.
    await withChannelConfigured('google', async () => {
      const repeat = await retryDistributionJob({ db: configured.db, jobId: jobId('a'), actor: OWNER });
      assert.equal(repeat.status, 'queued');
      assert.equal(repeat.changed, false);
    });
  });

  it('a configured channel may be queued (and only through the policy)', async () => {
    const { db } = fakeDb(seedJob());
    await withChannelConfigured('google', async () => {
      const result = await applyJobTransition({ db, jobId: jobId('a'), to: 'queued', actor: OWNER });
      assert.equal(result.status, 'queued');
    });
  });
});

/* ── Route sources ───────────────────────────────────────────────────────── */

describe('Core Engine release routes (source-level guarantees)', () => {
  it('every distribution route authenticates, validates and never reads env', () => {
    const create = read('src/app/api/distribution/jobs/route.ts');
    assert.ok(create.includes('verifyUserContext'), 'list/create require a verified identity');
    assert.ok(create.includes('createDistributionJobSchema'), 'create is schema-validated');
    assert.ok(create.includes('listDistributionJobsSchema'), 'list is schema-validated');
    assert.ok(create.includes('sellerId !== ctx.uid'), 'a product-scoped list is ownership-checked');
    assert.ok(create.includes("where('sellerId', '==', ctx.uid)"), 'a bare list is scoped to the stored seller id');
    assert.ok(create.includes('distributionErrorStatus'), 'errors go through the shared safe mapping');
    assert.ok(!create.includes('process.env'), 'routes never read environment values');

    const transition = read('src/app/api/distribution/jobs/[id]/transition/route.ts');
    assert.ok(transition.includes('verifyUserContext'), 'transitions require sign-in');
    assert.ok(transition.includes('distributionJobIdSchema'), 'job ids are pattern-validated');
    assert.ok(transition.includes('transitionJobSchema'), 'the target state is enum-validated');
    assert.ok(transition.includes('applyJobTransition'), 'every change goes through the guarded service');
    assert.ok(transition.includes('actor: { uid: ctx.uid, isAdmin: ctx.isAdmin }'), 'the actor is the verified identity');
    assert.ok(!transition.includes("'live'"), 'the route never names a success state');
    assert.ok(!transition.includes('process.env'), 'routes never read environment values');
    assert.ok(!transition.includes('reason'), 'no client-supplied error text can fake a retryable class');

    const retry = read('src/app/api/distribution/jobs/[id]/retry/route.ts');
    assert.ok(retry.includes('verifyUserContext'), 'retries require sign-in');
    assert.ok(retry.includes('retryJobSchema'), 'the empty body is still validated');
    assert.ok(retry.includes('retryDistributionJob'), 'retry goes through the eligibility-checked service');
    assert.ok(!retry.includes('process.env'), 'routes never read environment values');
  });

  it('the admin review interface is wired to the existing review API', () => {
    const page = read('src/app/dashboard/admin/system/opportunities/page.tsx');
    assert.ok(page.includes('/api/admin/opportunities?state='), 'lists via the existing admin API');
    assert.ok(page.includes("method: 'PUT'"), 'decides via the existing PUT handler');
    assert.ok(page.includes('Authorization'), 'sends the verified bearer token');
    assert.ok(page.includes('eventRecorded'), 'surfaces an unrecorded outcome event instead of hiding it');
    assert.ok(
      page.includes("decide(app.id, 'approved')") && page.includes("decide(app.id, 'rejected')"),
      'offers both decisions',
    );
    assert.ok(!page.includes('amountMinor') && !page.includes('balance'), 'no money surface in the review UI');

    const sidebar = read('src/components/admin/admin-sidebar.tsx');
    assert.ok(sidebar.includes("href: 'opportunities'"), 'the queue is reachable from the admin nav');

    const status = read('src/app/dashboard/admin/system/core-engine/page.tsx');
    assert.ok(status.includes('/dashboard/admin/system/opportunities'), 'status page links to the review queue');
  });

  it('the search page uses the bounded API and no longer downloads the catalog', () => {
    const page = read('src/app/search/page.tsx');
    assert.ok(page.includes('/api/search'), 'search runs server-side');
    assert.ok(page.includes('encodeURIComponent(queryTerm)'), 'the query is encoded, never interpolated raw');
    assert.ok(page.includes('retries < 1'), 'the automatic retry is bounded to a single attempt');
    assert.ok(page.includes('controller.abort()'), 'in-flight searches are cancelled when the query changes');
    assert.ok(!page.includes('useCollection'), 'no Firestore collection subscription in the browser');
    assert.ok(!page.includes("collection(firestore, 'products')"), 'the full products collection is never downloaded');
    assert.ok(!page.includes('useFirestore'), 'the page does not open a Firestore connection');

    const route = read('src/app/api/search/route.ts');
    assert.ok(route.includes('searchParamsSchema'), 'search stays validated at the boundary');
    assert.ok(!route.includes('process.env'), 'the public search route reads no environment values');
  });

  it('the ledger stays design-only: nothing in the app imports it', () => {
    const ledger = read('src/lib/vidnov-core/trust/ledger.ts');
    assert.ok(!ledger.includes('firebase'), 'ledger has no database access');
    assert.ok(!ledger.includes('collection('), 'ledger has no read/write surface');

    // No route or service wires the ledger up "just yet": checked as an
    // IMPORT (documentation may legitimately mention the file path).
    const importsLedger = (src: string) => /from\s+['"][^'"]*trust\/ledger['"]/.test(src);
    for (const f of [
      'src/app/api/distribution/jobs/route.ts',
      'src/app/api/distribution/jobs/[id]/transition/route.ts',
      'src/app/api/distribution/jobs/[id]/retry/route.ts',
      'src/app/api/admin/opportunities/route.ts',
      'src/app/api/opportunities/route.ts',
      'src/lib/vidnov-core/distribution/service.ts',
      'src/lib/vidnov-core/opportunities/service.ts',
    ]) {
      assert.ok(!importsLedger(read(f)), `${f} must not import the design-only ledger`);
    }
  });

  it('no route or service claims a job is live on its own', () => {
    const service = read('src/lib/vidnov-core/distribution/service.ts');
    assert.ok(!/status:\s*'live'/.test(service), "nothing sets 'live' directly");
    for (const f of [
      'src/app/api/distribution/jobs/route.ts',
      'src/app/api/distribution/jobs/[id]/transition/route.ts',
      'src/app/api/distribution/jobs/[id]/retry/route.ts',
    ]) {
      assert.ok(!/status:\s*'live'/.test(read(f)), `${f} cannot declare success`);
    }
  });

  it('no Firestore rules change ships with this release', () => {
    // The new engine collections rely on default-deny (no matching rule),
    // exactly as documented — this release must not add client rules.
    const rules = read('firestore.rules');
    assert.equal(rules, read('src/firestore.rules'), 'both rules files stay byte-identical');
    assert.ok(!rules.includes('distributionJobs'), 'distributionJobs stays default-deny for clients');
    assert.ok(!rules.includes('opportunityApplications'), 'applications stay server-only');
  });
});

/* ── Request schemas ─────────────────────────────────────────────────────── */

describe('release request schemas', () => {
  it('job ids are minted ids only — no paths, no arbitrary strings', () => {
    assert.equal(distributionJobIdSchema.safeParse(jobId('a')).success, true);
    assert.equal(distributionJobIdSchema.safeParse('../products/evil').success, false);
    assert.equal(distributionJobIdSchema.safeParse('dj_' + 'z'.repeat(40)).success, false, 'hex only');
    assert.equal(distributionJobIdSchema.safeParse('dj_short').success, false);
  });

  it('the transition body carries ONLY the target state', () => {
    assert.equal(transitionJobSchema.safeParse({ to: 'queued' }).success, true);
    for (const to of ['not_configured', 'ready', 'queued', 'processing', 'submitted', 'live', 'failed', 'needs_attention']) {
      assert.equal(transitionJobSchema.safeParse({ to }).success, true, `${to} is a valid enum member (policy decides)`);
    }
    assert.equal(transitionJobSchema.safeParse({ to: 'queued', sellerId: 'evil' }).success, false);
    assert.equal(transitionJobSchema.safeParse({ to: 'queued', attempts: 99 }).success, false);
    assert.equal(transitionJobSchema.safeParse({ to: 'queued', error: 'auth 401' }).success, false, 'no forged failure text');
    assert.equal(transitionJobSchema.safeParse({ to: 'DONE' }).success, false);
  });

  it('retry and list bodies are fixed-shape', () => {
    assert.equal(retryJobSchema.safeParse({}).success, true);
    assert.equal(retryJobSchema.safeParse({ force: true }).success, false);
    assert.equal(retryJobSchema.safeParse({ attempts: 0 }).success, false);

    assert.equal(listDistributionJobsSchema.safeParse({ productId: 'p1' }).success, true);
    assert.equal(listDistributionJobsSchema.safeParse({}).success, true);
    assert.equal(listDistributionJobsSchema.safeParse({ sellerId: 'someone' }).success, false);
    assert.equal(listDistributionJobsSchema.safeParse({ productId: 'p/evil' }).success, false);
  });
});
