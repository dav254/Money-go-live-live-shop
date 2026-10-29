/**
 * DISTRIBUTION ENGINE (Core Engine Stages 1–4) — tests.
 *
 * Covers, against an in-memory fake Firestore (no credentials, no network):
 *   • product eligibility (required fields, ownership, images, visibility, URL safety);
 *   • reconciliation: idempotent job creation, stop-on-ineligible, bounded
 *     reports, no duplicate stops, no fabricated events;
 *   • the honesty contract: HTTP success ⇒ `accepted` only; `published`/
 *     `indexed` only from a verify/inspect step; submission logs sanitized;
 *   • global pause, per-run budget and per-day quotas (no attempt burned);
 *   • bounded retries, failure classification, dead-letter re-queue caps;
 *   • audit writes (sanitized, append-only, bounded) and destination
 *     analytics (real counts, null on failure);
 *   • route/page source guarantees: admin authorization everywhere, no env
 *     reads in routes, no raw error logging, no Firestore rules changes;
 *   • growth `ch` attribution: closed-set validation, invalid labels dropped
 *     without breaking measurement.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';
import { generateKeyPairSync } from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';

import {
  CHANNELS,
  CHANNEL_ENV_REQUIREMENTS,
  getJobDestinations,
  PAYLOAD_VERSION,
} from '../lib/vidnov-core/distribution/channels';
import {
  evaluateProductEligibility,
  isVisiblyHidden,
} from '../lib/vidnov-core/distribution/eligibility';
import {
  SAFE_DEFAULT_CONFIG,
  readDistributionConfig,
  reserveQuota,
  updateDistributionConfig,
} from '../lib/vidnov-core/distribution/config';
import { recordAudit, listAudit } from '../lib/vidnov-core/distribution/audit';
import { destinationAnalytics } from '../lib/vidnov-core/distribution/analytics';
import { reconcileDistribution } from '../lib/vidnov-core/distribution/reconcile';
import {
  applySubmissionOutcome,
  runDistributionEngine,
} from '../lib/vidnov-core/distribution/engine';
import { runDestinationAction, readGa4Traffic } from '../lib/vidnov-core/distribution/adapters';
import {
  DistributionError,
  adminRequeueDistributionJob,
  applyJobTransition,
  createDistributionJob,
  retryDistributionJob,
} from '../lib/vidnov-core/distribution/service';
import { canRetry } from '../lib/vidnov-core/distribution/job-utils';
import { CHANNEL_IDS, MAX_ADMIN_REQUEUES, MAX_JOB_ATTEMPTS, MAX_SUBMISSION_LOG } from '../lib/vidnov-core/types';
import { parseEventInput } from '../lib/growth/events';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/* ── In-memory fake Firestore (queries, chained equality, transactions) ─── */

type Row = Record<string, unknown>;

interface FakeOptions {
  /** Collections whose writes throw (code 7). */
  failCollections?: string[];
  /** Every count() query throws — exercises "unknown, never zero". */
  failCount?: boolean;
}

function fakeDb(seed: Record<string, Record<string, Row>> = {}, options: FakeOptions = {}) {
  const store: Record<string, Map<string, Row>> = {};
  for (const [name, docs] of Object.entries(seed)) store[name] = new Map(Object.entries(docs));
  const map = (name: string): Map<string, Row> => (store[name] ??= new Map());
  const failWrite = (name: string) => options.failCollections?.includes(name) ?? false;

  const docRef = (name: string, id: string) => ({
    async get() {
      const d = map(name).get(id);
      return { exists: d !== undefined, data: () => d };
    },
    async create(data: Row) {
      if (failWrite(name)) throw Object.assign(new Error('write denied'), { code: 7 });
      if (map(name).has(id)) throw Object.assign(new Error('already exists'), { code: 6 });
      map(name).set(id, { ...data });
    },
    async update(data: Row) {
      const cur = map(name).get(id);
      if (!cur) throw Object.assign(new Error('not found'), { code: 5 });
      map(name).set(id, { ...cur, ...data });
    },
    async set(data: Row, _opts?: unknown) {
      if (failWrite(name)) throw Object.assign(new Error('write denied'), { code: 7 });
      const cur = map(name).get(id);
      map(name).set(id, cur ? { ...cur, ...data } : { ...data });
    },
  });

  const getField = (row: Row, path: string): unknown =>
    path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object') return (acc as Row)[key];
      return undefined;
    }, row);

  interface Q {
    col: string;
    filters: Array<[string, unknown]>;
    orderByField?: string;
    limitN?: number;
  }
  const execGet = (q: Q) => {
    let rows = [...map(q.col)].map(([id, data]) => ({ id, data }));
    for (const [f, v] of q.filters) rows = rows.filter((r) => getField(r.data, f) === v);
    if (q.orderByField) {
      rows = [...rows].sort((a, b) =>
        String(a.data[q.orderByField as string] ?? '').localeCompare(
          String(b.data[q.orderByField as string] ?? ''),
        ),
      );
    }
    if (q.limitN !== undefined) rows = rows.slice(0, q.limitN);
    return rows.map((r) => ({ id: r.id, data: () => r.data }));
  };

  const query = (q: Q): Record<string, unknown> => ({
    where: (f: string, _op: string, v: unknown) =>
      query({ ...q, filters: [...q.filters, [f, v] as [string, unknown]] }),
    orderBy: (f: string, _dir?: string) => query({ ...q, orderByField: f }),
    limit: (n: number) => query({ ...q, limitN: n }),
    count: () => ({
      get: async () => {
        if (options.failCount) throw new Error('index unavailable');
        return { data: () => ({ count: execGet(q).length }) };
      },
    }),
    get: async () => ({ docs: execGet(q) }),
  });

  let auto = 0;
  let chain: Promise<unknown> = Promise.resolve();
  const db = {
    collection: (name: string) => ({
      doc: (id: string) => docRef(name, id),
      add: async (data: Row) => {
        if (failWrite(name)) throw Object.assign(new Error('write denied'), { code: 7 });
        auto += 1;
        const id = `auto_${String(auto).padStart(6, '0')}`;
        map(name).set(id, { ...data });
        return { id };
      },
      ...query({ col: name, filters: [] }),
    }),
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const run = chain.then(async () => {
        const tx = {
          get: (ref: { get: () => Promise<{ exists: boolean; data: () => Row | undefined }> }) =>
            ref.get(),
          update: (ref: { update: (d: Row) => Promise<void> }, data: Row) => ref.update(data),
          set: (ref: { set: (d: Row, o?: unknown) => Promise<void> }, data: Row, opts?: unknown) =>
            ref.set(data, opts),
        };
        return fn(tx);
      });
      chain = run.catch(() => undefined);
      return run;
    },
  };

  return { db: db as unknown as Firestore, store, map };
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

async function withEnv<T>(
  vars: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

interface FakeRoute {
  match: string | RegExp;
  status: number;
  body?: string | object;
}

/** Fake fetch: first matching route answers, otherwise the network "fails". */
function fakeFetch(routes: FakeRoute[]) {
  const calls: Array<{
    url: string;
    init?: { method?: string; headers?: Record<string, string>; body?: unknown };
  }> = [];
  const impl = async (
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: unknown },
  ): Promise<{ status: number; ok: boolean; text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer> }> => {
    calls.push({ url, init });
    for (const r of routes) {
      const hit = typeof r.match === 'string' ? url.includes(r.match) : r.match.test(url);
      if (hit) {
        const text =
          typeof r.body === 'string'
            ? r.body
            : r.body !== undefined
              ? JSON.stringify(r.body)
              : '';
        return {
          status: r.status,
          ok: r.status >= 200 && r.status < 300,
          text: async () => text,
          arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
        };
      }
    }
    throw new Error('network down');
  };
  return { impl, calls };
}

const PRODUCT_ROW: Row = {
  sellerId: 'seller1',
  name: 'Gold Ring',
  description: 'A lovely ring',
  price: 25000,
  stock: 3,
  imageUrl: 'https://cdn.example.com/ring.jpg',
  category: 'Jewellery',
  uploadDate: '2026-10-01',
};

const OWNER = { uid: 'seller1', isAdmin: false };
const ADMIN = { uid: 'admin1', isAdmin: true };

/** Creates a product + a queued job for one destination, via the real path. */
async function seedQueuedJob(
  db: Firestore,
  channel: (typeof CHANNEL_IDS)[number],
  productId = 'p1',
  sellerId = 'seller1',
): Promise<string> {
  const created = await createDistributionJob({
    db,
    productId,
    channel,
    actorUid: sellerId,
    isAdmin: false,
  });
  await applyJobTransition({ db, jobId: created.jobId, to: 'queued', actor: { uid: sellerId, isAdmin: false } });
  return created.jobId;
}

