/**
 * VIDNOV CORE ENGINE — tests.
 *
 * Covers: input validation (strict schemas), distribution state machine +
 * idempotent job ids + error sanitisation/classification + retry limits,
 * channel honesty (no credentials ⇒ cannot reach submitted/live, payloads
 * carry no secrets), event idempotency and the observational/verified split,
 * opportunity/application state machines and service idempotency, ledger
 * invariants (design-only), bounded server-side search, tracked-link
 * attribution, and source-level guarantees: route authorization, no client
 * Firebase imports inside vidnov-core, and default-deny Firestore rules for
 * the new engine collections.
 *
 * Service functions are exercised against an in-memory fake Firestore — no
 * credentials, no network, no production data.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Firestore } from 'firebase-admin/firestore';

import { canTransition, MAX_JOB_ATTEMPTS } from '../lib/vidnov-core/types';
import {
  createDistributionJobSchema,
  createOpportunitySchema,
  listApplicationsSchema,
  recordEventSchema,
  reviewApplicationRequestSchema,
  searchParamsSchema,
} from '../lib/vidnov-core/validation';
import {
  canRetry,
  classifyError,
  distributionJobId,
  sanitizeErrorMessage,
} from '../lib/vidnov-core/distribution/job-utils';
import { CHANNELS, CHANNEL_ENV_REQUIREMENTS } from '../lib/vidnov-core/distribution/channels';
import {
  DistributionError,
  createDistributionJob,
  transitionDistributionJob,
} from '../lib/vidnov-core/distribution/service';
import { buildCoreEventDoc, coreEventDocId } from '../lib/vidnov-core/events/event-doc';
import { recordCoreEvent } from '../lib/vidnov-core/events/recorder';
import {
  applicationDocId,
  canTransitionApplication,
  canTransitionOpportunity,
  isWithinWindow,
} from '../lib/vidnov-core/opportunities/types';
import {
  OpportunityError,
  applyToOpportunity,
  createOpportunity,
  listApplications,
  reviewApplication,
} from '../lib/vidnov-core/opportunities/service';
import { computeBalance, isValidLedgerEntry, type LedgerEntry } from '../lib/vidnov-core/trust/ledger';
import {
  SEARCH_WINDOW,
  isAvailable,
  rankProducts,
  scoreProduct,
  searchProducts,
  searchSellers,
} from '../lib/vidnov-core/catalog/search';
import { buildTrackedUrl, parseTrackedParams } from '../lib/vidnov-core/attribution/tracking';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/* ── In-memory fake Firestore ────────────────────────────────────────────── */

type Row = Record<string, unknown>;

function fakeDb(seed: Record<string, Record<string, Row>> = {}) {
  const store: Record<string, Map<string, Row>> = {};
  for (const [name, docs] of Object.entries(seed)) {
    store[name] = new Map(Object.entries(docs));
  }
  const map = (name: string): Map<string, Row> => (store[name] ??= new Map());
  const limits: number[] = [];

  const docRef = (name: string, id: string) => ({
    async get() {
      const d = map(name).get(id);
      return { exists: d !== undefined, data: () => d };
    },
    async create(data: Row) {
      if (map(name).has(id)) throw Object.assign(new Error('already exists'), { code: 6 });
      map(name).set(id, { ...data });
    },
    async update(data: Row) {
      const cur = map(name).get(id);
      if (!cur) throw Object.assign(new Error('not found'), { code: 5 });
      map(name).set(id, { ...cur, ...data });
    },
  });

  const rows = (name: string) => Array.from(map(name), ([id, data]) => ({ id, data }));

  const collection = (name: string) => ({
    doc: (id: string) => docRef(name, id),
    where: (field: string, _op: string, value: unknown) => {
      const filtered = rows(name).filter((r) => r.data[field] === value);
      return {
        limit: (n: number) => {
          limits.push(n);
          return {
            get: async () => ({ docs: filtered.slice(0, n).map((r) => ({ id: r.id, data: () => r.data })) }),
            count: () => ({ get: async () => ({ data: () => ({ count: filtered.length }) }) }),
          };
        },
      };
    },
    orderBy: (field: string) => {
      const sorted = rows(name).sort(
        (a, b) => String((b.data[field] as number | string) ?? '').localeCompare(String((a.data[field] as number | string) ?? '')),
      );
      return {
        limit: (n: number) => {
          limits.push(n);
          return { get: async () => ({ docs: sorted.slice(0, n).map((r) => ({ id: r.id, data: () => r.data })) }) };
        },
      };
    },
    add: async (data: Row) => {
      const id = `auto_${map(name).size + 1}_${Math.random().toString(36).slice(2, 8)}`;
      map(name).set(id, { ...data });
      return { id };
    },
  });

  // Serialise transactions the way Firestore resolves write conflicts: a
  // transaction that starts while another is in flight sees the committed
  // state the first one left behind (Firestore would retry and re-read).
  // Without this the fake would happily let two conflicting reviews both win,
  // and the concurrency test would only be testing the fake.
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

  return { db: db as unknown as Firestore, store, limits };
}

/* ── Validation ──────────────────────────────────────────────────────────── */

