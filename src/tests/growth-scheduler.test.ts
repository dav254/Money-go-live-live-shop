/**
 * THE IN-HOUSE POSTIZ LAYER — scheduling, the tick and the composer.
 *
 *   • a schedule is a pending ACTION on the side, never a queue status, and
 *     only states that can still reach `published` may carry one;
 *   • the tick spends schedules that have actually passed, is bounded to
 *     `schedulerPerRun` posts × four channels, and consumes the schedule
 *     after the attempt (no silent loss, no unbounded replays);
 *   • `published` is only ever written by `publishGrowthPost`, together with
 *     the platform's own message id — the tick never sets a status itself;
 *   • an unconfigured channel fails BEFORE any network call, with an
 *     env-NAMES-only note recorded in `results`;
 *   • composed posts must pass the same real-listing eligibility gate as the
 *     nightly drafter (visible, named, priced, pictured, owned);
 *   • the routes keep their gates: admin verification on every action, three
 *     opt-in gates + timing-safe secret on the scheduler cron.
 *
 * Run: npx tsx --test src/tests/growth-scheduler.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Firestore } from 'firebase-admin/firestore';
import {
  GrowthPostsError,
  composeGrowthPost,
  runDueGrowthPosts,
  scheduleGrowthPost,
  unscheduleGrowthPost,
} from '../lib/vidnov-core/growth-posts/service';
import { GROWTH_POST_LIMITS, canTransitionGrowthPost } from '../lib/vidnov-core/growth-posts/types';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

type Doc = Record<string, unknown>;

/** Minimal in-memory Firestore double — the four shapes the service uses. */
function makeDb(seed: Record<string, Record<string, Doc>> = {}) {
  const store = new Map<string, Map<string, Doc>>();
  for (const [name, docs] of Object.entries(seed)) {
    store.set(name, new Map(Object.entries(docs)));
  }
  const rows = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  };
  let autoId = 0;

  const db = {
    collection(name: string) {
      return {
        limit: (_n: number) => ({
          get: async () => {
            const entries = [...rows(name).entries()].map(([id, data]) => ({
              id,
              data: () => data,
            }));
            return { forEach: (cb: (d: { id: string; data: () => Doc }) => void) => entries.forEach(cb) };
          },
        }),
        doc(id: string) {
          return {
            get: async () => {
              const data = rows(name).get(id);
              return { exists: data !== undefined, data: () => data };
            },
            set: async (body: Doc, _opts?: unknown) => {
              rows(name).set(id, { ...(rows(name).get(id) ?? {}), ...body });
            },
          };
        },
        add: async (body: Doc) => {
          autoId += 1;
          const id = `gen${autoId}`;
          rows(name).set(id, { ...body });
          return { id };
        },
      };
    },
  };

  return { db: db as unknown as Firestore, store, rows };
}

const NOW = new Date('2026-11-01T12:00:00.000Z');
const FUTURE = '2026-11-01T14:00:00.000Z';
const PAST = '2026-11-01T11:00:00.000Z';

function approvedPost(overrides: Doc = {}): Doc {
  return {
    productId: 'prod1',
    sellerId: 'seller1',
    productName: 'Widget',
    caption: 'A genuinely great widget.',
    hashtags: ['deals'],
    sharePath: '/products/prod1?ref=growthpost',
    status: 'approved',
    createdAt: '2026-10-30T10:00:00.000Z',
    updatedAt: '2026-10-30T10:00:00.000Z',
    draftedBy: 'admin1',
    ...overrides,
  };
}

async function rejectsCode(fn: () => Promise<unknown>, code: string) {
  await assert.rejects(fn, (error: unknown) => {
    assert.ok(error instanceof GrowthPostsError, `expected GrowthPostsError, got ${String(error)}`);
    assert.equal(error.code, code);
    return true;
  });
}

/* ── Scheduling rules ─────────────────────────────────────────────────── */