async function rejects(
  fn: () => Promise<unknown>,
  code: string,
): Promise<DistributionError> {
  try {
    await fn();
    assert.fail(`expected DistributionError ${code}`);
  } catch (err) {
    assert.ok(err instanceof DistributionError, `expected DistributionError, got ${String(err)}`);
    assert.equal(err.code, code);
    return err;
  }
}

/* ── Stage 1: eligibility ───────────────────────────────────────────────── */

describe('product eligibility (pure)', () => {
  it('accepts a complete, visible listing — including price-on-quote services', () => {
    const ok = evaluateProductEligibility('p1', PRODUCT_ROW);
    assert.equal(ok.eligible, true);
    assert.deepEqual(ok.reasons, []);
    assert.equal(ok.publicPath, '/products/p1');

    const quote = evaluateProductEligibility('svc1', {
      ...PRODUCT_ROW,
      price: 0,
      priceMode: 'quote',
      listingType: 'service',
    });
    assert.equal(quote.eligible, true, 'a 0-price quote service is legitimate');
  });

  it('reports each failure with a stable reason', () => {
    const cases: Array<[Partial<Row>, string]> = [
      [{ ...PRODUCT_ROW, name: '' }, 'missing_name'],
      [{ ...PRODUCT_ROW, sellerId: '' }, 'missing_seller'],
      [{ ...PRODUCT_ROW, price: -1 }, 'invalid_price'],
      [{ ...PRODUCT_ROW, price: Number.NaN }, 'invalid_price'],
      [{ ...PRODUCT_ROW, imageUrl: undefined, imageUrls: [] }, 'missing_image'],
      [{ ...PRODUCT_ROW, hidden: true }, 'not_visible'],
      [{ ...PRODUCT_ROW, archived: true }, 'not_visible'],
      [{ ...PRODUCT_ROW, isActive: false }, 'not_visible'],
      [{ ...PRODUCT_ROW, status: 'draft' }, 'not_visible'],
      [{ ...PRODUCT_ROW, visibility: 'private' }, 'not_visible'],
    ];
    for (const [row, reason] of cases) {
      const result = evaluateProductEligibility('p1', row);
      assert.equal(result.eligible, false, `${reason} must fail eligibility`);
      assert.ok(result.reasons.includes(reason as never), `expected reason ${reason}`);
    }
  });

  it('absent visibility flags mean visible (Product-type semantics)', () => {
    const { hidden: _h, ...withoutHidden } = { ...PRODUCT_ROW } as Row;
    assert.equal(isVisiblyHidden(withoutHidden), false);
    assert.equal(isVisiblyHidden(PRODUCT_ROW), false);
  });

  it('rejects unsafe ids and never yields a path for them', () => {
    const bad = evaluateProductEligibility('../etc/passwd', PRODUCT_ROW);
    assert.equal(bad.eligible, false);
    assert.ok(bad.reasons.includes('unsafe_id'));
    assert.equal(bad.publicPath, null);
  });

  it('prefers any image source (imageUrls / thumbnailUrls count)', () => {
    const withList = evaluateProductEligibility('p1', {
      ...PRODUCT_ROW,
      imageUrl: undefined,
      thumbnailUrls: ['https://cdn.example.com/t.jpg'],
    });
    assert.equal(withList.eligible, true);
  });
});

/* ── Stage 1: reconciliation ────────────────────────────────────────────── */

describe('reconcileDistribution (lifecycle sweep)', () => {
  it('creates jobs for every job-eligible destination — and is idempotent', async () => {
    const { db, map } = fakeDb({ products: { p1: PRODUCT_ROW } });

    const first = await reconcileDistribution({ db, actor: ADMIN });
    const jobDestinations = getJobDestinations();
    assert.equal(jobDestinations.length, 7, 'seven per-listing destinations (ga is connection-only)');
    assert.equal(first.scannedProducts, 1);
    assert.equal(first.jobsCreated, jobDestinations.length);
    assert.equal(first.jobsStopped, 0);
    assert.equal(map('distributionJobs').size, jobDestinations.length);

    const second = await reconcileDistribution({ db, actor: ADMIN });
    assert.equal(second.jobsCreated, 0, 'second sweep creates nothing');
    assert.equal(second.jobsAlreadyPresent, jobDestinations.length, 'duplicates resolve to same docs');
    assert.equal(map('distributionJobs').size, jobDestinations.length, 'never two jobs per pair');
  });

  it('stops jobs for deleted, ineligible, re-owned and outdated-payload products', async () => {
    const { db, map } = fakeDb({
      products: {
        // eligible (kept)
        p1: PRODUCT_ROW,
        // ineligible: no image
        p2: { ...PRODUCT_ROW, imageUrl: undefined, imageUrls: [] },
        // re-owned
        p3: { ...PRODUCT_ROW, sellerId: 'new-owner' },
        // eligible but the job below carries an outdated payload version
        p4: { ...PRODUCT_ROW, uploadDate: '2026-10-02' },
      },
      distributionJobs: {
        dj_deleted: {
          productId: 'gone',
          sellerId: 'seller1',
          channel: 'google',
          status: 'ready',
          attempts: 0,
          payloadVersion: PAYLOAD_VERSION,
        },
        dj_owned: {
          productId: 'p3',
          sellerId: 'old-owner',
          channel: 'meta',
          status: 'queued',
          attempts: 0,
          payloadVersion: PAYLOAD_VERSION,
        },
        dj_outdated: {
          productId: 'p4',
          sellerId: 'seller1',
          channel: 'tiktok',
          status: 'live',
          attempts: 0,
          payloadVersion: 'v0',
        },
      },
    });

    const report = await reconcileDistribution({ db, actor: ADMIN });
    assert.equal(report.jobsStopped, 3);
    assert.equal(report.stopReasons.product_deleted, 1);
    assert.equal(report.stopReasons.seller_changed, 1);
    assert.equal(report.stopReasons.payload_version_outdated, 1);
    assert.ok(
      report.ineligible.some(
        (i) => i.productId === 'p2' && i.reasons.includes('missing_image'),
      ),
      'ineligible listing reported with reasons',
    );
    assert.equal(report.ineligibleCount, 1);

    for (const id of ['dj_deleted', 'dj_owned', 'dj_outdated']) {
      const row = map('distributionJobs').get(id);
      assert.equal(row?.status, 'stopped', `${id} must be stopped`);
    }
    // Stopping records NO outcome event (stops are not success/failure claims).
    assert.equal(map('contentEvents').size, 0, 'no fabricated events from stopping');

    // Idempotent: a second sweep neither re-stops nor double counts.
    const again = await reconcileDistribution({ db, actor: ADMIN });
    assert.equal(again.jobsStopped, 0, 'already-stopped jobs are skipped');
    assert.equal(again.stopReasons.product_deleted, undefined);
  });

  it('never creates jobs for ineligible listings and reports why', async () => {
    const { db, map } = fakeDb({
      products: {
        p_bad: { ...PRODUCT_ROW, imageUrl: undefined, imageUrls: [], hidden: true },
      },
    });
    const report = await reconcileDistribution({ db, actor: ADMIN });
    assert.equal(report.jobsCreated, 0);
    assert.equal(report.ineligibleCount, 1);
    assert.ok(report.ineligible[0].reasons.includes('missing_image'));
    assert.ok(report.ineligible[0].reasons.includes('not_visible'));
    assert.equal(map('distributionJobs').size, 0);
  });

  it('bounds the sweep window', async () => {
    const products: Record<string, Row> = {};
    for (let i = 0; i < 10; i += 1) products[`p${i}`] = { ...PRODUCT_ROW, imageUrl: `https://cdn.example.com/${i}.jpg` };
    const { db } = fakeDb({ products });
    const report = await reconcileDistribution({ db, actor: ADMIN, productLimit: 3, jobLimit: 2 });
    assert.equal(report.scannedProducts, 3, 'product window honoured');
    assert.ok(report.jobsCreated <= 3 * 7);
  });
});

/* ── Stage 3: config, quotas, pause ─────────────────────────────────────── */

