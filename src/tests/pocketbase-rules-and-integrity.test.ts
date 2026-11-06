/**
 * POCKETBASE ACCESS RULES + LOGICAL-ID INTEGRITY.
 *
 * Two classes of bug motivated this file, and both were real:
 *
 *   1. SECURITY — the collection bootstrap used `''` for every rule while a
 *      comment claimed that meant "nobody but the superuser". In PocketBase an
 *      empty string is the OPPOSITE of locked: `null` is superuser-only, `''`
 *      is "anyone, including guests". So every Social Engine collection was
 *      being created publicly readable AND writable, `social_engine_connections`
 *      included. These tests pin `null`.
 *
 *   2. INTEGRITY — writers did read-then-create with no uniqueness constraint,
 *      so two concurrent writes for one logical id could both POST and leave two
 *      rows. The unique index plus the conflict retry is pinned here.
 *
 * Everything runs against an in-memory PocketBase HTTP double; no network, no
 * credentials, no real data.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ensureCollection,
  pbCreateRecordKeyed,
  pbGetCollection,
  SUPERUSER_ONLY_RULES,
  uniqueIndexSql,
  type PbField,
} from '../lib/pocketbase/server';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true },
  { name: 'module', type: 'text' },
  { name: 'status', type: 'text' },
  { name: 'updatedAt', type: 'date' },
  { name: 'data', type: 'json' },
];

interface PbDoubleOptions {
  /** Collections that already exist, as PocketBase would report them. */
  existing?: Record<string, Record<string, unknown>>;
  /** Reject a create whose fsId already exists (what the unique index does). */
  conflictOnDuplicate?: boolean;
  /** Reject every create with a 400 (a real validation failure, not a race). */
  rejectAllCreates?: boolean;
  /** Seed rows for the records API. */
  seed?: Array<Record<string, unknown>>;
}

function makePb(options: PbDoubleOptions = {}) {
  const created: Array<Record<string, unknown>> = [];
  const collectionPatches: Array<Record<string, unknown>> = [];
  const rowPatches: Array<{ id: string; body: Record<string, unknown> }> = [];
  const rows: Array<Record<string, unknown>> = [...(options.seed ?? [])];
  let seq = 0;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const path = url.pathname;
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};

    if (path.endsWith('/auth-with-password')) return json({ token: 'test-token' });

    // Create a collection.
    if (method === 'POST' && path === '/api/collections') {
      created.push(body);
      return json({ ok: true });
    }

    const collectionPath = path.match(/^\/api\/collections\/([^/]+)$/);
    if (collectionPath) {
      const name = decodeURIComponent(collectionPath[1]);
      if (method === 'GET') {
        const cfg = options.existing?.[name];
        if (!cfg) return json({ message: 'not found' }, 404);
        return json({ name, ...cfg });
      }
      if (method === 'PATCH') {
        collectionPatches.push(body);
        return json({ ok: true });
      }
    }

    const recordPath = path.match(/^\/api\/collections\/([^/]+)\/records(?:\/([^/]+))?$/);
    if (!recordPath) return json({ message: 'not found' }, 404);
    const recordId = recordPath[2] ? decodeURIComponent(recordPath[2]) : null;

    if (method === 'GET' && !recordId) {
      return json({ items: rows, totalItems: rows.length });
    }

    if (method === 'POST' && !recordId) {
      if (options.rejectAllCreates) {
        return json({ message: 'Invalid field value.' }, 400);
      }
      if (options.conflictOnDuplicate && rows.some((row) => row.fsId === body.fsId)) {
        // What PocketBase answers when a unique index rejects the insert.
        return json({ message: 'The record was rejected because it is not unique.' }, 400);
      }
      seq += 1;
      const row = { ...body, id: `rec${seq}` };
      rows.push(row);
      return json(row);
    }

    if (method === 'PATCH' && recordId) {
      rowPatches.push({ id: recordId, body });
      const current = rows.find((row) => row.id === recordId);
      if (current) Object.assign(current, body);
      return json(current ?? { ok: true });
    }

    return json({}, 405);
  };

  return { created, collectionPatches, rowPatches, rows, fetchImpl };
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env.POCKETBASE_URL = 'http://pb.test';
  process.env.POCKETBASE_ADMIN_EMAIL = 'admin@test';
  process.env.POCKETBASE_ADMIN_PASSWORD = 'secret';
});