describe('scheduleGrowthPost', () => {
  it('arms a pending action without changing the queue status', async () => {
    const { db, rows } = makeDb({ growthPosts: { p1: approvedPost() } });
    const post = await scheduleGrowthPost(db, {
      id: 'p1',
      channels: ['bluesky'],
      at: FUTURE,
      actorUid: 'admin1',
      now: NOW,
    });
    assert.equal(post.status, 'approved', 'scheduling is not a status change');
    assert.equal(post.scheduledAt, FUTURE);
    assert.deepEqual(post.scheduledChannels, ['bluesky']);
    assert.equal(post.scheduledBy, 'admin1');
    assert.equal(rows('growthPosts').get('p1')!.status, 'approved');
  });

  it('dedupes and normalizes channel names', async () => {
    const { db } = makeDb({ growthPosts: { p1: approvedPost() } });
    const post = await scheduleGrowthPost(db, {
      id: 'p1',
      channels: ['Bluesky', ' bluesky ', 'telegram'],
      at: FUTURE,
      actorUid: 'admin1',
      now: NOW,
    });
    assert.deepEqual(post.scheduledChannels, ['bluesky', 'telegram']);
  });

  it('rejects unknown channels, empty picks and the manual copy/email paths', async () => {
    const { db } = makeDb({ growthPosts: { p1: approvedPost() } });
    await rejectsCode(
      () => scheduleGrowthPost(db, { id: 'p1', channels: ['notanetwork'], at: FUTURE, actorUid: 'a', now: NOW }),
      'invalid_input',
    );
    await rejectsCode(
      () => scheduleGrowthPost(db, { id: 'p1', channels: [], at: FUTURE, actorUid: 'a', now: NOW }),
      'invalid_input',
    );
    await rejectsCode(
      () => scheduleGrowthPost(db, { id: 'p1', channels: ['copy'], at: FUTURE, actorUid: 'a', now: NOW }),
      'invalid_input',
    );
  });

  it('bounds the schedule window: no past bombs, no year-long arming', async () => {
    const { db } = makeDb({ growthPosts: { p1: approvedPost() } });
    // Past instant (and one second away — under the one-minute minimum).
    await rejectsCode(
      () => scheduleGrowthPost(db, { id: 'p1', channels: ['bluesky'], at: PAST, actorUid: 'a', now: NOW }),
      'invalid_input',
    );
    await rejectsCode(
      () => scheduleGrowthPost(db, {
        id: 'p1',
        channels: ['bluesky'],
        at: new Date(NOW.getTime() + 30_000).toISOString(),
        actorUid: 'a',
        now: NOW,
      }),
      'invalid_input',
    );
    // Beyond the 90-day horizon.
    await rejectsCode(
      () => scheduleGrowthPost(db, {
        id: 'p1',
        channels: ['bluesky'],
        at: new Date(NOW.getTime() + (GROWTH_POST_LIMITS.scheduleMaxAheadDays + 1) * 86_400_000).toISOString(),
        actorUid: 'a',
        now: NOW,
      }),
      'invalid_input',
    );
    // Unparseable garbage.
    await rejectsCode(
      () => scheduleGrowthPost(db, { id: 'p1', channels: ['bluesky'], at: 'tomorrow-ish', actorUid: 'a', now: NOW }),
      'invalid_input',
    );
  });

  it('only states that can still reach published may be scheduled', async () => {
    // Drafts must be approved first; rejected posts never publish.
    for (const status of ['draft', 'rejected']) {
      const { db } = makeDb({ growthPosts: { p1: approvedPost({ status }) } });
      await rejectsCode(
        () => scheduleGrowthPost(db, { id: 'p1', channels: ['bluesky'], at: FUTURE, actorUid: 'a', now: NOW }),
        'invalid_transition',
      );
      assert.equal(canTransitionGrowthPost(status as never, 'published'), false);
    }
    // Published/copied/failed posts may be re-scheduled for another channel.
    for (const status of ['published', 'copied', 'failed']) {
      const { db } = makeDb({ growthPosts: { p1: approvedPost({ status }) } });
      const post = await scheduleGrowthPost(db, {
        id: 'p1',
        channels: ['discord'],
        at: FUTURE,
        actorUid: 'a',
        now: NOW,
      });
      assert.equal(post.scheduledAt, FUTURE);
    }
  });

  it('unschedule clears the pending action and is idempotent', async () => {
    const { db, rows } = makeDb({
      growthPosts: {
        p1: approvedPost({ scheduledAt: PAST, scheduledChannels: ['bluesky'], scheduledBy: 'admin1' }),
      },
    });
    const post = await unscheduleGrowthPost(db, { id: 'p1', actorUid: 'admin1' });
    assert.equal(post.scheduledAt, undefined);
    assert.equal(post.scheduledChannels, undefined);
    assert.equal(rows('growthPosts').get('p1')!.scheduledAt, null);
    // Second call is a no-op, not an error.
    await unscheduleGrowthPost(db, { id: 'p1', actorUid: 'admin1' });
    // A missing post 404s honestly.
    await rejectsCode(() => unscheduleGrowthPost(db, { id: 'nope', actorUid: 'admin1' }), 'not_found');
  });
});