describe('engine configuration (pause, limits, quotas)', () => {
  it('reads safe defaults when nothing is configured', async () => {
    const { db } = fakeDb();
    const config = await readDistributionConfig(db);
    assert.equal(config.paused, SAFE_DEFAULT_CONFIG.paused);
    assert.equal(config.maxPerRun, SAFE_DEFAULT_CONFIG.maxPerRun);
    assert.equal(config.maxPerDay, SAFE_DEFAULT_CONFIG.maxPerDay);
  });

  it('clamps hostile values and preserves pause bookkeeping on limit edits', async () => {
    const { db } = fakeDb();

    const tooBig = await updateDistributionConfig(db, { maxPerRun: 99999 }, 'admin1');
    assert.equal(tooBig.maxPerRun, 50, 'clamped to the hard bound');

    const paused = await updateDistributionConfig(db, { paused: true }, 'admin1');
    assert.equal(paused.paused, true);
    assert.equal(paused.pausedBy, 'admin1');
    assert.ok(paused.pausedAt);

    const limitsOnly = await updateDistributionConfig(db, { maxPerDay: 42 }, 'admin1');
    assert.equal(limitsOnly.paused, true, 'pause untouched by a limits edit');
    assert.equal(limitsOnly.pausedBy, 'admin1', 'pauser untouched by a limits edit');
    assert.equal(limitsOnly.maxPerDay, 42);
  });

  it('reserves quota transactionally and refuses once the budget is spent', async () => {
    const { db, map } = fakeDb();
    assert.equal(await reserveQuota(db, 'sitemap', 2, 100), true);
    assert.equal(await reserveQuota(db, 'sitemap', 2, 100), true);
    assert.equal(await reserveQuota(db, 'sitemap', 2, 100), false, 'third call refused');
    assert.equal(map('distributionQuotas').size, 1, 'one quota doc per destination per day');
  });

  it('the global pause stops the engine cold — no quota, no job movement', async () => {
    const { db, map } = fakeDb({
      products: { p1: PRODUCT_ROW },
      distributionConfig: { global: { paused: true, maxPerRun: 10, maxPerDay: 100 } },
    });
    const jobId = await seedQueuedJob(db, 'sitemap');
    const spy = fakeFetch([]);

    const report = await runDistributionEngine({ db, actorUid: 'admin1', fetchImpl: spy.impl });
    assert.equal(report.paused, true);
    assert.equal(report.processed, 0);
    assert.equal(spy.calls.length, 0, 'a paused engine performs no network work');
    assert.equal(map('distributionQuotas').size, 0, 'a paused engine claims no quota');
    const job = map('distributionJobs').get(jobId);
    assert.equal(job?.status, 'queued', 'queued jobs stay queued while paused');
    assert.ok(map('distributionAudit').size >= 1, 'the skipped run is still audited');
  });

  it('honours the per-run budget across jobs', async () => {
    const { db } = fakeDb({
      products: { p1: PRODUCT_ROW, p2: { ...PRODUCT_ROW, imageUrl: 'https://cdn.example.com/2.jpg' } },
      distributionConfig: { global: { paused: false, maxPerRun: 1, maxPerDay: 100 } },
    });
    const a = await seedQueuedJob(db, 'sitemap', 'p1');
    const b = await seedQueuedJob(db, 'sitemap', 'p2');
    const spy = fakeFetch([]);
    const report = await runDistributionEngine({ db, actorUid: 'admin1', fetchImpl: spy.impl });
    assert.equal(report.processed, 1, 'budget = 1');
    const statuses = await Promise.all([map2(db, a), map2(db, b)]);
    assert.equal(statuses.filter((s) => s === 'queued').length, 1, 'the other job stays queued');
  });
});

async function map2(db: Firestore, jobId: string): Promise<string> {
  const snap = await db.collection('distributionJobs').doc(jobId).get();
  return String((snap.data() ?? {}).status);
}

/* ── Stage 3/4: the honesty contract ────────────────────────────────────── */

describe('engine submission honesty (HTTP success is not publication)', () => {
  it('a local sitemap submit reaches `accepted` only — the NEXT pass verifies it', async () => {
    const { db, map } = fakeDb({ products: { p1: PRODUCT_ROW } });
    const jobId = await seedQueuedJob(db, 'sitemap');
    const spy = fakeFetch([]);

    const run1 = await runDistributionEngine({ db, actorUid: 'admin1', fetchImpl: spy.impl });
    assert.equal(run1.paused, false);
    assert.equal(run1.processed, 1, 'one action per job per run — submit only');
    let job = map('distributionJobs').get(jobId)!;
    assert.equal(job.status, 'submitted', 'accepted submissions land in submitted');
    const firstState: string = (job.confirmation as { state: string }).state;
    assert.equal(firstState, 'accepted', 'the submit itself confirms nothing');
    assert.equal(spy.calls.length, 0, 'the local destination needs no network');
    assert.equal(map('contentEvents').size, 1, 'the submitted outcome, recorded once');

    // Second pass: the verify phase reads OUR sitemap source of truth.
    const run2 = await runDistributionEngine({ db, actorUid: 'admin1', fetchImpl: spy.impl });
    assert.equal(run2.processed, 1, 'verification is its own bounded action');
    job = map('distributionJobs').get(jobId)!;
    assert.equal(job.status, 'live', 'only a verification may confirm');
    assert.equal((job.confirmation as { state: string }).state, 'published');
    assert.ok((job.confirmation as { verifiedAt?: string }).verifiedAt, 'verification timestamped');
    const submissions = job.submissions as Array<{ outcome: string }>;
    assert.equal(submissions.length, 2, 'one record per attempt, newest first');
    assert.equal(map('contentEvents').size, 2, 'submitted + confirmed, once each');

    // A third run must not churn: the job is neither queued nor submitted.
    const run3 = await runDistributionEngine({ db, actorUid: 'admin1', fetchImpl: spy.impl });
    assert.equal(run3.processed, 0, 'an already-confirmed job is invisible to both phases');
    assert.equal(map('contentEvents').size, 2, 're-running records no duplicate outcome events');
    assert.equal(map('distributionJobs').get(jobId)!.status, 'live');
    assert.equal(
      (map('distributionJobs').get(jobId)!.submissions as unknown[]).length,
      2,
      'no extra submission records',
    );
  });

  it('IndexNow 2xx ⇒ accepted, never published/indexed — and the key never leaves the server', async () => {
    const { db, map } = fakeDb({ products: { p1: PRODUCT_ROW } });
    const spy = fakeFetch([{ match: 'api.indexnow.org', status: 202 }]);

    await withEnv({ INDEXNOW_KEY: 'indexnow-secret-key-123' }, async () => {
      const jobId = await seedQueuedJob(db, 'indexnow');
      const run = await runDistributionEngine({ db, actorUid: 'admin1', fetchImpl: spy.impl });
      assert.equal(run.processed, 1);

      const job = map('distributionJobs').get(jobId)!;
      assert.equal(job.status, 'submitted');
      const confirmation = job.confirmation as { state: string };
      const state: string = confirmation.state;
      assert.equal(state, 'accepted', '202 means accepted-for-processing, nothing more');
      assert.ok(
        !['published', 'indexed'].includes(state),
        'HTTP success never becomes a verified claim',
      );

      // Request shape: canonical URL (no tracking params), protocol body.
      assert.equal(spy.calls[0].url, 'https://api.indexnow.org/indexnow');
      const body = JSON.parse(String(spy.calls[0].init?.body ?? '{}'));
      assert.deepEqual(body.urlList, ['https://vidnov.com/products/p1']);
      assert.equal(body.key, 'indexnow-secret-key-123', 'protocol carries the key in the BODY');
      assert.equal(body.host, 'vidnov.com');

      // The key must never be persisted on the job or in its submission log.
      assert.ok(!JSON.stringify(job).includes('indexnow-secret-key-123'), 'no key in the job doc');
      const submissions = job.submissions as Array<{ responseStatus?: number; outcome: string }>;
      assert.equal(submissions[0].responseStatus, 202);
      assert.equal(submissions[0].outcome, 'accepted');
    });
  });

  it('classifies remote failures: 403 auth, 429 rate-limited, 5xx transient, garbage unknown', async () => {
    const outcomes = await withEnv({ INDEXNOW_KEY: 'k' }, async () => {
      const cases: Array<[number, string, string]> = [
        [403, 'rejected', 'auth'],
        [429, 'error', 'rate_limited'],
        [503, 'error', 'transient'],
        [400, 'rejected', 'validation'],
        [418, 'unknown', 'unknown'],
      ];
      const out: Array<[string, string | undefined]> = [];
      for (const [status, expectedOutcome, expectedClass] of cases) {
        const spy = fakeFetch([{ match: 'indexnow', status }]);
        const result = await runDestinationAction('indexnow', 'submit', {
          absoluteUrl: 'https://vidnov.com/products/p1',
          publicPath: '/products/p1',
          fetchImpl: spy.impl,
        });
        assert.equal(result.outcome, expectedOutcome, `HTTP ${status} outcome`);
        assert.equal(result.errorClass, expectedClass, `HTTP ${status} class`);
        out.push([result.outcome, result.errorClass]);
      }
      return out;
    });
    assert.equal(outcomes.length, 5);
  });

  it('a transport failure (network down) is a retryable transient error', async () => {
    const result = await withEnv({ INDEXNOW_KEY: 'k' }, () =>
      runDestinationAction('indexnow', 'submit', {
        absoluteUrl: 'https://vidnov.com/products/p1',
        publicPath: '/products/p1',
        fetchImpl: fakeFetch([]).impl, // no route matches ⇒ throws
      }),
    );
    assert.equal(result.outcome, 'error');
    assert.equal(result.errorClass, 'transient');
    assert.ok(!/http|key/i.test(result.message ?? ''), 'no URL/key details in messages');
  });

  it('an auth failure burns attempts and is NOT auto-retried', async () => {
    const { db, map } = fakeDb({ products: { p1: PRODUCT_ROW } });
    const spy = fakeFetch([{ match: 'indexnow', status: 403 }]);

    const jobId = await withEnv({ INDEXNOW_KEY: 'k' }, async () => {
      const id = await seedQueuedJob(db, 'indexnow');
      await runDistributionEngine({ db, actorUid: 'admin1', fetchImpl: spy.impl });
      return id;
    });

    const job = map('distributionJobs').get(jobId)!;
    assert.equal(job.status, 'failed');
    assert.equal(job.attempts, 1);
    const lastError = job.lastError as { class: string; message: string };
    assert.equal(lastError.class, 'auth');
    assert.equal(
      canRetry({ status: 'failed', attempts: 1, lastError: lastError as never }),
      false,
      'auth failures need a config change, not a retry',
    );
    await assert.rejects(
      retryDistributionJob({ db, jobId, actor: OWNER }),
      (e: unknown) => e instanceof DistributionError && e.code === 'retry_not_allowed',
    );
    // The failed outcome is recorded exactly once, idempotently.
    assert.equal(map('contentEvents').size, 1);
  });

  it('a rate-limited failure stays auto-retryable within the attempt cap', async () => {
    const { db, map } = fakeDb({ products: { p1: PRODUCT_ROW } });
    const spy = fakeFetch([{ match: 'indexnow', status: 429 }]);
    const jobId = await withEnv({ INDEXNOW_KEY: 'k' }, async () => {
      const id = await seedQueuedJob(db, 'indexnow');
      await runDistributionEngine({ db, actorUid: 'admin1', fetchImpl: spy.impl });
      return id;
    });
    const job = map('distributionJobs').get(jobId)!;
    assert.equal(job.status, 'failed');
    const lastError = job.lastError as { class: string };
    assert.equal(lastError.class, 'rate_limited');
    assert.equal(
      canRetry({ status: 'failed', attempts: 1, lastError: lastError as never }),
      true,
    );
  });

  it('an ambiguous response records `unknown` — the engine claims nothing', async () => {
    const { db, map } = fakeDb({ products: { p1: PRODUCT_ROW } });
    const spy = fakeFetch([{ match: 'indexnow', status: 418 }]);
    const jobId = await withEnv({ INDEXNOW_KEY: 'k' }, async () => {
      const id = await seedQueuedJob(db, 'indexnow');
      await runDistributionEngine({ db, actorUid: 'admin1', fetchImpl: spy.impl });
      return id;
    });
    const job = map('distributionJobs').get(jobId)!;
    assert.equal(job.status, 'submitted', 'ambiguous submits still become trackable');
    assert.equal((job.confirmation as { state: string }).state, 'unknown');
  });

  it('quota exhaustion skips jobs WITHOUT burning attempts', async () => {
    const { db, map } = fakeDb({
      products: { p1: PRODUCT_ROW, p2: { ...PRODUCT_ROW, imageUrl: 'https://cdn.example.com/2.jpg' } },
      distributionConfig: { global: { paused: false, maxPerRun: 10, maxPerDay: 1 } },
    });
    const a = await seedQueuedJob(db, 'sitemap', 'p1');
    const b = await seedQueuedJob(db, 'sitemap', 'p2');
    const report = await runDistributionEngine({ db, actorUid: 'admin1', fetchImpl: fakeFetch([]).impl });

    assert.equal(report.byDestination.sitemap.processed, 1, 'one job per day with maxPerDay=1');
    assert.equal(
      report.byDestination.sitemap.rateLimited,
      1,
      'the second submit is refused by the spent day budget',
    );
    const statuses = [a, b].map((id) => map2(db, id));
    const settled = await Promise.all(statuses);
    assert.equal(settled.filter((s) => s === 'queued').length, 1, 'skipped job stays queued');
    assert.equal(
      Number(map('distributionJobs').get(a)?.attempts ?? 0) +
        Number(map('distributionJobs').get(b)?.attempts ?? 0),
      0,
      'rate limiting never burns an attempt',
    );
  });
});

