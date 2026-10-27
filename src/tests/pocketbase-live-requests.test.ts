/**
 * LIVE SELLING, BUYER REQUESTS AND OFFERS MUST SURVIVE A FIRESTORE OUTAGE.
 *
 * ## Why this file exists
 *
 * These three sections were the last high-traffic Firestore-only corners of
 * the product: a broadcast existed only by a `liveStreams` document, a
 * seller's answer to a paying customer's brief existed only in `requests` /
 * `offers`, and neither had a VPS copy — while the order their flow produced
 * was already mirrored. An outage therefore left the marketplace able to show
 * a completed sale but not the brief, the offer or the stream it came from.
 *
 * Mirroring is only half of it: a mirror nobody calls, a helper that throws
 * instead of returning false, or a `FieldValue.increment` sentinel that
 * reaches the JSON wire would all leave the same hole. These tests are the
 * stop.
 *
 * The last block is an end-to-end round trip through the REAL PocketBase HTTP
 * client (auth → ensureCollection → create → patch → counter bumps) against an
 * in-process mock server on an ephemeral 127.0.0.1 port, so the wire contract
 * itself is exercised, not just the source wiring.
 */

import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  OFFERS_COLLECTION,
  REQUESTS_COLLECTION,
  pbBumpRequestCounter,
  pbMirrorOffer,
  pbMirrorRequest,
  pbPatchOffer,
  pbPatchRequest,
} from '../lib/pocketbase/requests';
import {
  LIVE_CHAT_COLLECTION,
  LIVE_REPORTS_COLLECTION,
  LIVE_STREAMS_COLLECTION,
  pbBumpLiveStreamCounter,
  pbMirrorLiveChatMessage,
  pbMirrorLiveReport,
  pbMirrorLiveStream,
  pbPatchLiveStream,
} from '../lib/pocketbase/live-streams';
import { scrubForPocketBase, type PbField, type PbRecord } from '../lib/pocketbase/server';

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** Comments stripped — several of these files quote the code they replaced. */
function readCode(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const POCKETBASE_KEYS = [
  'POCKETBASE_URL',
  'POCKETBASE_ADMIN_EMAIL',
  'POCKETBASE_ADMIN_PASSWORD',
] as const;

/** Runs `fn` with PocketBase deliberately unconfigured, restoring the env. */
async function withoutPocketBase<T>(fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const key of POCKETBASE_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  try {
    return await fn();
  } finally {
    for (const key of POCKETBASE_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key] as string;
    }
  }
}

/** Runs `fn` against a PocketBase URL nothing is listening on. */
async function withDeadPocketBase<T>(fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const key of POCKETBASE_KEYS) {
    saved[key] = process.env[key];
  }
  process.env.POCKETBASE_URL = 'http://127.0.0.1:1'; // connection refused
  process.env.POCKETBASE_ADMIN_EMAIL = 'admin@test.local';
  process.env.POCKETBASE_ADMIN_PASSWORD = 'not-a-real-password';
  try {
    return await fn();
  } finally {
    for (const key of POCKETBASE_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key] as string;
    }
  }
}

/* --------------------------------------------------------------------------- */
/* 1. Degrades instead of throwing                                             */
/* --------------------------------------------------------------------------- */