/* ── The tick ─────────────────────────────────────────────────────────── */

function blueSkyFetch(calls: string[]) {
  return async (input: string): Promise<Response> => {
    calls.push(input);
    if (input.includes('createSession')) {
      return { ok: true, status: 200, json: async () => ({ accessJwt: 'jwt', did: 'did:plc:test' }) } as unknown as Response;
    }
    if (input.includes('createRecord')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ uri: 'at://did:plc:test/app.bsky.feed.post/3abc' }),
      } as unknown as Response;
    }
    return { ok: false, status: 500, json: async () => ({}) } as unknown as Response;
  };
}

describe('runDueGrowthPosts (the scheduler tick)', () => {
  it('ignores schedules that have not come due yet', async () => {
    const { db, rows } = makeDb({
      growthPosts: { p1: approvedPost({ scheduledAt: FUTURE, scheduledChannels: ['bluesky'] }) },
    });
    const report = await runDueGrowthPosts(db, { actorUid: 'system:growth-scheduler', now: NOW });
    assert.equal(report.due, 0);
    assert.equal(report.published, 0);
    assert.equal(report.cleared, 0);
    assert.equal(rows('growthPosts').get('p1')!.scheduledAt, FUTURE, 'a future schedule must stay armed');
  });

  it('publishes a due post with the platform’s own id, then consumes the schedule', async () => {
    process.env.BLUESKY_HANDLE = 'vidnov.bsky.social';
    process.env.BLUESKY_APP_PASSWORD = 'test-app-password';
    try {
      const { db, rows } = makeDb({
        growthPosts: { p1: approvedPost({ scheduledAt: PAST, scheduledChannels: ['bluesky'] }) },
      });
      const calls: string[] = [];
      const report = await runDueGrowthPosts(db, {
        actorUid: 'system:growth-scheduler',
        now: NOW,
        fetchLike: blueSkyFetch(calls),
      });
      assert.deepEqual(
        { due: report.due, published: report.published, failed: report.failed, cleared: report.cleared },
        { due: 1, published: 1, failed: 0, cleared: 1 },
      );

      const doc = rows('growthPosts').get('p1')!;
      assert.equal(doc.status, 'published', 'status changes only inside the confirmed publish path');
      const result = (doc.results as Record<string, { state: string; remoteId?: string }>)!.bluesky;
      assert.equal(result.state, 'published');
      assert.equal(result.remoteId, 'at://did:plc:test/app.bsky.feed.post/3abc');
      assert.equal(doc.scheduledAt, null, 'the schedule is consumed after the attempt');
      assert.ok(calls.some((u) => u.includes('createRecord')), 'the actual post went to the platform');
      assert.ok(
        !JSON.stringify(calls).includes('test-app-password'),
        'credentials never appear in captured request URLs/bodies they do not belong to',
      );
    } finally {
      delete process.env.BLUESKY_HANDLE;
      delete process.env.BLUESKY_APP_PASSWORD;
    }
  });

  it('an unconfigured channel fails with zero network calls and an env-NAMES note', async () => {
    delete process.env.MASTODON_API_URL;
    delete process.env.MASTODON_ACCESS_TOKEN;
    const { db, rows } = makeDb({
      growthPosts: { p1: approvedPost({ scheduledAt: PAST, scheduledChannels: ['mastodon'] }) },
    });
    const calls: string[] = [];
    const report = await runDueGrowthPosts(db, {
      actorUid: 'system:growth-scheduler',
      now: NOW,
      fetchLike: blueSkyFetch(calls),
    });
    assert.deepEqual(
      { due: report.due, published: report.published, failed: report.failed, cleared: report.cleared },
      { due: 1, published: 0, failed: 1, cleared: 1 },
    );
    assert.equal(calls.length, 0, 'no network call may happen without credentials');

    const doc = rows('growthPosts').get('p1')!;
    assert.equal(doc.status, 'approved', 'nothing was attempted — the post keeps its own state');
    const result = (doc.results as Record<string, { state: string; note?: string }>)!.mastodon;
    assert.equal(result.state, 'failed');
    assert.ok(result.note?.includes('MASTODON_API_URL'), 'the note names the missing env vars');
    assert.ok(!/mastodon.social|Bearer|token=/i.test(result.note ?? ''), 'no upstream detail in the note');
    assert.equal(doc.scheduledAt, null, 'the schedule is consumed either way');
  });

  it('is bounded: one tick never exceeds schedulerPerRun posts', async () => {
    const docs: Record<string, Doc> = {};
    for (let i = 0; i < GROWTH_POST_LIMITS.schedulerPerRun + 3; i++) {
      docs[`p${i}`] = approvedPost({
        scheduledAt: PAST,
        scheduledChannels: ['bluesky'],
        caption: `Post ${i}`,
      });
    }
    const { db } = makeDb({ growthPosts: docs });
    const report = await runDueGrowthPosts(db, { actorUid: 'system:growth-scheduler', now: NOW });
    assert.equal(report.due, GROWTH_POST_LIMITS.schedulerPerRun);
    assert.ok(GROWTH_POST_LIMITS.schedulerPerRun <= 5, 'the hard cap stays small');
  });

  it('a rejected/draft post with a stale schedule is never touched', async () => {
    const { db, rows } = makeDb({
      growthPosts: { p1: approvedPost({ status: 'rejected', scheduledAt: PAST, scheduledChannels: ['bluesky'] }) },
    });
    const report = await runDueGrowthPosts(db, { actorUid: 'system:growth-scheduler', now: NOW });
    assert.equal(report.due, 0);
    assert.equal(rows('growthPosts').get('p1')!.status, 'rejected');
  });
});