describe('Search Console inspect (verified index state)', () => {
  const SC_ENV = {
    GOOGLE_SEARCH_CONSOLE_CLIENT_ID: 'cid',
    GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET: 'csecret',
    GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN: 'rtoken',
    GOOGLE_SEARCH_CONSOLE_SITE_URL: 'https://vidnov.com/',
  };

  it('INDEXED verdict ⇒ confirmation `indexed` and the terminal state, in one pass', async () => {
    const { db, map } = fakeDb({ products: { p1: PRODUCT_ROW } });
    const spy = fakeFetch([
      { match: 'oauth2.googleapis.com/token', status: 200, body: { access_token: 'tok' } },
      {
        match: 'urlInspection',
        status: 200,
        body: { inspectionResult: { indexStatusResult: { status: 'INDEXED' } } },
      },
    ]);

    const jobId = await withEnv(SC_ENV, async () => {
      const id = await seedQueuedJob(db, 'search_console');
      const report = await runDistributionEngine({ db, actorUid: 'admin1', fetchImpl: spy.impl });
      assert.equal(report.processed, 1);
      return id;
    });

    const job = map('distributionJobs').get(jobId)!;
    assert.equal(job.status, 'live', 'a real INDEXED verdict confirms the listing');
    assert.equal((job.confirmation as { state: string }).state, 'indexed');
    assert.ok((job.confirmation as { verifiedAt?: string }).verifiedAt);
    // The inspection actually went to the official endpoint with a bearer token.
    const inspectCall = spy.calls.find((c) => c.url.includes('urlInspection'));
    assert.ok(inspectCall, 'URL Inspection API called');
    assert.equal(
      (inspectCall!.init as unknown as { headers?: Record<string, string> } | undefined)?.headers?.Authorization,
      'Bearer tok',
    );
  });

  it('NOT indexed ⇒ honest `unknown`, and persistent ambiguity escalates to needs_attention', async () => {
    const { db, map } = fakeDb({ products: { p1: PRODUCT_ROW } });
    const spy = fakeFetch([
      { match: 'oauth2.googleapis.com/token', status: 200, body: { access_token: 'tok' } },
      {
        match: 'urlInspection',
        status: 200,
        body: { inspectionResult: { indexStatusResult: { status: 'NOT_INDEXED' } } },
      },
    ]);

    const jobId = await withEnv(SC_ENV, async () => {
      const id = await seedQueuedJob(db, 'search_console');
      await runDistributionEngine({ db, actorUid: 'admin1', fetchImpl: spy.impl });
      let job = map('distributionJobs').get(id)!;
      assert.equal(job.status, 'submitted', 'first inspection lands in submitted');
      assert.equal((job.confirmation as { state: string }).state, 'unknown', 'not indexed = unknown, not failed');

      await runDistributionEngine({ db, actorUid: 'admin1', fetchImpl: spy.impl });
      job = map('distributionJobs').get(id)!;
      assert.equal(job.verifyAttempts, 2, 'verify attempts are tracked separately from submit attempts');
      assert.equal(job.attempts ?? 0, 0, 'ambiguity never burns retry attempts');

      await runDistributionEngine({ db, actorUid: 'admin1', fetchImpl: spy.impl });
      job = map('distributionJobs').get(id)!;
      assert.equal(
        job.status,
        'needs_attention',
        'bounded escalation after MAX_JOB_ATTEMPTS verify attempts',
      );
      assert.equal(job.verifyAttempts, MAX_JOB_ATTEMPTS);
      return id;
    });
    assert.ok(jobId);
  });

  it('refuses credentials that are not configured, without any network call', async () => {
    const spy = fakeFetch([]);
    const result = await runDestinationAction('search_console', 'verify', {
      absoluteUrl: 'https://vidnov.com/products/p1',
      publicPath: '/products/p1',
      fetchImpl: spy.impl,
    });
    assert.equal(result.outcome, 'rejected');
    assert.equal(result.errorClass, 'not_configured');
    assert.equal(spy.calls.length, 0);
  });
});