describe('vidnov-core validation', () => {
  it('distribution create schema is strict — smuggled seller/counter fields are rejected', () => {
    assert.equal(createDistributionJobSchema.safeParse({ productId: 'p1', channel: 'google', sellerId: 'evil' }).success, false);
    assert.equal(createDistributionJobSchema.safeParse({ productId: 'p1', channel: 'google', viewCount: 9999 }).success, false);
    assert.equal(createDistributionJobSchema.safeParse({ productId: 'p1', channel: 'meta' }).success, true);
    assert.equal(createDistributionJobSchema.safeParse({ productId: 'a/b', channel: 'meta' }).success, false, 'paths must not be ids');
  });

  it('event schema cannot carry counters, prices or server-set origin', () => {
    const base = { type: 'product_viewed', entityKind: 'product', entityId: 'p1' };
    assert.equal(recordEventSchema.safeParse({ ...base, origin: 'server' }).success, false, 'origin is server-set only');
    assert.equal(recordEventSchema.safeParse({ ...base, viewCount: 5 }).success, false);
    assert.equal(recordEventSchema.safeParse({ ...base, price: 100 }).success, false);
    assert.equal(recordEventSchema.safeParse({ ...base, sellerId: 'x' }).success, false);
    assert.equal(recordEventSchema.safeParse({ ...base, dedupeKey: 'approve:abc-123' }).success, true);
  });

  it('money is integer minor units with an explicit currency, and dates must be ordered', () => {
    const base = {
      title: 'Test task',
      description: 'A real description of the task.',
      budget: { amountMinor: 50000, currency: 'NGN' },
      startsAt: '2026-11-01T00:00:00Z',
      endsAt: '2026-12-01T00:00:00Z',
      completionCriteria: 'Deliver the report.',
    };
    assert.equal(createOpportunitySchema.safeParse(base).success, true);
    assert.equal(createOpportunitySchema.safeParse({ ...base, budget: { amountMinor: 10.5, currency: 'NGN' } }).success, false, 'no floats');
    assert.equal(createOpportunitySchema.safeParse({ ...base, budget: { amountMinor: -1, currency: 'NGN' } }).success, false, 'no negative');
    assert.equal(createOpportunitySchema.safeParse({ ...base, budget: { amountMinor: 100, currency: 'ngn' } }).success, false, 'currency format');
    assert.equal(createOpportunitySchema.safeParse({ ...base, endsAt: '2026-10-01T00:00:00Z' }).success, false, 'ordered dates');
    assert.equal(createOpportunitySchema.safeParse({ ...base, payoutAddress: 'somewhere' }).success, false, 'strict shape');
  });

  it('search params are bounded', () => {
    assert.equal(searchParamsSchema.safeParse({ q: 'rings', limit: 500 }).success, false, 'limit capped at 50');
    assert.equal(searchParamsSchema.safeParse({ q: 'x'.repeat(201) }).success, false, 'q capped at 200');
    const ok = searchParamsSchema.safeParse({ q: 'gold ring', limit: 12 });
    assert.equal(ok.success, true);
    assert.equal(ok.success && ok.data.limit, 12);
  });
});

/* ── Distribution: pure helpers ──────────────────────────────────────────── */

describe('distribution job helpers', () => {
  it('job ids are deterministic (double-click cannot create two jobs)', () => {
    const a = distributionJobId({ productId: 'p1', channel: 'google' });
    const b = distributionJobId({ productId: 'p1', channel: 'google' });
    const c = distributionJobId({ productId: 'p1', channel: 'meta' });
    const d = distributionJobId({ productId: 'p2', channel: 'google' });
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.notEqual(a, d);
    const k1 = distributionJobId({ productId: 'p1', channel: 'google', idempotencyKey: 'retry-key-1' });
    const k2 = distributionJobId({ productId: 'p2', channel: 'meta', idempotencyKey: 'retry-key-1' });
    assert.equal(k1, k2, 'explicit idempotency key is the sole identity for retries');
  });

  it('error messages are scrubbed of tokens, secrets, emails and bounded', () => {
    const raw =
      'fetch failed Bearer eyJhbGciOi.payload123 url https://api.x.com?access_token=SECRETVALUE mail me@secret.com ' +
      'x'.repeat(400);
    const safe = sanitizeErrorMessage(raw);
    assert.ok(!safe.includes('payload123'), 'bearer redacted');
    assert.ok(!safe.includes('SECRETVALUE'), 'query secret redacted');
    assert.ok(!safe.includes('me@secret.com'), 'email redacted');
    assert.ok(safe.length <= 200, 'bounded');
    assert.ok(!safe.includes('\n'), 'single line');
    assert.equal(classifyError(new Error('429 too many requests')), 'rate_limited');
    assert.equal(classifyError(new Error('401 unauthorized')), 'auth');
    assert.equal(classifyError(new Error('socket timeout')), 'transient');
    assert.equal(classifyError(new Error('missing field name')), 'validation');
    assert.equal(classifyError(new Error('')), 'unknown');
  });

  it('retry is capped and only allowed for retryable failure classes', () => {
    assert.equal(canRetry({ status: 'failed', attempts: 1, lastError: { class: 'transient', message: 'x', attempt: 1, at: '' } }), true);
    assert.equal(canRetry({ status: 'failed', attempts: 1, lastError: { class: 'rate_limited', message: 'x', attempt: 1, at: '' } }), true);
    assert.equal(canRetry({ status: 'failed', attempts: 1, lastError: { class: 'auth', message: 'x', attempt: 1, at: '' } }), false);
    assert.equal(canRetry({ status: 'failed', attempts: 1, lastError: { class: 'validation', message: 'x', attempt: 1, at: '' } }), false);
    assert.equal(canRetry({ status: 'failed', attempts: MAX_JOB_ATTEMPTS, lastError: null }), false, 'attempt cap');
    assert.equal(canRetry({ status: 'ready', attempts: 0, lastError: null }), false, 'only failed jobs retry');
  });

  it('state machine forbids skipping to live and re-entering terminal states freely', () => {
    assert.equal(canTransition('ready', 'queued'), true);
    assert.equal(canTransition('queued', 'processing'), true);
    assert.equal(canTransition('ready', 'live'), false, 'cannot skip');
    assert.equal(canTransition('not_configured', 'live'), false);
    assert.equal(canTransition('live', 'queued'), true, 'explicit re-queue is allowed');
    assert.equal(canTransition('cancelled' as never, 'open' as never), false, 'unknown state is not a transition');
  });
});

/* ── Distribution: channels honesty ──────────────────────────────────────── */