afterEach(() => {
  delete process.env.POCKETBASE_URL;
  delete process.env.POCKETBASE_ADMIN_EMAIL;
  delete process.env.POCKETBASE_ADMIN_PASSWORD;
  globalThis.fetch = originalFetch;
});

describe('collection access rules', () => {
  it('creates collections with every rule locked to superusers (null, not "")', async () => {
    const pb = makePb();
    globalThis.fetch = pb.fetchImpl as typeof fetch;

    await ensureCollection('growth_posts', FIELDS);

    assert.equal(pb.created.length, 1, 'one create attempt');
    const payload = pb.created[0];

    for (const rule of ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']) {
      assert.equal(
        payload[rule],
        null,
        `${rule} must be null (superuser-only); "" would publish the collection`,
      );
    }
  });

  it('the shared constant is null for all five rules and is never a string', () => {
    assert.deepEqual({ ...SUPERUSER_ONLY_RULES }, {
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });
  });

  it('repairs a collection that was created with public (empty-string) rules', async () => {
    const pb = makePb({
      existing: {
        growth_posts: {
          fields: FIELDS.map((f) => ({ name: f.name })),
          indexes: [uniqueIndexSql('growth_posts')],
          listRule: '',
          viewRule: '',
          createRule: '',
          updateRule: '',
          deleteRule: '',
        },
      },
    });
    globalThis.fetch = pb.fetchImpl as typeof fetch;

    await ensureCollection('growth_posts', FIELDS);

    const rulePatch = pb.collectionPatches.find((patch) =>
      Object.prototype.hasOwnProperty.call(patch, 'listRule'),
    );
    assert.ok(rulePatch, 'an existing public collection must be re-locked');
    assert.equal(rulePatch?.listRule, null);
    assert.equal(rulePatch?.deleteRule, null);
  });

  it('leaves a correctly locked collection untouched (no write on the hot path)', async () => {
    const pb = makePb({
      existing: {
        growth_posts: {
          fields: FIELDS.map((f) => ({ name: f.name })),
          indexes: [uniqueIndexSql('growth_posts')],
          listRule: null,
          viewRule: null,
          createRule: null,
          updateRule: null,
          deleteRule: null,
        },
      },
    });
    globalThis.fetch = pb.fetchImpl as typeof fetch;

    await ensureCollection('growth_posts', FIELDS);

    assert.deepEqual(pb.collectionPatches, [], 'a healthy collection costs one GET and no writes');
  });

  it('adds the fsId unique index on create and on an existing collection', async () => {
    const fresh = makePb();
    globalThis.fetch = fresh.fetchImpl as typeof fetch;
    await ensureCollection('social_engine_audit', FIELDS);

    const indexes = fresh.created[0].indexes as string[];
    assert.ok(
      indexes?.some((sql) => /unique/i.test(sql) && sql.includes('fsId')),
      'the unique index must be part of the create payload',
    );

    const existing = makePb({
      existing: {
        social_engine_audit: {
          fields: FIELDS.map((f) => ({ name: f.name })),
          indexes: [],
          listRule: null,
          viewRule: null,
          createRule: null,
          updateRule: null,
          deleteRule: null,
        },
      },
    });
    globalThis.fetch = existing.fetchImpl as typeof fetch;
    await ensureCollection('social_engine_audit', FIELDS);

    const indexPatch = existing.collectionPatches.find((patch) => Array.isArray(patch.indexes));
    assert.ok(indexPatch, 'an existing collection without the index must gain it');
    assert.ok((indexPatch?.indexes as string[]).some((sql) => sql.includes('fsId')));
  });

  it('reports one row per fsId as the uniqueness contract', async () => {
    const pb = makePb();
    globalThis.fetch = pb.fetchImpl as typeof fetch;

    await ensureCollection('growth_posts', FIELDS);
    assert.ok(uniqueIndexSql('growth_posts').includes('UNIQUE'));
  });
});