describe('adapter capability guards (the registry is the law)', () => {
  it('a destination without a status API can never be asked to verify', async () => {
    for (const id of ['indexnow', 'bing'] as const) {
      const result = await withEnv({ INDEXNOW_KEY: 'k', BING_WEBMASTER_API_KEY: 'k', BING_WEBMASTER_SITE_URL: 'https://vidnov.com/' }, () =>
        runDestinationAction(id, 'verify', {
          absoluteUrl: 'https://vidnov.com/products/p1',
          publicPath: '/products/p1',
          fetchImpl: fakeFetch([]).impl,
        }),
      );
      assert.equal(result.outcome, 'rejected');
      assert.equal(result.errorClass, 'not_configured');
      assert.equal(result.confirmed, undefined, `${id} can never confirm anything`);
    }
  });

  it('search_console declares no submit path (Indexing API is not for product pages)', () => {
    assert.equal(CHANNELS.search_console.capabilities.submit, false);
    assert.equal(CHANNELS.search_console.capabilities.verify, true);
    assert.deepEqual([...CHANNELS.search_console.capabilities.confirmable].sort(), [
      'failed',
      'indexed',
      'unknown',
    ]);
    assert.equal(CHANNELS.indexnow.capabilities.confirmable.includes('indexed'), false);
    assert.equal(CHANNELS.indexnow.capabilities.confirmable.includes('published'), false);
    assert.equal(CHANNELS.sitemap.capabilities.confirmable.includes('published'), true);
    assert.equal(CHANNELS.ga.jobEligible, false, 'analytics connections take no per-listing jobs');
  });

  it('GA4 without credentials reports unconfigured and performs NO network call', async () => {
    const spy = fakeFetch([]);
    const result = await withEnv(
      { GA4_PROPERTY_ID: undefined, GA4_SERVICE_ACCOUNT_JSON: undefined },
      () => readGa4Traffic(spy.impl),
    );
    assert.equal(result.configured, false);
    assert.equal(result.totalSessions, null, 'unknown, never a fabricated zero');
    assert.equal(spy.calls.length, 0);
  });

  it('commerce feeds without credentials never leave ready — and never touch the network', async () => {
    const saved: Record<string, string | undefined> = {};
    for (const id of ['google', 'meta', 'tiktok'] as const) {
      for (const n of CHANNEL_ENV_REQUIREMENTS[id]) {
        saved[n] = process.env[n];
        delete process.env[n];
      }
    }
    try {
      for (const id of ['google', 'meta', 'tiktok'] as const) {
        // The adapters now HAVE a real submit/verify path (capabilities) …
        assert.equal(CHANNELS[id].capabilities.submit, true);
        assert.equal(CHANNELS[id].capabilities.verify, true);
        // … but without credentials everything still stops at the gate.
        assert.equal(CHANNELS[id].integrationStatus(), 'not_configured');
        assert.equal(CHANNELS[id].canSubmit(), false);
        assert.ok(!CHANNELS[id].reachableStates.includes('queued'), `${id} must not queue without credentials`);
        assert.ok(!CHANNELS[id].reachableStates.includes('submitted'), `${id} must not submit without credentials`);
        assert.ok(!CHANNELS[id].reachableStates.includes('live'), `${id} must never self-report live`);
        assert.ok(CHANNELS[id].reachableStates.includes('ready'), 'preparation without credentials is the point');
        assert.ok(CHANNELS[id].reachableStates.includes('stopped'), 'stopping is always possible');

        const spy = fakeFetch([]);
        const payload = CHANNELS[id].prepare(
          { productId: 'p1', sellerId: 's1', name: 'Gold Ring', price: 100, imageUrl: 'https://cdn.example.com/a.jpg' },
          '/products/p1',
        );
        for (const action of ['submit', 'verify'] as const) {
          const result = await runDestinationAction(id, action, {
            absoluteUrl: 'https://vidnov.com/products/p1',
            publicPath: '/products/p1',
            fetchImpl: spy.impl,
            payload,
            remoteId: 'remote-1',
          });
          assert.equal(result.outcome, 'rejected', `${id}/${action}`);
          assert.equal(result.errorClass, 'not_configured', `${id}/${action}`);
          assert.equal(spy.calls.length, 0, `${id}/${action} must not call the network without credentials`);
        }
      }
    } finally {
      for (const [n, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[n];
        else process.env[n] = v;
      }
    }
  });
});

/* ── Commerce feed adapters: real endpoints against a fake network ────────── */

describe('commerce feed adapters (Google, Meta, TikTok)', () => {
  // A real RSA key so the service-account JWT signing path actually runs.
  const SA_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 })
    .privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

  const GOOGLE_ENV = {
    GOOGLE_MERCHANT_CENTER_ID: '123',
    GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON: JSON.stringify({
      client_email: 'sa@test.iam.gserviceaccount.com',
      private_key: SA_KEY,
    }),
    GOOGLE_MERCHANT_DATA_SOURCE_ID: 'ds1',
    GOOGLE_MERCHANT_FEED_LABEL: 'KE',
    GOOGLE_MERCHANT_CONTENT_LANGUAGE: 'en',
  };
  const META_ENV = {
    META_COMMERCE_ACCESS_TOKEN: 'meta-secret-token',
    META_CATALOG_ID: 'cat1',
  };
  const TIKTOK_ENV = {
    TIKTOK_SHOP_CLIENT_KEY: 'app-key-1',
    TIKTOK_SHOP_CLIENT_SECRET: 'app-secret-1',
    TIKTOK_SHOP_ACCESS_TOKEN: 'tts-secret-token',
    TIKTOK_SHOP_SHOP_CIPHER: 'shop-cipher-1',
    TIKTOK_SHOP_CATEGORY_ID: 'leaf-cat-1',
    TIKTOK_SHOP_WAREHOUSE_ID: 'wh-1',
    TIKTOK_SHOP_PACKAGE_WEIGHT_KG: '1',
  };

  const product = {
    productId: 'p1',
    sellerId: 's1',
    name: 'Gold Ring',
    description: 'A lovely ring',
    price: 25000,
    stock: 3,
    imageUrl: 'https://cdn.example.com/ring.jpg',
    category: 'Jewellery',
  };
  const ABS = 'https://vidnov.com/products/p1';
  const PATH = '/products/p1';
  const baseParams = (fetchImpl: ReturnType<typeof fakeFetch>['impl']) => ({
    absoluteUrl: ABS,
    publicPath: PATH,
    fetchImpl,
  });

  it('google submit posts the prepared offer and never confirms it', async () => {
    const payload = CHANNELS.google.prepare(product, PATH);
    await withEnv(GOOGLE_ENV, async () => {
      const spy = fakeFetch([
        { match: 'oauth2.googleapis.com/token', status: 200, body: { access_token: 'tok' } },
        {
          match: 'merchantapi.googleapis.com',
          status: 200,
          body: { name: 'accounts/123/productInputs/en~KE~p1' },
        },
      ]);
      const result = await runDestinationAction('google', 'submit', {
        ...baseParams(spy.impl),
        payload,
      });
      assert.equal(result.outcome, 'accepted');
      assert.equal(result.confirmed, undefined, 'a submit may never confirm');
      assert.equal(result.remoteId, 'en~KE~p1');

      const api = spy.calls.find((c) => c.url.includes('merchantapi.googleapis.com'));
      assert.ok(api, 'product input was posted to the Merchant API');
      assert.ok(api.url.includes('dataSource='), 'dataSource query param is required');
      const body = JSON.parse(String(api.init?.body)) as {
        offerId: string;
        feedLabel: string;
        contentLanguage: string;
        productAttributes: Record<string, unknown>;
      };
      assert.equal(body.offerId, 'p1');
      assert.equal(body.feedLabel, 'KE');
      assert.equal(body.contentLanguage, 'en');
      const attrs = body.productAttributes;
      assert.equal(attrs.title, 'Gold Ring');
      assert.equal(attrs.link, ABS, 'canonical URL, no tracking params');
      assert.equal(attrs.availability, 'IN_STOCK');
      assert.deepEqual(attrs.price, { amountMicros: '25000000000', currencyCode: 'NGN' });
      assert.ok(String(api.init?.headers?.Authorization).startsWith('Bearer '), 'OAuth bearer sent');
      assert.ok(!JSON.stringify(result).includes('tok'), 'no token ever leaks into a result');
    });
  });

  it('google verify reads the real product status: approved / pending / disapproved', async () => {
    const payload = CHANNELS.google.prepare(product, PATH);
    await withEnv(GOOGLE_ENV, async () => {
      const token = { match: 'oauth2.googleapis.com/token', status: 200, body: { access_token: 'tok' } };

      const approved = fakeFetch([
        token,
        {
          match: 'merchantapi.googleapis.com/products/',
          status: 200,
          body: {
            productStatus: {
              destinationStatuses: [{ reportingContext: 'SHOPPING_ADS', approvedCountries: ['KE'] }],
              itemLevelIssues: [],
            },
          },
        },
      ]);
      const live = await runDestinationAction('google', 'verify', {
        ...baseParams(approved.impl),
        payload,
        remoteId: 'en~KE~p1',
      });
      assert.equal(live.outcome, 'accepted');
      assert.equal(live.confirmed, 'published', 'only a real approval may confirm');

      const pending = fakeFetch([
        token,
        {
          match: 'merchantapi.googleapis.com/products/',
          status: 200,
          body: {
            productStatus: {
              destinationStatuses: [{ reportingContext: 'SHOPPING_ADS', pendingCountries: ['KE'] }],
              itemLevelIssues: [{ severity: 'WARNING', code: 'slow_price_update' }],
            },
          },
        },
      ]);
      const review = await runDestinationAction('google', 'verify', {
        ...baseParams(pending.impl),
        payload,
        remoteId: 'en~KE~p1',
      });
      assert.equal(review.outcome, 'accepted');
      assert.equal(review.confirmed, 'unknown', 'pending review claims nothing');

      const disapproved = fakeFetch([
        token,
        {
          match: 'merchantapi.googleapis.com/products/',
          status: 200,
          body: {
            productStatus: {
              destinationStatuses: [],
              itemLevelIssues: [{ severity: 'DISAPPROVED', code: 'missing_gtin' }],
            },
          },
        },
      ]);
      const rejected = await runDestinationAction('google', 'verify', {
        ...baseParams(disapproved.impl),
        payload,
        remoteId: 'en~KE~p1',
      });
      assert.equal(rejected.outcome, 'rejected');
      assert.equal(rejected.errorClass, 'validation');
      assert.equal(rejected.confirmed, undefined);
    });
  });

  it('meta submit posts an items_batch row and records the batch handle', async () => {
    const payload = CHANNELS.meta.prepare(product, PATH);
    await withEnv(META_ENV, async () => {
      const spy = fakeFetch([
        { match: 'graph.facebook.com', status: 200, body: { handles: ['h-123'], validation_status: [] } },
      ]);
      const result = await runDestinationAction('meta', 'submit', {
        ...baseParams(spy.impl),
        payload,
      });
      assert.equal(result.outcome, 'accepted');
      assert.equal(result.confirmed, undefined, 'a submit may never confirm');
      assert.equal(result.remoteId, 'h-123', 'handle recorded for verify');

      const api = spy.calls[0];
      assert.ok(api.url.includes('/cat1/items_batch'), 'catalog batch endpoint');
      const body = JSON.parse(String(api.init?.body)) as {
        item_type: string;
        allow_upsert: boolean;
        requests: Array<{ method: string; data: Record<string, unknown> }>;
      };
      assert.equal(body.item_type, 'PRODUCT_ITEM');
      assert.equal(body.allow_upsert, true);
      assert.equal(body.requests[0].method, 'UPDATE');
      const data = body.requests[0].data;
      assert.equal(data.id, 'p1');
      assert.equal(data.link, ABS);
      assert.equal(data.image_link, 'https://cdn.example.com/ring.jpg');
      assert.equal(data.price, '25000.00 NGN');
      assert.equal(data.availability, 'in stock');
      assert.ok(String(api.init?.headers?.Authorization).startsWith('Bearer '), 'OAuth bearer sent');
    });
  });

  it('meta submit surfaces auth errors and rejected rows honestly', async () => {
    const payload = CHANNELS.meta.prepare(product, PATH);
    await withEnv(META_ENV, async () => {
      const authFail = fakeFetch([
        {
          match: 'graph.facebook.com',
          status: 400,
          body: { error: { code: 190, message: 'Invalid OAuth access token' } },
        },
      ]);
      const auth = await runDestinationAction('meta', 'submit', {
        ...baseParams(authFail.impl),
        payload,
      });
      assert.equal(auth.outcome, 'rejected');
      assert.equal(auth.errorClass, 'auth');

      const empty = fakeFetch([
        { match: 'graph.facebook.com', status: 200, body: { handles: [], validation_status: [] } },
      ]);
      const nothing = await runDestinationAction('meta', 'submit', {
        ...baseParams(empty.impl),
        payload,
      });
      assert.equal(nothing.outcome, 'unknown', 'HTTP success with nothing ingested claims nothing');
      assert.equal(nothing.confirmed, undefined);

      const rowError = fakeFetch([
        {
          match: 'graph.facebook.com',
          status: 200,
          body: {
            handles: ['h-9'],
            validation_status: [{ retailer_id: 'p1', errors: [{ message: 'image too small' }] }],
          },
        },
      ]);
      const rejected = await runDestinationAction('meta', 'submit', {
        ...baseParams(rowError.impl),
        payload,
      });
      assert.equal(rejected.outcome, 'rejected');
      assert.equal(rejected.errorClass, 'validation');
      assert.equal(rejected.message, 'image too small');
    });
  });

  it('meta verify reads the batch status: finished / processing / invalid', async () => {
    const payload = CHANNELS.meta.prepare(product, PATH);
    await withEnv(META_ENV, async () => {
      const route = (body: object) =>
        fakeFetch([{ match: 'check_batch_request_status', status: 200, body }]);

      const done = route({ handle: 'h-123', status: 'Finished', errors_total_count: 0, ids_of_invalid_requests: [] });
      const live = await runDestinationAction('meta', 'verify', {
        ...baseParams(done.impl),
        payload,
        remoteId: 'h-123',
      });
      assert.equal(live.confirmed, 'published', 'stored in the catalog = real status source');

      const running = route({ handle: 'h-123', status: 'Started' });
      const processing = await runDestinationAction('meta', 'verify', {
        ...baseParams(running.impl),
        payload,
        remoteId: 'h-123',
      });
      assert.equal(processing.outcome, 'accepted');
      assert.equal(processing.confirmed, 'unknown', 'still processing claims nothing');

      const bad = route({
        handle: 'h-123',
        status: 'Finished',
        errors_total_count: 1,
        ids_of_invalid_requests: ['p1'],
      });
      const rejected = await runDestinationAction('meta', 'verify', {
        ...baseParams(bad.impl),
        payload,
        remoteId: 'h-123',
      });
      assert.equal(rejected.outcome, 'rejected');
      assert.equal(rejected.errorClass, 'validation');
    });
  });

  it('tiktok submit uploads an image, creates the product and records its id', async () => {
    const payload = CHANNELS.tiktok.prepare(product, PATH);
    await withEnv(TIKTOK_ENV, async () => {
      const spy = fakeFetch([
        { match: 'cdn.example.com', status: 200, body: 'IMAGEBYTES' },
        { match: 'images/upload', status: 200, body: { code: 0, data: { uri: 'tos-x/img1' } } },
        { match: '/product/202309/products', status: 200, body: { code: 0, data: { product_id: 'tt-99' } } },
      ]);
      const result = await runDestinationAction('tiktok', 'submit', {
        ...baseParams(spy.impl),
        payload,
      });
      assert.equal(result.outcome, 'accepted');
      assert.equal(result.confirmed, undefined, 'a submit may never confirm');
      assert.equal(result.remoteId, 'tt-99');

      const upload = spy.calls.find((c) => c.url.includes('images/upload'));
      assert.ok(upload, 'image uploaded to TikTok first');
      assert.ok(upload.init?.body instanceof FormData, 'multipart form body');
      assert.ok(upload.url.includes('sign='), 'request is signed');
      assert.equal(upload.init?.headers?.['x-tts-access-token'], 'tts-secret-token');
      assert.ok(!upload.url.includes('tts-secret-token'), 'token never enters the URL');

      const create = spy.calls.find(
        (c) => c.url.includes('/product/202309/products') && c.init?.method === 'POST',
      );
      assert.ok(create, 'create product called');
      const body = JSON.parse(String(create.init?.body)) as {
        save_mode: string;
        category_id: string;
        main_images: Array<{ uri: string }>;
        skus: Array<{ price: { amount: string }; inventory: Array<{ quantity: number }> }>;
      };
      assert.equal(body.save_mode, 'LISTING', 'submitted for review, not a draft');
      assert.equal(body.category_id, 'leaf-cat-1');
      assert.deepEqual(body.main_images, [{ uri: 'tos-x/img1' }]);
      assert.equal(body.skus[0].price.amount, '25000.00');
      assert.equal(body.skus[0].inventory[0].quantity, 3, 'real stock, never invented');
    });
  });

  it('tiktok refuses a listing with no image before any network call', async () => {
    const payload = CHANNELS.tiktok.prepare(
      { productId: 'p1', sellerId: 's1', name: 'No Pic', price: 10 },
      PATH,
    );
    await withEnv(TIKTOK_ENV, async () => {
      const spy = fakeFetch([]);
      const result = await runDestinationAction('tiktok', 'submit', {
        ...baseParams(spy.impl),
        payload,
      });
      assert.equal(result.outcome, 'rejected');
      assert.equal(result.errorClass, 'validation');
      assert.equal(spy.calls.length, 0);
    });
  });

  it('tiktok verify reads the real audit status: approved / auditing / rejected', async () => {
    const payload = CHANNELS.tiktok.prepare(product, PATH);
    await withEnv(TIKTOK_ENV, async () => {
      const route = (body: object) =>
        fakeFetch([{ match: 'products/tt-99', status: 200, body }]);

      const live = await runDestinationAction('tiktok', 'verify', {
        ...baseParams(route({ code: 0, data: { product_status: 'ACTIVATE', audit: { status: 'APPROVED' } } }).impl),
        payload,
        remoteId: 'tt-99',
      });
      assert.equal(live.confirmed, 'published', 'approved AND active = really listed');

      const review = await runDestinationAction('tiktok', 'verify', {
        ...baseParams(route({ code: 0, data: { product_status: 'INITIAL', audit: { status: 'AUDITING' } } }).impl),
        payload,
        remoteId: 'tt-99',
      });
      assert.equal(review.outcome, 'accepted');
      assert.equal(review.confirmed, 'unknown', 'under review claims nothing');

      const rejected = await runDestinationAction('tiktok', 'verify', {
        ...baseParams(route({ code: 0, data: { product_status: 'DELETED', audit: { status: 'FAILED' } } }).impl),
        payload,
        remoteId: 'tt-99',
      });
      assert.equal(rejected.outcome, 'rejected');
      assert.equal(rejected.errorClass, 'validation');
    });
  });

  it('a feed job without its stored payload fails honestly instead of inventing data', async () => {
    await withEnv(META_ENV, async () => {
      const spy = fakeFetch([]);
      const result = await runDestinationAction('meta', 'submit', baseParams(spy.impl));
      assert.equal(result.outcome, 'rejected');
      assert.equal(result.errorClass, 'validation');
      assert.equal(spy.calls.length, 0, 'nothing is sent without listing data');
    });
  });
});