describe('distribution channels (prepare-only honesty)', () => {
  it('without credentials a channel cannot leave ready/reach live', () => {
    const saved: Record<string, string | undefined> = {};
    for (const names of Object.values(CHANNEL_ENV_REQUIREMENTS)) {
      for (const n of names) {
        saved[n] = process.env[n];
        delete process.env[n];
      }
    }
    try {
      for (const id of ['google', 'meta', 'tiktok'] as const) {
        const c = CHANNELS[id];
        assert.equal(c.integrationStatus(), 'not_configured');
        assert.equal(c.canSubmit(), false);
        assert.ok(!c.reachableStates.includes('queued'), `${id} must not queue without credentials`);
        assert.ok(!c.reachableStates.includes('submitted'), `${id} must not submit without credentials`);
        assert.ok(!c.reachableStates.includes('live'), `${id} must never self-report live`);
        assert.ok(c.reachableStates.includes('ready'), 'preparation without credentials is the point');
      }
    } finally {
      for (const [n, v] of Object.entries(saved)) {
        if (v !== undefined) process.env[n] = v;
      }
    }
  });

  it('prepared payloads contain listing data only — never credentials', () => {
    const payload = CHANNELS.google.prepare(
      {
        productId: 'p1',
        sellerId: 's1',
        name: 'Gold Ring',
        description: 'A lovely ring',
        price: 25000,
        stock: 3,
        imageUrl: 'https://cdn.example.com/a.jpg',
        category: 'Jewellery',
      },
      '/products/p1?ch=google',
    );
    const json = JSON.stringify(payload);
    assert.ok(!/token|secret|password|authorization|bearer/i.test(json), 'no credential-ish keys in payloads');
    assert.equal(payload.product.id, 'p1');
    assert.equal(payload.product.availability, 'in_stock');
    assert.equal(payload.destinationUrl, '/products/p1?ch=google');
    assert.equal(payload.payloadVersion, 'v1');
  });

  it('availability mapping honours stock and service states', () => {
    const base = { productId: 'p', sellerId: 's', name: 'N', price: 1 };
    assert.equal(CHANNELS.meta.prepare({ ...base, stock: 0 }, '/x').product.availability, 'out_of_stock');
    assert.equal(CHANNELS.meta.prepare({ ...base, stock: 5 }, '/x').product.availability, 'in_stock');
    assert.equal(CHANNELS.meta.prepare({ ...base, stock: 5, availabilityState: 'on_request' }, '/x').product.availability, 'on_request');
    assert.equal(CHANNELS.meta.prepare({ ...base, stock: 0, availabilityState: 'out_of_stock' }, '/x').product.availability, 'out_of_stock');
  });
});

/* ── Distribution: service against fake Firestore ────────────────────────── */

describe('distribution service', () => {
  const product = { sellerId: 'seller1', name: 'Gold Ring', price: 25000, stock: 2, category: 'Jewellery' };

  it('creates jobs idempotently and enforces ownership from the verified caller', async () => {
    const { db, store } = fakeDb({ products: { p1: product, bad: { sellerId: 'seller1', price: 10 } } });

    const first = await createDistributionJob({ db, productId: 'p1', channel: 'google', actorUid: 'seller1', isAdmin: false });
    assert.equal(first.duplicate, false);
    assert.equal(first.status, 'ready');
    assert.equal(first.integrationStatus, 'not_configured');
    assert.deepEqual(first.supportedActions, [], 'no queue action without credentials');

    const second = await createDistributionJob({ db, productId: 'p1', channel: 'google', actorUid: 'seller1', isAdmin: false });
    assert.equal(second.duplicate, true, 'duplicate create resolves to the same document');
    assert.equal(second.jobId, first.jobId);
    assert.equal(store.distributionJobs?.size, 1, 'exactly one job document');

    await assert.rejects(
      createDistributionJob({ db, productId: 'p1', channel: 'google', actorUid: 'someone-else', isAdmin: false }),
      (e: unknown) => e instanceof DistributionError && e.code === 'forbidden',
      'ownership is checked server-side',
    );
    const asAdmin = await createDistributionJob({ db, productId: 'p1', channel: 'meta', actorUid: 'admin1', isAdmin: true });
    assert.equal(asAdmin.duplicate, false, 'admins may prepare on behalf of sellers');

    await assert.rejects(
      createDistributionJob({ db, productId: 'nope', channel: 'google', actorUid: 'seller1', isAdmin: false }),
      (e: unknown) => e instanceof DistributionError && e.code === 'not_found',
    );
    await assert.rejects(
      createDistributionJob({ db, productId: 'bad', channel: 'google', actorUid: 'seller1', isAdmin: false }),
      (e: unknown) => e instanceof DistributionError && e.code === 'invalid_product',
    );
  });

  it('transitions validate state, bound attempts and sanitize stored errors', async () => {
    const { db, store } = fakeDb({
      products: { p1: product },
      distributionJobs: {
        j1: { status: 'ready', attempts: 0, productId: 'p1', channel: 'google' },
        j2: { status: 'ready', attempts: 0 },
        j3: { status: 'queued', attempts: MAX_JOB_ATTEMPTS },
        j4: { status: 'queued', attempts: 1 },
      },
    });

    assert.equal(await transitionDistributionJob({ db, jobId: 'j1', to: 'queued' }), 'queued');
    assert.equal(await transitionDistributionJob({ db, jobId: 'j1', to: 'queued' }), 'queued', 'idempotent re-assert');

    await assert.rejects(
      transitionDistributionJob({ db, jobId: 'j2', to: 'live' }),
      (e: unknown) => e instanceof DistributionError && e.code === 'invalid_transition',
      'cannot skip straight to live',
    );
    await assert.rejects(
      transitionDistributionJob({ db, jobId: 'missing', to: 'queued' }),
      (e: unknown) => e instanceof DistributionError && e.code === 'not_found',
    );
    await assert.rejects(
      transitionDistributionJob({ db, jobId: 'j3', to: 'failed', error: new Error('boom') }),
      (e: unknown) => e instanceof DistributionError && e.code === 'retry_exhausted',
      'attempt cap enforced',
    );

    const failed = await transitionDistributionJob({
      db,
      jobId: 'j4',
      to: 'failed',
      error: new Error('upstream 429 rate limited Bearer super.secret.token'),
    });
    assert.equal(failed, 'failed');
    const j4 = store.distributionJobs!.get('j4')!;
    assert.equal(j4.attempts, 2);
    const err = j4.lastError as { class: string; message: string };
    assert.equal(err.class, 'rate_limited');
    assert.ok(!err.message.includes('super.secret.token'), 'stored errors never keep tokens');
  });
});