describe('the new mirrors degrade instead of throwing', () => {
  it('every helper reports "not configured" when PocketBase is off', async () => {
    await withoutPocketBase(async () => {
      assert.equal(await pbMirrorRequest('req1', { title: 'T' }), false);
      assert.equal(await pbPatchRequest('req1', { status: 'closed' }), false);
      assert.equal(await pbMirrorOffer('off1', { price: 100 }), false);
      assert.equal(await pbPatchOffer('off1', { status: 'accepted' }), false);
      assert.equal(await pbBumpRequestCounter('req1', 'views', 1), false);
      assert.equal(await pbBumpRequestCounter('req1', 'offersCount', -1), false);

      assert.equal(await pbMirrorLiveStream('s1', { title: 'Live' }), false);
      assert.equal(await pbPatchLiveStream('s1', { status: 'ENDED' }), false);
      assert.equal(await pbBumpLiveStreamCounter('s1', 'viewerCount', 1), false);
      assert.equal(await pbMirrorLiveChatMessage('s1', 'm1', { message: 'hi' }), false);
      assert.equal(await pbMirrorLiveReport('rep1', { reason: 'Other' }), false);
    });
  });

  it('an unreachable PocketBase returns false instead of rejecting', async () => {
    await withDeadPocketBase(async () => {
      assert.equal(await pbMirrorRequest('req1', { title: 'T' }), false);
      assert.equal(await pbBumpRequestCounter('req1', 'views', 1), false);
      assert.equal(await pbMirrorLiveStream('s1', { title: 'Live' }), false);
      assert.equal(await pbBumpLiveStreamCounter('s1', 'chatMessagesCount', 1), false);
      assert.equal(await pbMirrorLiveChatMessage('s1', 'm1', { message: 'hi' }), false);
      assert.equal(await pbMirrorLiveReport('rep1', { reason: 'Other' }), false);
    });
  });
});

/* --------------------------------------------------------------------------- */
/* 2. Collection and schema contract                                           */
/* --------------------------------------------------------------------------- */

describe('each section owns distinct collections keyed by the Firestore id', () => {
  it('no two mirror collections share a name', () => {
    const names = [
      REQUESTS_COLLECTION,
      OFFERS_COLLECTION,
      LIVE_STREAMS_COLLECTION,
      LIVE_CHAT_COLLECTION,
      LIVE_REPORTS_COLLECTION,
    ];
    assert.equal(new Set(names).size, names.length, 'collection names must be unique');
    assert.deepEqual(
      [REQUESTS_COLLECTION, OFFERS_COLLECTION, LIVE_STREAMS_COLLECTION],
      ['requests', 'offers', 'live_streams'],
      'collection names mirror the Firestore collections they copy',
    );
  });

  it('every mirror row is keyed by a required fsId', () => {
    for (const rel of [
      'src/lib/pocketbase/requests.ts',
      'src/lib/pocketbase/live-streams.ts',
    ]) {
      const source = readCode(rel);
      assert.ok(
        source.includes("name: 'fsId', type: 'text', required: true"),
        `${rel} must key every mirror row by its Firestore doc id`,
      );
      assert.ok(
        source.includes('scrubForPocketBase'),
        `${rel} must scrub Timestamps/sentinels before the wire`,
      );
    }
  });

  it('flattened chat keeps its parent stream (PocketBase has no subcollections)', () => {
    const source = readCode('src/lib/pocketbase/live-streams.ts');
    assert.ok(source.includes("name: 'streamId', type: 'text'"), 'chat rows need a streamId column');
    assert.ok(
      source.includes('return upsert(LIVE_CHAT_COLLECTION, CHAT_FIELDS, fsId, { streamId, ...data })'),
      'the stream id must be stamped on every mirrored message',
    );
  });

  it('a Firestore FieldValue sentinel never reaches the JSON wire', () => {
    const scrubbed = scrubForPocketBase({
      title: 'Brief',
      createdAt: { _methodName: 'serverTimestamp' }, // FieldValue sentinel
      updatedAt: new Date('2026-03-04T05:06:07.000Z'), // plain Date
      startedAt: { toDate: () => new Date('2026-01-02T03:04:05.000Z') }, // Firestore Timestamp
      nested: { at: new Date('2026-02-03T04:05:06.000Z') },
      mediaIds: ['a', 'b'],
      views: 3,
    }) as Record<string, unknown>;

    assert.equal('createdAt' in scrubbed, false, 'the sentinel key must be dropped, not null-ed');
    assert.equal(scrubbed.updatedAt, '2026-03-04T05:06:07.000Z', 'a plain Date becomes an ISO string');
    assert.equal(scrubbed.startedAt, '2026-01-02T03:04:05.000Z', 'a Timestamp becomes an ISO string');
    assert.deepEqual(
      scrubbed.nested,
      { at: '2026-02-03T04:05:06.000Z' },
      'Dates nested inside a document are converted too',
    );
    assert.deepEqual(scrubbed.mediaIds, ['a', 'b']);
    assert.equal(scrubbed.views, 3);
  });
});