/* ── Submission log bounds ──────────────────────────────────────────────── */

describe('submission persistence is bounded and sanitized', () => {
  it('keeps at most MAX_SUBMISSION_LOG attempts, newest first', async () => {
    const full = Array.from({ length: MAX_SUBMISSION_LOG }, (_, i) => ({
      at: new Date(1700000000000 + i).toISOString(),
      attempt: i + 1,
      outcome: 'accepted' as const,
      responseStatus: 200,
    }));
    const { db, map } = fakeDb({
      products: { p1: PRODUCT_ROW },
      distributionJobs: {
        dj_job: {
          productId: 'p1',
          sellerId: 'seller1',
          channel: 'sitemap',
          status: 'submitted',
          attempts: 0,
          submissions: full,
          payload: { destinationUrl: '/products/p1?ch=sitemap' },
          payloadVersion: PAYLOAD_VERSION,
        },
      },
    });

    const result = await applySubmissionOutcome(db, 'dj_job', {
      job: {
        productId: 'p1',
        status: 'submitted',
        attempts: 0,
        submissions: full,
        payload: { destinationUrl: '/products/p1?ch=sitemap' },
      },
      phase: 'verify',
      result: {
        outcome: 'accepted',
        responseStatus: 200,
        confirmed: 'published',
        remoteId: 'https://vidnov.com/products/p1',
      },
      actorUid: 'admin1',
      destination: 'sitemap',
    });

    assert.equal(result.outcome, 'confirmed');
    const job = map('distributionJobs').get('dj_job')!;
    const submissions = job.submissions as Array<{ remoteId?: string; outcome: string }>;
    assert.equal(submissions.length, MAX_SUBMISSION_LOG, 'log hard-capped');
    assert.equal(
      submissions[0].remoteId,
      'https://vidnov.com/products/p1',
      'newest attempt first',
    );
    assert.equal(job.status, 'live');
  });
});