/* ── Events ──────────────────────────────────────────────────────────────── */

describe('core events', () => {
  it('idempotent ids: same key ⇒ same doc; different day ⇒ different doc', () => {
    const input = {
      type: 'opportunity_task_approved' as const,
      entityKind: 'application' as const,
      entityId: 'app1',
      origin: 'server' as const,
      dedupeKey: 'opp-approve:app1',
    };
    const d1 = coreEventDocId(input, new Date('2026-10-26T10:00:00Z'));
    const d2 = coreEventDocId(input, new Date('2026-10-26T23:59:00Z'));
    const d3 = coreEventDocId(input, new Date('2026-10-27T00:01:00Z'));
    assert.ok(d1);
    assert.equal(d1, d2, 'stable within the day bucket');
    assert.notEqual(d1, d3, 'unlinkable across days');
    assert.equal(coreEventDocId({ ...input, dedupeKey: undefined }), null, 'no key ⇒ append freely');
    assert.notEqual(coreEventDocId({ ...input, dedupeKey: 'other-key-999' }), d1);
  });

  it('docs carry origin, retention TTL and cannot smuggle counters', () => {
    const now = new Date('2026-10-26T00:00:00Z');
    const doc = buildCoreEventDoc(
      { type: 'distribution_job_succeeded', entityKind: 'distribution_job', entityId: 'dj_1', origin: 'server' },
      now,
    );
    assert.equal(doc.origin, 'server');
    assert.equal(doc.engine, 'core');
    const expires = doc.expiresAt as Date;
    const days = (expires.getTime() - now.getTime()) / 86_400_000;
    assert.ok(days > 29 && days <= 30, `30-day TTL, got ${days}`);
    assert.ok(!('viewCount' in doc) && !('price' in doc));
  });

  it('recorder is idempotent for keyed events and appends unkeyed ones', async () => {
    const { db, store } = fakeDb();
    const input = {
      type: 'distribution_job_succeeded' as const,
      entityKind: 'distribution_job' as const,
      entityId: 'dj_9',
      origin: 'server' as const,
      dedupeKey: 'job:dj_9:succeeded',
    };
    const first = await recordCoreEvent(db, input);
    const second = await recordCoreEvent(db, input);
    assert.equal(first.recorded, true);
    assert.equal(second.recorded, false, 'duplicate is a no-op, not an error');
    assert.equal(store.contentEvents?.size, 1, 'exactly one outcome event');

    const a = await recordCoreEvent(db, { ...input, dedupeKey: undefined });
    const b = await recordCoreEvent(db, { ...input, dedupeKey: undefined });
    assert.notEqual(a.id, b.id, 'unkeyed occurrences count individually');
    assert.equal(store.contentEvents?.size, 3);
  });
});

/* ── Opportunities ───────────────────────────────────────────────────────── */