/* --------------------------------------------------------------------------- */
/* 3. Every write site keeps its VPS copy current                               */
/* --------------------------------------------------------------------------- */

/** file → the mirror calls that file must make (all fire-and-forget). */
const WIRING: { file: string; calls: string[] }[] = [
  {
    file: 'src/lib/requests/request-service.ts',
    calls: [
      'void pbMirrorRequest(', // create a brief
      "status: 'closed', closedAt, updatedAt: closedAt", // close a brief
      "status: 'deleted', closedAt: deletedAt", // soft-delete a brief
      'void pbPatchRequest(requestId, { matchedSellers', // matched-sellers fan-out
    ],
  },
  {
    file: 'src/lib/requests/offer-service.ts',
    calls: [
      'void pbMirrorOffer(ref.id,', // reserve the draft
      'void pbPatchOffer(offerId,', // submit it
      "void pbPatchOffer(offerId, { status: 'accepted'", // winner
      "void pbPatchOffer(doc.id, { status: 'declined'", // losers
      'void pbPatchRequest(requestId, {', // brief closes with the order id
      'void pbBumpRequestCounter(offer.requestId,', // offersCount follows Firestore
    ],
  },
  {
    file: 'src/app/api/requests/route.ts',
    calls: ["pbBumpRequestCounter(id, 'views', 1)"],
  },
  {
    file: 'src/app/api/requests/offers/route.ts',
    calls: [
      "void pbPatchOffer(id, { status: 'withdrawn'",
      "pbBumpRequestCounter(offer.requestId, 'offersCount', -1)",
    ],
  },
  {
    file: 'src/lib/live/service.ts',
    calls: ['void pbMirrorLiveStream(ref.id, stream)', 'void pbPatchLiveStream(id,'],
  },
  {
    file: 'src/app/api/live/[id]/route.ts',
    calls: [
      'void pbPatchLiveStream(id, { ...mirrorPatch', // join: exact post-transaction values
      "pbBumpLiveStreamCounter(id, 'viewerCount', -1)", // leave
    ],
  },
  {
    file: 'src/app/api/live/[id]/chat/route.ts',
    calls: [
      'void pbMirrorLiveChatMessage(id, ref.id, msg)',
      "pbBumpLiveStreamCounter(id, 'chatMessagesCount', 1)",
    ],
  },
  {
    file: 'src/app/api/live/[id]/report/route.ts',
    calls: [
      'void pbMirrorLiveReport(reportRef.id, {',
      "pbBumpLiveStreamCounter(id, 'reportsCount', 1)",
    ],
  },
];

describe('every write site mirrors to the VPS without blocking the user', () => {
  for (const { file, calls } of WIRING) {
    it(`${file} keeps its mirror current`, () => {
      const source = read(file);
      for (const call of calls) {
        assert.ok(
          source.includes(call),
          `${file} is missing the mirror call: ${call}`,
        );
      }
    });
  }

  it('no mirror call is ever awaited in a write path', () => {
    // A failed mirror must not fail the create/submit/broadcast it belongs to;
    // the helpers return false instead, and `void` keeps the caller moving.
    for (const { file } of WIRING) {
      const source = readCode(file);
      for (const fn of ['pbMirror', 'pbPatch', 'pbBump']) {
        assert.equal(
          source.includes(`await ${fn}`),
          false,
          `${file} awaits a ${fn}* mirror call — the mirror must be fire-and-forget`,
        );
      }
    }
  });

  it('the counters stay server-owned (a bump, never a client number)', () => {
    for (const rel of ['src/app/api/requests/route.ts', 'src/app/api/live/[id]/route.ts']) {
      const source = readCode(rel);
      assert.equal(
        /pb(?:Bump|Patch)\w+\([^)]*\b(body|payload|json)\b/.test(source),
        false,
        `${rel} must never take a mirror value from the request body`,
      );
    }
  });
});