/* ── Dead-letter admin re-queue ─────────────────────────────────────────── */

describe('adminRequeueDistributionJob (dead-letter recovery)', () => {
  const dead = (): Row => ({
    productId: 'p1',
    sellerId: 'seller1',
    channel: 'indexnow',
    status: 'failed',
    attempts: MAX_JOB_ATTEMPTS,
    lastError: { class: 'transient', message: 'upstream timeout', attempt: 3, at: new Date().toISOString() },
    supportedActions: [],
  });

  it('admins only — a seller cannot use the dead-letter action', async () => {
    const { db } = fakeDb({ distributionJobs: { dj_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: dead() } });
    await rejects(
      () =>
        adminRequeueDistributionJob({
          db,
          jobId: 'dj_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          actor: OWNER,
        }),
      'forbidden',
    );
  });

  it('refuses jobs that are not failed, and jobs that can still use the normal retry', async () => {
    const { db } = fakeDb({
      distributionJobs: {
        dj_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: { ...dead(), status: 'ready', attempts: 0 },
        dj_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb: { ...dead(), attempts: 1 },
      },
    });
    await rejects(
      () =>
        adminRequeueDistributionJob({
          db,
          jobId: 'dj_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          actor: ADMIN,
        }),
        'invalid_transition',
    );
    const retryable = await rejects(
      () =>
        adminRequeueDistributionJob({
          db,
          jobId: 'dj_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          actor: ADMIN,
        }),
      'retry_not_allowed',
    );
    assert.match(retryable.message, /retry action/);
  });

  it('resets attempts, caps admin re-queues and audits every accepted one', async () => {
    const { db, map } = fakeDb({
      distributionJobs: { dj_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: dead() },
    });

    // An unconfigured channel refuses first (credentials must exist).
    await rejects(
      () =>
        adminRequeueDistributionJob({
          db,
          jobId: 'dj_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          actor: ADMIN,
        }),
      'not_configured',
    );

    await withEnv({ INDEXNOW_KEY: 'k' }, async () => {
      const ok = await adminRequeueDistributionJob({
        db,
        jobId: 'dj_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        actor: ADMIN,
      });
      assert.equal(ok.status, 'queued');
      const job = map('distributionJobs').get('dj_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')!;
      assert.equal(job.attempts, 0, 'attempts reset by the explicit human decision');
      assert.equal(job.adminRequeues, 1);
      assert.equal(job.lastError, null);

      // Back to failed for the next round — with a genuinely dead failure
      // state again (attempts exhausted, retryable class), exactly like the
      // real dead-letter condition.
      const asDead = (): void => {
        const row = map('distributionJobs').get('dj_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')!;
        row.status = 'failed';
        row.attempts = MAX_JOB_ATTEMPTS;
        row.lastError = { class: 'transient', message: 'boom', attempt: 3, at: new Date().toISOString() };
      };
      asDead();
      await adminRequeueDistributionJob({
        db,
        jobId: 'dj_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        actor: ADMIN,
      });
      assert.equal(
        map('distributionJobs').get('dj_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')!.adminRequeues,
        2,
      );

      // The cap holds: a third reset is refused even for an admin.
      asDead();
      await rejects(
        () =>
          adminRequeueDistributionJob({
            db,
            jobId: 'dj_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            actor: ADMIN,
          }),
        'retry_exhausted',
      );
      assert.equal(MAX_ADMIN_REQUEUES, 2, 'the bound itself');

      const audits = await listAudit(db, 10);
      assert.equal(
        audits.filter((a) => a.action === 'admin_requeue').length,
        MAX_ADMIN_REQUEUES,
        'every accepted re-queue is audited — and only accepted ones',
      );
    });
  });
});

/* ── Audit ──────────────────────────────────────────────────────────────── */

describe('audit trail (append-only, sanitized, bounded)', () => {
  it('sanitizes secrets out of details and lists newest first', async () => {
    const { db, map } = fakeDb();
    const ok = await recordAudit(db, {
      actorUid: 'admin1',
      action: 'config_updated',
      targetType: 'config',
      targetId: 'global',
      detail: 'Bearer abc.def.ghi rejected; https://host/ping?key=supersecret returned 403',
    });
    assert.equal(ok, true);
    const stored = [...map('distributionAudit').values()][0];
    const detail = String(stored.detail);
    assert.ok(!detail.includes('abc.def.ghi'), 'bearer token scrubbed');
    assert.ok(!detail.includes('supersecret'), 'query key scrubbed');

    await recordAudit(db, { actorUid: 'admin1', action: 'engine_run', targetType: 'run' });
    const entries = await listAudit(db, 10);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].action, 'engine_run', 'newest first');
    assert.equal(entries[1].action, 'config_updated');

    const bounded = await listAudit(db, 1);
    assert.equal(bounded.length, 1, 'limit honoured');
  });

  it('degrades safely when the collection is unreadable', async () => {
    const { db } = fakeDb({}, { failCollections: ['distributionAudit'] });
    assert.equal(
      await recordAudit(db, { actorUid: 'a', action: 'engine_run', targetType: 'run' }),
      false,
      'failure surfaced, never hidden',
    );
    assert.deepEqual(await listAudit(db), []);
  });
});

/* ── Destination analytics ──────────────────────────────────────────────── */