describe('opportunity engine', () => {
  it('state machines are explicit in both directions', () => {
    assert.equal(canTransitionOpportunity('draft', 'open'), true);
    assert.equal(canTransitionOpportunity('draft', 'closed'), false, 'drafts cannot close directly');
    assert.equal(canTransitionOpportunity('cancelled', 'open'), false, 'cancelled is terminal');
    assert.equal(canTransitionOpportunity('open', 'closed'), true);

    assert.equal(canTransitionApplication('submitted', 'approved'), true);
    assert.equal(canTransitionApplication('approved', 'rejected'), false, 'approvals are final');
    assert.equal(canTransitionApplication('withdrawn', 'approved'), false);
    assert.equal(canTransitionApplication('rejected', 'under_review'), false);
  });

  it('application ids are deterministic and sanitised', () => {
    assert.equal(applicationDocId('opp-1', 'uid-2'), applicationDocId('opp-1', 'uid-2'));
    assert.notEqual(applicationDocId('opp-1', 'uid-2'), applicationDocId('opp-2', 'uid-2'));
    assert.ok(!applicationDocId('ab/cd', 'u/id').includes('/'), 'ids never contain path characters');
  });

  it('window checks use server time inclusively', () => {
    const now = new Date('2026-10-26T12:00:00Z');
    assert.equal(isWithinWindow('2026-10-26T00:00:00Z', '2026-10-27T00:00:00Z', now), true);
    assert.equal(isWithinWindow('2026-10-26T12:00:00Z', '2026-10-26T12:00:00Z', now), true);
    assert.equal(isWithinWindow('2026-10-20T00:00:00Z', '2026-10-25T00:00:00Z', now), false);
    assert.equal(isWithinWindow('garbage', 'also garbage', now), false);
  });

  it('create stores budget exactly as validated, with the verified funder uid', async () => {
    const { db, store } = fakeDb();
    const input = {
      title: 'Review seller catalogs',
      description: 'Check fifty seller catalogs for missing photos.',
      budget: { amountMinor: 250_000, currency: 'NGN' },
      startsAt: '2026-11-01T00:00:00Z',
      endsAt: '2026-11-30T00:00:00Z',
      completionCriteria: 'All fifty catalogs reviewed.',
      state: 'open' as const,
    };
    const created = await createOpportunity(db, input, 'funder-uid');
    assert.equal(created.state, 'open');
    const doc = store.opportunities!.get(created.id)!;
    assert.deepEqual(doc.budget, { amountMinor: 250_000, currency: 'NGN' });
    assert.equal(doc.funderUid, 'funder-uid');
  });

  it('applying is idempotent and honours opportunity state and window', async () => {
    const { db, store } = fakeDb({
      opportunities: {
        open1: { state: 'open', endsAt: '2099-01-01T00:00:00Z' },
        closed1: { state: 'closed', endsAt: '2099-01-01T00:00:00Z' },
        expired1: { state: 'open', endsAt: '2020-01-01T00:00:00Z' },
      },
    });

    const first = await applyToOpportunity({ db, opportunityId: 'open1', applicantUid: 'u1', note: 'pick me' });
    assert.equal(first.state, 'submitted');
    assert.equal(first.alreadyApplied, false);

    const dup = await applyToOpportunity({ db, opportunityId: 'open1', applicantUid: 'u1' });
    assert.equal(dup.alreadyApplied, true, 'double-tap yields one application');
    assert.equal(dup.applicationId, first.applicationId);
    assert.equal(store.opportunityApplications?.size, 1);

    const other = await applyToOpportunity({ db, opportunityId: 'open1', applicantUid: 'u2' });
    assert.equal(other.alreadyApplied, false, 'a different applicant is a new application');

    await assert.rejects(
      applyToOpportunity({ db, opportunityId: 'closed1', applicantUid: 'u3' }),
      (e: unknown) => e instanceof OpportunityError && e.code === 'invalid_state',
    );
    await assert.rejects(
      applyToOpportunity({ db, opportunityId: 'expired1', applicantUid: 'u3' }),
      (e: unknown) => e instanceof OpportunityError && e.code === 'window_closed',
    );
    await assert.rejects(
      applyToOpportunity({ db, opportunityId: 'missing', applicantUid: 'u3' }),
      (e: unknown) => e instanceof OpportunityError && e.code === 'not_found',
    );
  });

  it('approval transitions state AND records one verified, idempotent outcome event — no money moves', async () => {
    const { db, store } = fakeDb({
      opportunities: { opp1: { state: 'open', endsAt: '2099-01-01T00:00:00Z' } },
      opportunityApplications: { opp1__u1: { opportunityId: 'opp1', applicantUid: 'u1', state: 'submitted' } },
    });

    const approved = await reviewApplication({ db, applicationId: 'opp1__u1', decision: 'approved', reviewerUid: 'admin1' });
    assert.equal(approved.state, 'approved');
    const appDoc = store.opportunityApplications!.get('opp1__u1')!;
    assert.equal(appDoc.reviewedBy, 'admin1');
    assert.equal(appDoc.state, 'approved');

    assert.equal(store.contentEvents?.size, 1, 'exactly one verified event');
    const event = Array.from(store.contentEvents!.values())[0] as { type: string; origin: string };
    assert.equal(event.type, 'opportunity_task_approved');
    assert.equal(event.origin, 'server');

    // Re-approving is a no-op for both state and events.
    const again = await reviewApplication({ db, applicationId: 'opp1__u1', decision: 'approved', reviewerUid: 'admin1' });
    assert.equal(again.state, 'approved');
    assert.equal(store.contentEvents?.size, 1, 'no duplicate outcome event');
    // No ledger collection was ever touched.
    assert.equal(store.ledger, undefined);
    assert.equal(store.wallets, undefined);

    await assert.rejects(
      reviewApplication({ db, applicationId: 'missing__u2', decision: 'approved', reviewerUid: 'admin1' }),
      (e: unknown) => e instanceof OpportunityError && e.code === 'not_found',
    );
  });
});

/* ── Ledger (design-only) ────────────────────────────────────────────────── */

/* ── Admin application review ───────────────────────────────────────────── */