/* --------------------------------------------------------------------------- */
/* 4. End-to-end against an in-process PocketBase mock                         */
/* --------------------------------------------------------------------------- */

type MockStore = Map<string, Map<string, Record<string, unknown>>>;

interface MockPocketBase {
  port: number;
  store: MockStore;
  close: () => Promise<void>;
  fieldsFor: (collection: string) => string[];
}

const esc = (value: string) => value.replace(/'/g, "\\'");
const unesc = (value: string) => value.replace(/\\'/g, "'");

/**
 * A minimal PocketBase: superuser auth, collection ensure (GET/PATCH), and
 * record create/patch/list with the single filter our mirrors emit
 * (`fsId = '…'`). Enough to exercise the real client's wire contract.
 */
function startMockPocketBase(): Promise<MockPocketBase> {
  const store: MockStore = new Map();
  const schema = new Map<string, PbField[]>();
  let seq = 0;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let body: Record<string, unknown> = {};
      try {
        body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        body = {};
      }
      const json = (status: number, payload: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

      if (url.pathname.endsWith('/auth-with-password')) {
        return json(200, { token: 'mock-superuser-token' });
      }

      const parts = url.pathname.split('/').filter(Boolean); // api/collections/<name>/...
      if (parts[0] !== 'api' || parts[1] !== 'collections' || !parts[2]) {
        return json(404, { message: 'Not found' });
      }
      const collection = decodeURIComponent(parts[2]);
      const rest = parts.slice(3);
      const rows = store.get(collection) ?? new Map<string, Record<string, unknown>>();

      // Collection level: ensure (GET), schema diff (PATCH), create (POST).
      if (rest.length === 0) {
        if (req.method === 'GET') {
          return json(200, { name: collection, fields: schema.get(collection) ?? [] });
        }
        if (req.method === 'PATCH') {
          const incoming = (body.fields ?? body.schema ?? []) as PbField[];
          schema.set(collection, [...(schema.get(collection) ?? []), ...incoming]);
          return json(200, { name: collection, fields: schema.get(collection) });
        }
        if (req.method === 'POST') {
          const incoming = (body.fields ?? body.schema ?? []) as PbField[];
          schema.set(collection, incoming);
          store.set(collection, rows);
          return json(200, { name: collection, fields: incoming });
        }
      }

      if (rest[0] !== 'records') return json(404, { message: 'Not found' });
      store.set(collection, rows);

      // List — only the `fsId = '…'` filter our mirrors use.
      if (rest.length === 1 && req.method === 'GET') {
        const filter = url.searchParams.get('filter');
        let items = [...rows.values()];
        const match = filter?.match(/fsId = '((?:[^'\\]|\\.)*)'/);
        if (match) {
          const wanted = unesc(match[1]);
          items = items.filter((r) => r.fsId === wanted);
        }
        return json(200, { items, totalItems: items.length });
      }

      // Create.
      if (rest.length === 1 && req.method === 'POST') {
        const now = new Date().toISOString();
        const record = { id: `mock${++seq}`, created: now, updated: now, ...body };
        rows.set(record.id as string, record);
        return json(200, record);
      }

      // Patch / delete one record.
      const id = rest[1];
      if (id && req.method === 'PATCH') {
        const existing = rows.get(id);
        if (!existing) return json(404, { message: 'Not found' });
        Object.assign(existing, body, { updated: new Date().toISOString() });
        return json(200, existing);
      }
      if (id && req.method === 'DELETE') {
        rows.delete(id);
        return json(204, {});
      }
      return json(404, { message: 'Not found' });
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        port,
        store,
        close: () => new Promise<void>((done) => server.close(() => done())),
        fieldsFor: (collection: string) => (schema.get(collection) ?? []).map((f) => f.name),
      });
    });
  });
}