describe('destination analytics (real events only)', () => {
  it('counts qualified views, clicks and attributed orders per channel', async () => {
    const { db } = fakeDb({
      contentEvents: {
        e1: { channel: 'sitemap', type: 'view', qualified: true, self: false },
        e2: { channel: 'sitemap', type: 'view', qualified: false, self: false },
        e3: { channel: 'sitemap', type: 'view', qualified: true, self: true },
        e4: { channel: 'sitemap', type: 'click' },
        e5: { type: 'view', qualified: true, self: false },
        e6: {
          type: 'order_confirmed',
          origin: 'server',
          attribution: { channel: 'sitemap' },
        },
        e7: { type: 'order_confirmed', origin: 'server', attribution: { channel: 'google' } },
      },
    });

    const analytics = await destinationAnalytics(db);
    const sitemap = analytics.perDestination.find((d) => d.destination === 'sitemap')!;
    assert.equal(sitemap.qualifiedViews, 1, 'unqualified views and self-views excluded');
    assert.equal(sitemap.shareClicks, 1);
    assert.equal(sitemap.attributedOrders, 1, 'server-verified orders only');
    const google = analytics.perDestination.find((d) => d.destination === 'google')!;
    assert.equal(google.attributedOrders, 1);
    assert.equal(google.qualifiedViews, 0, 'no recorded visits yet — honest zero from real data');
    assert.ok(analytics.notes.some((n) => n.includes('30-day TTL')));
  });

  it('reports null (unknown) when counts cannot be read — never a fake zero', async () => {
    const { db } = fakeDb({ contentEvents: {} }, { failCount: true });
    const analytics = await destinationAnalytics(db);
    for (const row of analytics.perDestination) {
      assert.equal(row.qualifiedViews, null);
      assert.equal(row.shareClicks, null);
      assert.equal(row.attributedOrders, null);
    }
  });
});

/* ── Growth `ch` attribution ────────────────────────────────────────────── */

describe('growth channel attribution (?ch=)', () => {
  it('accepts only closed-set channel labels', () => {
    const ok = parseEventInput({
      type: 'view',
      targetKind: 'product',
      targetId: 'p1',
      ch: 'indexnow',
    });
    assert.equal(ok.ok, true);
    assert.equal((ok as { value?: { channel?: string } }).value?.channel, 'indexnow');

    const bad = parseEventInput({
      type: 'view',
      targetKind: 'product',
      targetId: 'p1',
      ch: 'evil-channel',
    });
    assert.equal(bad.ok, true, 'a bad label must NEVER reject the event');
    assert.equal((bad as { value?: { channel?: string } }).value?.channel, undefined, 'dropped');

    const nonString = parseEventInput({
      type: 'view',
      targetKind: 'product',
      targetId: 'p1',
      ch: 42,
    });
    assert.equal(nonString.ok, true);
    assert.equal((nonString as { value?: { channel?: string } }).value?.channel, undefined);
  });

  it('the channel set covers every destination and nothing else', () => {
    assert.deepEqual(
      [...CHANNEL_IDS].sort(),
      ['bing', 'ga', 'google', 'indexnow', 'meta', 'search_console', 'sitemap', 'tiktok'],
    );
  });
});

/* ── Source-level: routes, page, rules ──────────────────────────────────── */

describe('Control Center routes (source-level guarantees)', () => {
  const ROUTES = [
    'src/app/api/admin/distribution/overview/route.ts',
    'src/app/api/admin/distribution/config/route.ts',
    'src/app/api/admin/distribution/reconcile/route.ts',
    'src/app/api/admin/distribution/run/route.ts',
    'src/app/api/admin/distribution/jobs/route.ts',
    'src/app/api/admin/distribution/jobs/[id]/requeue/route.ts',
    'src/app/api/admin/distribution/audit/route.ts',
  ];

  it('every management endpoint enforces admin authorization server-side', () => {
    for (const f of ROUTES) {
      const src = read(f);
      assert.ok(src.includes('verifyAdminUid'), `${f} must verify admin identity`);
      assert.ok(!src.includes('process.env'), `${f} never reads environment values`);
      assert.ok(!/console\.error\([^'"]/.test(src), `${f} logs no error objects`);
      assert.ok(!/status:\s*'live'/.test(src), `${f} never declares a success state`);
      assert.ok(!src.includes('console.log('), `${f} must not log payloads`);
    }
  });

  it('mutating endpoints are schema-validated and audit their actions', () => {
    const config = read('src/app/api/admin/distribution/config/route.ts');
    assert.ok(config.includes('updateDistributionConfigSchema'), 'config is zod-validated');
    assert.ok(config.includes('recordAudit'), 'config changes are audited');

    const reconcile = read('src/app/api/admin/distribution/reconcile/route.ts');
    assert.ok(reconcile.includes('reconcileRequestSchema'), 'sweep bounds are validated');
    assert.ok(reconcile.includes('recordAudit'), 'sweeps are audited');

    const run = read('src/app/api/admin/distribution/run/route.ts');
    assert.ok(run.includes('runDistributionEngine'), 'runs through the bounded engine');
    assert.ok(run.includes('verifyAdminUid'), 'the run action is admin-only');

    const jobs = read('src/app/api/admin/distribution/jobs/route.ts');
    assert.ok(jobs.includes('listAdminDistributionJobsSchema'), 'queue filters are validated');
    assert.ok(jobs.includes("q.limit(limit)"), 'results are capped server-side');

    const requeue = read('src/app/api/admin/distribution/jobs/[id]/requeue/route.ts');
    assert.ok(requeue.includes('adminRequeueDistributionJob'), 'goes through the capped service');
    assert.ok(requeue.includes('distributionJobIdSchema'), 'job ids are pattern-validated');
    assert.ok(requeue.includes('retryJobSchema'), 'even the empty body is validated');

    const overview = read('src/app/api/admin/distribution/overview/route.ts');
    assert.ok(overview.includes('connectionStatuses'), 'connections section served');
    assert.ok(overview.includes('destinationAnalytics'), 'analytics section served');
    assert.ok(overview.includes('deadLetterCount'), 'dead-letter math served');
  });

  it('the engine may only claim states through the guarded transition machinery', () => {
    const engine = read('src/lib/vidnov-core/distribution/engine.ts');
    assert.ok(engine.includes('canTransition'), 'every engine status move is state-machine guarded');
    assert.ok(engine.includes('reserveQuota'), 'quota is claimed before work');
    assert.ok(engine.includes('VERIFIED_CONFIRMATION_STATES'), 'verified states are checked explicitly');
    assert.ok(engine.includes("config.paused"), 'the global pause is checked first');
    // The adapter wrapper strips `confirmed` from submits — the invariant in code.
    const adapters = read('src/lib/vidnov-core/distribution/adapters.ts');
    assert.ok(adapters.includes("action === 'submit' && result.confirmed"), 'submits can never confirm');
    assert.ok(
      adapters.includes('raw upstream text never leaves'),
      'raw upstream bodies are never stored',
    );
  });

  it('the Control Center page renders all eight sections under the admin layout', () => {
    const page = read('src/app/dashboard/admin/system/distribution/page.tsx');
    assert.ok(page.includes('AdminLayout'), 'renders inside the admin shell');
    for (const section of ['overview', 'connections', 'queues', 'publication', 'errors', 'analytics', 'settings', 'audit']) {
      assert.ok(page.includes(`value="${section}"`), `tab ${section} exists`);
    }
    assert.ok(page.includes('/api/admin/distribution/overview'), 'overview endpoint wired');
    assert.ok(page.includes('/api/admin/distribution/config'), 'config endpoint wired');
    assert.ok(page.includes('/api/admin/distribution/reconcile'), 'reconcile wired');
    assert.ok(page.includes('/api/admin/distribution/run'), 'engine run wired');
    assert.ok(page.includes('/requeue'), 'dead-letter re-queue wired');
    assert.ok(page.includes('Authorization'), 'sends the verified bearer token');
    assert.ok(page.includes('getIdToken'), 'token from the authenticated session');
    assert.ok(!page.includes('process.env'), 'no environment reads in the page');

    const sidebar = read('src/components/admin/admin-sidebar.tsx');
    assert.ok(sidebar.includes("href: 'distribution'"), 'reachable from the admin nav');
  });

  it('no Firestore rules change ships with this release', () => {
    const rules = read('firestore.rules');
    assert.equal(rules, read('src/firestore.rules'), 'both rules files stay byte-identical');
    for (const name of [
      'distributionJobs',
      'distributionConfig',
      'distributionQuotas',
      'distributionAudit',
    ]) {
      assert.ok(!rules.includes(name), `${name} stays default-deny for clients`);
    }
    // `contentEvents` keeps its EXISTING explicit deny block (Growth Phase 1).
    assert.ok(rules.includes('contentEvents'), 'growth event rules untouched');
  });

  it('the growth event route stores the validated channel label only', () => {
    const route = read('src/app/api/events/route.ts');
    assert.ok(route.includes('channel: event.channel ?? null'), 'server stores its own validation');
    assert.ok(!route.includes('json.channel'), 'no raw body passthrough');

    const client = read('src/lib/growth/client.ts');
    assert.ok(client.includes('ch: pageChannel()'), 'client sends the page channel');
    assert.equal(client.includes('sellerId'), false, 'no ownership claims from the client');
    assert.equal(client.includes('sid:'), false, 'no session nonce from the client');
    assert.equal(client.includes('viewCount:'), false, 'no counters from the client');
  });
});