describe('admin application review', () => {
  it('the review request schema is strict — no reviewer, state or money fields', () => {
    assert.equal(
      reviewApplicationRequestSchema.safeParse({
        applicationId: 'opp1__u1',
        decision: 'approved',
        reviewedBy: 'attacker',
      }).success,
      false,
      'the reviewer cannot be supplied by the caller',
    );
    assert.equal(
      reviewApplicationRequestSchema.safeParse({ applicationId: 'opp1__u1', decision: 'approved', state: 'approved' })
        .success,
      false,
      'a raw state field is not a decision',
    );
    assert.equal(
      reviewApplicationRequestSchema.safeParse({ applicationId: 'opp1__u1', decision: 'approved', amountMinor: 10 })
        .success,
      false,
      'a review can never carry an amount',
    );
    assert.equal(reviewApplicationRequestSchema.safeParse({ applicationId: 'a/b', decision: 'approved' }).success, false);
    assert.equal(reviewApplicationRequestSchema.safeParse({ applicationId: 'opp1__u1', decision: 'maybe' }).success, false);
    assert.equal(
      reviewApplicationRequestSchema.safeParse({ applicationId: 'opp1__u1', decision: 'rejected', reason: 'no photos' })
        .success,
      true,
    );

    assert.equal(listApplicationsSchema.safeParse({ limit: '51' }).success, false, 'admin list limit is capped');
    assert.equal(listApplicationsSchema.safeParse({ limit: '5' }).success, true);
    assert.equal(listApplicationsSchema.safeParse({ state: 'bogus' }).success, false);
  });

  it('the review route is admin-only, uses the verified identity and audits every decision', () => {
    const route = read('src/app/api/admin/opportunities/route.ts');
    assert.ok(route.includes('verifyAdminUid'), 'both handlers require the verified admin identity');
    assert.ok(route.includes('reviewApplicationRequestSchema'), 'the decision is schema-validated');
    assert.ok(route.includes('listApplicationsSchema'), 'the list query is schema-validated');
    assert.ok(route.includes('reviewerUid: adminUid'), 'reviewer is the verified identity, never a body field');
    assert.ok(route.includes('logSecurityEvent'), 'every review is written to the audit trail');
    assert.ok(!route.includes('process.env'), 'no environment values in the route');
    assert.ok(!/wallet|payout|ledger/i.test(route.replace(/\/\*[\s\S]*?\*\//g, '')), 'no money surface on this route');

    const status = read('src/app/api/admin/core-engine/status/route.ts');
    assert.ok(status.includes('verifyAdminUid'), 'status stays admin-only');
    assert.ok(status.includes('.catch(() => [])'), 'a failing section degrades instead of failing the view');
  });

  it('applies are refused before the window opens, not only after it closes', async () => {
    const { db } = fakeDb({
      opportunities: {
        notYet: { state: 'open', startsAt: '2099-01-01T00:00:00Z', endsAt: '2099-06-01T00:00:00Z' },
      },
    });
    await assert.rejects(
      applyToOpportunity({ db, opportunityId: 'notYet', applicantUid: 'u1' }),
      (e: unknown) => e instanceof OpportunityError && e.code === 'window_closed' && /not opened/.test(e.message),
    );
  });

  it('duplicate reviews are idempotent and conflicting concurrent reviews cannot both win', async () => {
    const { db, store } = fakeDb({
      opportunities: { opp1: { state: 'open', endsAt: '2099-01-01T00:00:00Z' } },
      opportunityApplications: {
        opp1__u1: { opportunityId: 'opp1', applicantUid: 'u1', state: 'submitted' },
        opp1__u2: { opportunityId: 'opp1', applicantUid: 'u2', state: 'submitted' },
        opp1__u3: { opportunityId: 'opp1', applicantUid: 'u3', state: 'submitted' },
      },
    });

    // Same decision twice → one transition, one event, `changed:false` after.
    const first = await reviewApplication({
      db,
      applicationId: 'opp1__u1',
      decision: 'approved',
      reviewerUid: 'admin1',
    });
    assert.equal(first.changed, true);
    assert.equal(first.eventRecorded, true);
    const dup = await reviewApplication({
      db,
      applicationId: 'opp1__u1',
      decision: 'approved',
      reviewerUid: 'admin1',
    });
    assert.equal(dup.changed, false, 'a repeated approval is a no-op');
    assert.equal(store.contentEvents?.size, 1, 'still exactly one outcome event');
    assert.equal(dup.eventRecorded, true, 'a no-op does not try to record again');

    // Two conflicting reviews of the same application, in flight together.
    const eventsBeforeRace = store.contentEvents?.size ?? 0;
    const [approve, reject] = await Promise.allSettled([
      reviewApplication({ db, applicationId: 'opp1__u2', decision: 'approved', reviewerUid: 'admin1' }),
      reviewApplication({ db, applicationId: 'opp1__u2', decision: 'rejected', reviewerUid: 'admin2' }),
    ]);
    const winners = [approve, reject].filter((r) => r.status === 'fulfilled');
    assert.equal(winners.length, 1, 'exactly one conflicting review may commit');
    const finalState = store.opportunityApplications!.get('opp1__u2')!.state as string;
    assert.ok(finalState === 'approved' || finalState === 'rejected');
    assert.equal(
      (store.contentEvents?.size ?? 0) - eventsBeforeRace,
      finalState === 'approved' ? 1 : 0,
      'the race produces at most one outcome event, and only for an approval',
    );

    // Terminal states never move again — in either direction.
    await assert.rejects(
      reviewApplication({
        db,
        applicationId: 'opp1__u2',
        decision: finalState === 'approved' ? 'rejected' : 'approved',
        reviewerUid: 'admin1',
      }),
      (e: unknown) => e instanceof OpportunityError && e.code === 'invalid_transition',
    );
    await reviewApplication({ db, applicationId: 'opp1__u3', decision: 'rejected', reviewerUid: 'admin1' });
    await assert.rejects(
      reviewApplication({ db, applicationId: 'opp1__u3', decision: 'approved', reviewerUid: 'admin1' }),
      (e: unknown) => e instanceof OpportunityError && e.code === 'invalid_transition',
    );
    await assert.rejects(
      reviewApplication({ db, applicationId: 'opp1__missing', decision: 'approved', reviewerUid: 'admin1' }),
      (e: unknown) => e instanceof OpportunityError && e.code === 'not_found',
    );
  });

  it('an admin list is bounded and only ever returns the requested states', async () => {
    const { db, store } = fakeDb({
      opportunityApplications: {
        a1: { state: 'submitted', applicantUid: 'u1' },
        a2: { state: 'submitted', applicantUid: 'u2' },
        a3: { state: 'approved', applicantUid: 'u3' },
        a4: { state: 'withdrawn', applicantUid: 'u4' },
      },
    });

    const queue = await listApplications({ db, states: ['submitted'], limit: 50 });
    assert.equal(queue.length, 2);
    assert.ok(queue.every((a) => a.state === 'submitted'));

    const capped = await listApplications({ db, states: ['submitted', 'approved', 'withdrawn'], limit: 1 });
    assert.ok(capped.length <= 1, 'the limit bounds the merged result too');

    const all = await listApplications({
      db,
      states: ['submitted', 'approved', 'rejected', 'under_review', 'withdrawn'],
      limit: 50,
    });
    assert.equal(all.length, store.opportunityApplications!.size);
    assert.ok(all.every((a) => a.id && a.state), 'every row carries its id and state');
  });
});

describe('value ledger (design-only invariants)', () => {
  const entry = (over: Partial<LedgerEntry> = {}): unknown => ({
    idempotencyKey: 'key-12345',
    type: 'reward_approved',
    amountMinor: 100_000,
    currency: 'NGN',
    from: { kind: 'funder', id: 'f1' },
    to: { kind: 'earner', id: 'e1' },
    refKind: 'application',
    refId: 'a1',
    createdAt: new Date(),
    ...over,
  });

  it('rejects floats, negatives, self-transfers and unknown keys', () => {
    assert.equal(isValidLedgerEntry(entry()).ok, true);
    assert.equal(isValidLedgerEntry(entry({ amountMinor: 10.5 as never })).ok, false, 'minor units are integers');
    assert.equal(isValidLedgerEntry(entry({ amountMinor: -100 as never })).ok, false);
    assert.equal(isValidLedgerEntry(entry({ to: { kind: 'funder', id: 'f1' } })).ok, false, 'no self-transfer');
    assert.equal(isValidLedgerEntry(entry({ currency: 'ngn' as never })).ok, false);
    assert.equal(isValidLedgerEntry(entry({ balance: 999 } as never)).ok, false, 'no client balance field');
  });

  it('balances are computed from entries and never mix currencies', () => {
    const funded = isValidLedgerEntry(entry({ type: 'funding_hold', amountMinor: 500_000 }));
    const reward = isValidLedgerEntry(entry({ idempotencyKey: 'key-99999', amountMinor: 100_000 }));
    const fee = isValidLedgerEntry(
      entry({ idempotencyKey: 'key-77777', type: 'fee', amountMinor: 10_000, from: { kind: 'earner', id: 'e1' }, to: { kind: 'platform', id: 'vidnov' } }),
    );
    const usd = isValidLedgerEntry(entry({ idempotencyKey: 'key-55555', currency: 'USD' }));
    if (!funded.ok || !reward.ok || !fee.ok || !usd.ok) throw new Error('fixture entries must validate');
    const entries = [funded.value, reward.value, fee.value, usd.value];
    // earner: +500_000 funding +100_000 reward −10_000 fee; funder: −600_000.
    assert.equal(computeBalance(entries, { kind: 'earner', id: 'e1' }, 'NGN'), 500_000 + 100_000 - 10_000, 'NGN sum ignores the USD entry');
    assert.equal(computeBalance(entries, { kind: 'funder', id: 'f1' }, 'NGN'), -600_000);
    assert.equal(computeBalance(entries, { kind: 'earner', id: 'e1' }, 'USD'), 100_000, 'the USD entry exists only in USD');
    assert.equal(computeBalance(entries, { kind: 'platform', id: 'vidnov' }, 'USD'), 0, 'currencies never mix');
  });
});

/* ── Search ──────────────────────────────────────────────────────────────── */

describe('server-side search', () => {
  it('token matching is AND with field weighting and no regex ever built from input', () => {
    const p = { id: 'p1', name: 'Gold Wedding Ring', category: 'Jewellery', description: 'A ring made of gold', tags: 'gold ring wedding' };
    assert.ok(scoreProduct(p, ['gold', 'ring']) > 0);
    assert.equal(scoreProduct(p, ['gold', 'platinum']), 0, 'every token must match');
    assert.equal(scoreProduct(p, ['(a+b)*']), 0, 'regex metacharacters are plain text');
    assert.ok(scoreProduct(p, ['gold']) >= scoreProduct({ id: 'p2', description: 'gold' }, ['gold']), 'name outranks description');
  });

  it('filters, availability and the hard limit cap behave', () => {
    const candidates = [
      { id: 'a', name: 'Gold Ring', category: 'Jewellery', location: 'Lagos', stock: 3, uploadDate: 300 },
      { id: 'b', name: 'Gold Ring', category: 'Jewellery', location: 'Abuja', stock: 0, uploadDate: 200 },
      { id: 'c', name: 'Silver Ring', category: 'Accessories', location: 'Lagos', stock: 5, uploadDate: 100 },
    ];
    const base = { q: 'ring', limit: 10 };
    assert.deepEqual(rankProducts(candidates, base).map((p) => p.id), ['a', 'b', 'c'], 'score tie breaks by recency');
    const inStock = rankProducts(candidates, { ...base, inStockOnly: true });
    assert.deepEqual(inStock.map((p) => p.id), ['a', 'c'], 'out-of-stock excluded when filtering');
    const lagos = rankProducts(candidates, { ...base, location: 'Lagos' });
    assert.deepEqual(lagos.map((p) => p.id), ['a', 'c'], 'location narrows; without it all locations are reachable');
    const categoryOnly = rankProducts(candidates, { q: '', category: 'Jewellery', limit: 10 });
    assert.deepEqual(categoryOnly.map((p) => p.id), ['a', 'b'], 'category filter');
    assert.equal(rankProducts(candidates, { q: '', limit: 999 }).length, 3);
    assert.ok(rankProducts(candidates, { q: '', limit: 999 }).length <= 50, 'limit hard-capped at 50');
    assert.equal(isAvailable({ id: 'x', stock: 0 }), false);
    assert.equal(isAvailable({ id: 'x', stock: 0, availabilityState: 'preorder' }), true);
  });

  it('searchProducts issues bounded, index-safe queries and ranks in memory', async () => {
    const { db, limits } = fakeDb({
      products: {
        p1: { name: 'Gold Ring', category: 'Jewellery', stock: 2, uploadDate: 300 },
        p2: { name: 'Gold Necklace', category: 'Jewellery', stock: 0, uploadDate: 200 },
        p3: { name: 'Leather Bag', category: 'Bags', stock: 5, uploadDate: 100 },
      },
    });

    const all = await searchProducts(db, { q: 'gold', limit: 10 });
    assert.deepEqual(all.items.map((p) => p.id), ['p1', 'p2'], 'ranked by score then recency');
    assert.equal(all.scanned, 3);
    assert.equal(all.windowCapped, false);
    assert.equal(limits[limits.length - 1], SEARCH_WINDOW, 'candidate window is capped');

    const byCategory = await searchProducts(db, { q: '', category: 'Bags', limit: 10 });
    assert.deepEqual(byCategory.items.map((p) => p.id), ['p3'], 'equality-filtered server-side');

    const inStock = await searchProducts(db, { q: 'gold', limit: 10, inStockOnly: true });
    assert.deepEqual(inStock.items.map((p) => p.id), ['p1']);
  });

  it('seller search only ever returns sellers and stays bounded', async () => {
    const { db, limits } = fakeDb({
      userProfiles: {
        u1: { userRole: 'seller', shopName: 'Gold Watches Hub', fullName: 'Ada' },
        u2: { userRole: 'seller', shopName: 'Fresh Greens', fullName: 'Bob' },
        u3: { userRole: 'buyer', fullName: 'Gold Buyer' },
      },
    });
    const result = await searchSellers(db, 'gold', 12);
    assert.deepEqual(result.map((s) => s.id), ['u1'], 'buyers never appear');
    assert.equal(limits[limits.length - 1], 100, 'seller scan is bounded');
    const all = await searchSellers(db, '', 12);
    assert.equal(all.length, 2, 'empty query lists sellers only');
  });
});

/* ── Attribution ─────────────────────────────────────────────────────────── */

describe('tracked-link attribution', () => {
  it('builds links with the existing ref format plus validated channel/campaign', () => {
    assert.equal(buildTrackedUrl('/products/x', { channel: 'google' }), '/products/x?ch=google');
    assert.equal(buildTrackedUrl('/products/x', { ref: 'alice-1', channel: 'meta', campaign: 'q4-push' }), '/products/x?ref=alice-1&ch=meta&camp=q4-push');
    assert.equal(buildTrackedUrl('/products/x?ref=bob', { ref: 'alice' }), '/products/x?ref=bob', 'never restacks an existing ref');
    assert.equal(buildTrackedUrl('https://evil.example/x', { ref: 'alice', channel: 'google' }), 'https://evil.example/x', 'only same-site paths are tracked');
    assert.equal(buildTrackedUrl('/products/x', { ref: 'NOT VALID!', channel: 'google' }), '/products/x?ch=google', 'invalid ref dropped');
    assert.equal(buildTrackedUrl('/products/x?ch=meta', { channel: 'google' }), '/products/x?ch=meta', 'does not overwrite');
  });

  it('parses only validated attribution params', () => {
    const ok = parseTrackedParams(new URLSearchParams('ref=Alice-1&ch=google&camp=q4'));
    assert.equal(ok.ref, 'alice-1');
    assert.equal(ok.channel, 'google');
    assert.equal(ok.campaign, 'q4');
    assert.equal(ok.present, true);

    const bad = parseTrackedParams(new URLSearchParams("ref='; DROP&ch=evil&camp=has spaces"));
    assert.equal(bad.ref, undefined, 'malformed ref discarded');
    assert.equal(bad.channel, undefined);
    assert.equal(bad.campaign, undefined);
    assert.equal(bad.present, false);

    assert.equal(parseTrackedParams(new URLSearchParams('')).present, false);
  });
});

/* ── Source-level guarantees (routes, boundaries, rules) ─────────────────── */

describe('routes, module boundaries and Firestore rules', () => {
  it('every privileged engine route verifies identity server-side', () => {
    const status = read('src/app/api/admin/core-engine/status/route.ts');
    assert.ok(status.includes('verifyAdminUid'), 'admin status requires admin verification');
    assert.ok(!status.includes('process.env'), 'integration status never reads env values in the route');

    const opps = read('src/app/api/opportunities/route.ts');
    assert.ok(opps.includes('verifyUserContext'), 'create requires verified context');
    assert.ok(opps.includes('ctx.isAdmin'), 'create requires admin role');
    assert.ok(opps.includes('createOpportunitySchema'), 'create is schema-validated');
    assert.ok(opps.includes("['open', 'closed']"), 'public list is a state allowlist — drafts stay private');

    const apply = read('src/app/api/opportunities/[id]/apply/route.ts');
    assert.ok(apply.includes('verifyUserContext'), 'apply requires sign-in');
    assert.ok(apply.includes('applyToOpportunitySchema'), 'apply is schema-validated');
    assert.ok(apply.includes('ctx.uid'), 'applicant is the verified identity, not a body field');

    const search = read('src/app/api/search/route.ts');
    assert.ok(search.includes('searchParamsSchema'), 'public search is still validated');
  });

  it('vidnov-core keeps Firebase behind injected parameters — no client Firebase imports anywhere', () => {
    const files = [
      'src/lib/vidnov-core/types.ts',
      'src/lib/vidnov-core/validation.ts',
      'src/lib/vidnov-core/distribution/channels.ts',
      'src/lib/vidnov-core/distribution/job-utils.ts',
      'src/lib/vidnov-core/distribution/service.ts',
      'src/lib/vidnov-core/events/event-doc.ts',
      'src/lib/vidnov-core/events/recorder.ts',
      'src/lib/vidnov-core/opportunities/types.ts',
      'src/lib/vidnov-core/opportunities/service.ts',
      'src/lib/vidnov-core/attribution/tracking.ts',
      'src/lib/vidnov-core/trust/ledger.ts',
      'src/lib/vidnov-core/catalog/search.ts',
    ];
    for (const f of files) {
      const src = read(f);
      assert.ok(!src.includes("'use client'"), `${f} must stay server/module code`);
      assert.ok(!/from ['"]@\/firebase/.test(src), `${f} takes Firestore as a parameter, never an import`);
      assert.ok(!src.includes('console.log('), `${f} must not log payloads`);
    }
    const ledger = read('src/lib/vidnov-core/trust/ledger.ts');
    assert.ok(!ledger.includes('firebase'), 'ledger is design-only — no database access');
    assert.ok(!ledger.includes('collection('), 'ledger has no read/write surface');
  });

  it('new engine collections are default-deny for clients in BOTH rules files', () => {
    const rootRules = read('firestore.rules');
    const srcRules = read('src/firestore.rules');
    assert.equal(rootRules, srcRules, 'rules files stay byte-identical');
    for (const name of ['distributionJobs', 'opportunities', 'opportunityApplications']) {
      assert.ok(!rootRules.includes(name), `${name} has no client rule ⇒ unmatched ⇒ denied by default`);
    }
    // Existing protections remain intact.
    assert.ok(rootRules.includes('contentEvents'), 'growth event rules untouched');
    assert.ok(rootRules.includes('tiktok_connections'), 'credential rules untouched');
  });

  it('engine emits only honest distribution states in code — no self-declared live', () => {
    const service = read('src/lib/vidnov-core/distribution/service.ts');
    assert.ok(!/status:\s*'live'/.test(service), "nothing sets 'live' directly");
    assert.ok(service.includes('transitionDistributionJob'), 'all state changes go through the guarded transition');
    assert.ok(!service.includes('scrape'), 'no scraping paths');
  });
});