/* ── Composer ─────────────────────────────────────────────────────────── */

const REAL_PRODUCT: Doc = {
  sellerId: 'seller1',
  name: 'Maison One chronograph',
  price: 249,
  imageUrl: 'https://cdn.example.com/watch.jpg',
};

describe('composeGrowthPost', () => {
  it('creates an approved post from a real listing, sanitized and attributed', async () => {
    const { db, store } = makeDb({ products: { prod1: REAL_PRODUCT } });
    const post = await composeGrowthPost(db, {
      productId: 'prod1',
      caption: 'New drop:\u0000  the Maison One is live\ngrab it soon',
      hashtags: ['#deals', 'deals', '', 'new arrivals'],
      actorUid: 'admin1',
      now: NOW,
    });
    assert.equal(post.status, 'approved', 'the admin is the author — nothing to approve');
    assert.equal(post.draftedBy, 'admin1');
    assert.equal(post.decidedBy, 'admin1');
    assert.ok(post.caption.includes('New drop:'), 'control chars stripped, text kept');
    assert.ok(!post.caption.includes('\u0000'), 'control chars are gone');
    assert.deepEqual(post.hashtags, ['deals', 'newarrivals']);
    assert.ok(post.sharePath.startsWith('/products/prod1'));
    assert.ok(post.sharePath.includes('ref=growthpost'), 'attribution survives into composed posts');
    assert.equal(store.get('products')!.get('prod1')!.price, 249, 'the product itself is untouched');
  });

  it('refuses listings that would fail the drafter’s own eligibility gate', async () => {
    const { db, store } = makeDb({
      products: {
        p1: { sellerId: 'seller1', name: 'No picture', price: 5 }, // missing_image
        p2: { ...REAL_PRODUCT, sellerId: '' }, // missing_seller
        p3: { ...REAL_PRODUCT, status: 'hidden' }, // not_visible
      },
    });
    for (const productId of ['p1', 'p2', 'p3']) {
      await rejectsCode(
        () => composeGrowthPost(db, { productId, caption: 'hi', actorUid: 'admin1', now: NOW }),
        'invalid_input',
      );
    }
    // A product that does not exist 404s.
    await rejectsCode(
      () => composeGrowthPost(db, { productId: 'ghost', caption: 'hi', actorUid: 'admin1', now: NOW }),
      'not_found',
    );
    // Refusals write nothing — no phantom posts entered the queue.
    assert.equal(store.get('growthPosts'), undefined);
  });

  it('refuses empty and oversized copy', async () => {
    const { db } = makeDb({ products: { prod1: REAL_PRODUCT } });
    await rejectsCode(
      () => composeGrowthPost(db, { productId: 'prod1', caption: '   ', actorUid: 'a', now: NOW }),
      'invalid_input',
    );
    await rejectsCode(
      () => composeGrowthPost(db, { productId: 'prod1', caption: 'x'.repeat(4_001), actorUid: 'a', now: NOW }),
      'invalid_input',
    );
    await rejectsCode(
      () => composeGrowthPost(db, { productId: '', caption: 'hi', actorUid: 'a', now: NOW }),
      'invalid_input',
    );
  });
});