async function withMockPocketBase<T>(fn: (mock: MockPocketBase) => Promise<T>): Promise<T> {
  const mock = await startMockPocketBase();
  const saved: Record<string, string | undefined> = {};
  for (const key of POCKETBASE_KEYS) saved[key] = process.env[key];
  process.env.POCKETBASE_URL = `http://127.0.0.1:${mock.port}`;
  process.env.POCKETBASE_ADMIN_EMAIL = 'admin@test.local';
  process.env.POCKETBASE_ADMIN_PASSWORD = 'test-password';
  try {
    return await fn(mock);
  } finally {
    for (const key of POCKETBASE_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key] as string;
    }
    await mock.close();
  }
}

const row = (mock: MockPocketBase, collection: string, fsId: string): Record<string, unknown> => {
  const found = records(mock, collection).find((r) => r.fsId === fsId);
  assert.ok(found, `no ${collection} mirror row for fsId=${fsId}`);
  return found;
};

const records = (mock: MockPocketBase, collection: string): Record<string, unknown>[] =>
  [...((mock.store.get(collection) ?? new Map()) as Map<string, Record<string, unknown>>).values()];

test('requests: create then patch merges without losing the brief', async () => {
  await withMockPocketBase(async (mock) => {
    const created = await pbMirrorRequest('req1', {
      requestNumber: 'REQ-1',
      customerId: 'buyer1',
      title: 'Need a plumber in Westlands',
      status: 'active',
      offersCount: 0,
      views: 0,
      createdAt: new Date('2026-05-05T10:00:00.000Z'),
      mediaIds: ['m1', 'm2'],
    });
    assert.equal(created, true, 'the create must report success');

    const before = row(mock, REQUESTS_COLLECTION, 'req1');
    assert.equal(before.requestNumber, 'REQ-1');
    assert.equal(before.createdAt, '2026-05-05T10:00:00.000Z', 'Date → ISO on the wire');
    assert.deepEqual(before.mediaIds, ['m1', 'm2']);
    assert.ok(mock.fieldsFor(REQUESTS_COLLECTION).includes('fsId'), 'the collection was ensured');

    // Lifecycle patch: status flips, everything else must survive.
    assert.equal(await pbPatchRequest('req1', { status: 'closed', closedAt: new Date().toISOString() }), true);
    const after = row(mock, REQUESTS_COLLECTION, 'req1');
    assert.equal(after.status, 'closed');
    assert.equal(after.title, 'Need a plumber in Westlands', 'a partial patch must merge, not replace');
    assert.equal(after.customerId, 'buyer1');
    assert.equal(records(mock, REQUESTS_COLLECTION).length, 1, 'exactly one row per Firestore id');
  });
});

test('requests: counters bump the mirror and can never go negative', async () => {
  await withMockPocketBase(async (mock) => {
    // No mirror row yet (PocketBase was down when the brief was created).
    assert.equal(await pbBumpRequestCounter('reqNew', 'views', 1), true);
    assert.equal(row(mock, REQUESTS_COLLECTION, 'reqNew').views, 1, 'a missing row is created, not lost');

    await pbMirrorRequest('req2', { title: 'Brief', offersCount: 0, views: 0 });
    assert.equal(await pbBumpRequestCounter('req2', 'offersCount', 1), true);
    assert.equal(row(mock, REQUESTS_COLLECTION, 'req2').offersCount, 1);

    assert.equal(await pbBumpRequestCounter('req2', 'offersCount', -1), true);
    assert.equal(await pbBumpRequestCounter('req2', 'offersCount', -1), true);
    assert.equal(
      row(mock, REQUESTS_COLLECTION, 'req2').offersCount,
      0,
      'a double withdraw must floor at zero, never read -1',
    );
    assert.equal(records(mock, REQUESTS_COLLECTION).length, 2, 'bumps never duplicate a row');
  });
});