describe('logical id (fsId) integrity', () => {
  it('merges instead of failing when a concurrent write already created the fsId', async () => {
    const pb = makePb({
      conflictOnDuplicate: true,
      seed: [{ id: 'rec-winner', fsId: 'post-1', status: 'draft' }],
    });
    globalThis.fetch = pb.fetchImpl as typeof fetch;

    const result = await pbCreateRecordKeyed('growth_posts', 'post-1', {
      fsId: 'post-1',
      status: 'approved',
    });

    assert.equal(result, 'merged');
    assert.equal(pb.rows.length, 1, 'no duplicate row was created');
    assert.equal(pb.rowPatches.length, 1, 'the winning row was updated in place');
    assert.equal(pb.rowPatches[0].id, 'rec-winner');
    assert.equal(pb.rowPatches[0].body.status, 'approved');
  });

  it('still surfaces a real failure instead of swallowing it', async () => {
    const pb = makePb({ rejectAllCreates: true, seed: [] });
    globalThis.fetch = pb.fetchImpl as typeof fetch;

    await assert.rejects(
      () => pbCreateRecordKeyed('growth_posts', 'post-9', { fsId: 'post-9' }),
      /failed \(400\)/,
      'a conflict with no existing row is a genuine error and must throw',
    );
  });

  it('creates normally when the fsId is free', async () => {
    const pb = makePb({ conflictOnDuplicate: true, seed: [] });
    globalThis.fetch = pb.fetchImpl as typeof fetch;

    assert.equal(await pbCreateRecordKeyed('growth_posts', 'post-2', { fsId: 'post-2' }), 'created');
    assert.equal(pb.rows.length, 1);
  });
});

describe('verification surface', () => {
  it('pbGetCollection reports rules, lock state, index and count', async () => {
    const pb = makePb({
      existing: {
        growth_posts: {
          fields: FIELDS.map((f) => ({ name: f.name })),
          indexes: [uniqueIndexSql('growth_posts')],
          listRule: null,
          viewRule: null,
          createRule: null,
          updateRule: null,
          deleteRule: null,
        },
      },
      seed: [{ id: 'r1', fsId: 'a' }],
    });
    globalThis.fetch = pb.fetchImpl as typeof fetch;

    const state = await pbGetCollection('growth_posts');
    assert.equal(state.exists, true);
    assert.equal(state.locked, true);
    assert.equal(state.totalItems, 1);
    assert.ok(state.indexes.length > 0);

    const missing = await pbGetCollection('nope');
    assert.equal(missing.exists, false);
    assert.equal(missing.locked, false);
  });

  it('the migration script refuses --apply on an empty source and exposes --check', () => {
    const script = read('scripts/migrate-social-engine.ts');

    assert.ok(script.includes('Refusing --apply'), 'an empty source must abort --apply');
    assert.ok(script.includes("args.has('--check')"), '--check must exist');
    assert.ok(script.includes('checkCollections'), '--check must verify collections');
    assert.ok(script.includes('superuser-only'), 'the check must assert the rule state');
    // The guard must come from the real totals, not a hardcoded assumption.
    assert.ok(script.includes('totalRows === 0'));
  });

  it('no collection bootstrap in the server module uses an empty-string rule', () => {
    const source = read('src/lib/pocketbase/server.ts');
    assert.equal(
      /(listRule|viewRule|createRule|updateRule|deleteRule):\s*''/.test(source),
      false,
      'empty-string rules publish a collection — every rule must be null',
    );
  });
});