/* ── Route & UI gates (source level) ──────────────────────────────────── */

describe('routes and page keep their gates (source level)', () => {
  const adminRoute = read('src/app/api/admin/growth-posts/route.ts');
  const schedulerRoute = read('src/app/api/growth-posts/scheduler/route.ts');
  const page = read('src/app/dashboard/admin/system/growth/page.tsx');
  const service = read('src/lib/vidnov-core/growth-posts/service.ts');

  it('the admin route still verifies admin on exactly its two handlers', () => {
    assert.equal((adminRoute.match(/await verifyAdminUid/g) ?? []).length, 2);
    for (const action of ["'compose'", "'schedule'", "'unschedule'"]) {
      assert.ok(adminRoute.includes(`case ${action}`), `missing ${action} action`);
    }
    assert.ok(adminRoute.includes("case 'invalid_input': return 400"));
  });

  it('the scheduler cron is triple-gated with its own opt-in flag', () => {
    for (const gate of ['VIDNOV_CRON_ENABLED', 'GROWTH_POSTS_SCHEDULER_ENABLED', 'CRON_SECRET', 'authorizeCronSchedule']) {
      assert.ok(schedulerRoute.includes(gate), `missing gate ${gate}`);
    }
    assert.ok(schedulerRoute.includes("'system:growth-scheduler'"), 'honest actor, never a fake admin');
    assert.ok(!schedulerRoute.includes("status: 'published'"), 'the tick never writes a status itself');
    assert.ok(schedulerRoute.includes("'in_progress'"), 'overlap guard present');
  });

  it('the tick can never claim published on its own — service keeps one write site', () => {
    const code = service.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.equal((code.match(/status: 'published'/g) ?? []).length, 1);
    assert.ok(code.includes('remoteId: outcome.remoteId'), 'confirmed success still returns the platform id');
    assert.ok(code.includes('state: \'failed\''), 'failed attempts still record failed');
  });

  it('the page offers compose, schedule and cancel without hardcoding networks', () => {
    for (const marker of ['Compose a post', 'Set schedule', 'Cancel schedule', 'defaultAtLocal', 'datetime-local']) {
      assert.ok(page.includes(marker), `missing UI marker ${marker}`);
    }
    assert.ok(!/channel:\s*'(instagram|facebook|tiktok|x)'/i.test(page), 'no approval-gated network may appear');
    assert.ok(!page.includes('process.env'), 'the client page never touches env');
  });

  it('the shared schedule bounds stay sane', () => {
    assert.ok(GROWTH_POST_LIMITS.scheduleMaxAheadDays <= 90);
    assert.ok(GROWTH_POST_LIMITS.scheduleMinAheadMs >= 30_000);
    assert.ok(GROWTH_POST_LIMITS.schedulerPerRun <= 5);
    assert.ok(GROWTH_POST_LIMITS.schedulerChannelsMax <= 4);
  });
});