test('offers: draft → submitted → accepted/declined mirrors every state', async () => {
  await withMockPocketBase(async (mock) => {
    assert.equal(await pbMirrorOffer('off1', { requestId: 'req1', sellerId: 's1', price: 0, status: 'draft' }), true);
    assert.equal(await pbPatchOffer('off1', { price: 4500, status: 'submitted' }), true);
    assert.equal(await pbPatchOffer('off1', { status: 'accepted' }), true);

    const row1 = row(mock, OFFERS_COLLECTION, 'off1');
    assert.equal(row1.status, 'accepted');
    assert.equal(row1.price, 4500, 'the submitted price survives the acceptance patch');
    assert.equal(row1.sellerId, 's1', 'ownership never changes across states');

    // A declined loser converges even without a prior mirror row.
    assert.equal(await pbPatchOffer('off2', { status: 'declined' }), true);
    assert.equal(row(mock, OFFERS_COLLECTION, 'off2').status, 'declined');
  });
});

test('live: stream lifecycle, chat and reports mirror with their parent id', async () => {
  await withMockPocketBase(async (mock) => {
    assert.equal(
      await pbMirrorLiveStream('live1', {
        sellerId: 'seller1',
        title: 'Friday market',
        status: 'STARTING',
        viewerCount: 0,
        startedAt: new Date('2026-06-01T08:00:00.000Z'),
        attachedProductIds: ['p1'],
      }),
      true,
    );
    const start = row(mock, LIVE_STREAMS_COLLECTION, 'live1');
    assert.equal(start.startedAt, '2026-06-01T08:00:00.000Z');
    assert.deepEqual(start.attachedProductIds, ['p1']);

    assert.equal(await pbPatchLiveStream('live1', { status: 'ENDED', durationSeconds: 600 }), true);
    const ended = row(mock, LIVE_STREAMS_COLLECTION, 'live1');
    assert.equal(ended.status, 'ENDED');
    assert.equal(ended.title, 'Friday market', 'a status patch keeps the rest of the document');

    // Join → leave must floor at zero (a duplicated "leave" cannot go negative).
    assert.equal(await pbBumpLiveStreamCounter('live1', 'viewerCount', 1), true);
    assert.equal(await pbBumpLiveStreamCounter('live1', 'viewerCount', 1), true);
    assert.equal(await pbBumpLiveStreamCounter('live1', 'viewerCount', -1), true);
    assert.equal(await pbBumpLiveStreamCounter('live1', 'viewerCount', -1), true);
    assert.equal(await pbBumpLiveStreamCounter('live1', 'viewerCount', -1), true);
    assert.equal(row(mock, LIVE_STREAMS_COLLECTION, 'live1').viewerCount, 0);

    assert.equal(await pbBumpLiveStreamCounter('live1', 'chatMessagesCount', 1), true);
    assert.equal(row(mock, LIVE_STREAMS_COLLECTION, 'live1').chatMessagesCount, 1);

    // Chat rows are flattened — but never orphaned.
    assert.equal(
      await pbMirrorLiveChatMessage('live1', 'msg1', {
        userId: 'u9',
        userName: 'Viewer',
        kind: 'text',
        message: 'hello!',
        isSeller: false,
        createdAt: new Date(),
      }),
      true,
    );
    const chat = row(mock, LIVE_CHAT_COLLECTION, 'msg1');
    assert.equal(chat.streamId, 'live1', 'the parent stream id is stamped on the message');
    assert.equal(chat.message, 'hello!');
    assert.match(String(chat.createdAt), /^\d{4}-\d{2}-\d{2}T/, 'the timestamp is an ISO string');

    assert.equal(
      await pbMirrorLiveReport('rep1', {
        streamId: 'live1',
        sellerId: 'seller1',
        reporterId: 'u3',
        reason: 'Spam',
        status: 'pending',
        createdAt: new Date().toISOString(),
      }),
      true,
    );
    const report = row(mock, LIVE_REPORTS_COLLECTION, 'rep1');
    assert.equal(report.streamId, 'live1');
    assert.equal(report.reason, 'Spam');
  });
});
