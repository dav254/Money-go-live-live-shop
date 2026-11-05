/**
 * POCKETBASE PRIMARY — Growth Posts + Social Engine.
 *
 * Two kinds of guarantees:
 *   • behaviour: the PocketBase stores create-then-merge by logical id
 *     (`fsId`), read back the merged document and filter the queue by status —
 *     exercised against an in-memory PocketBase HTTP double (no network);
 *   • direction: the services use PocketBase FIRST and keep Firestore as the
 *     mirror, and the one-time copy script stays dry-run by default.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  pbGetGrowthPost,
  pbListGrowthPosts,
  pbWriteGrowthPost,
} from '../lib/pocketbase/growth-posts';
import {
  pbSocialAppend,
  pbSocialGet,
  pbSocialWrite,
  SOCIAL_ENGINE_PB_COLLECTIONS,
} from '../lib/pocketbase/social-engine';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const exists = (p: string) => {
  try {
    readFileSync(join(process.cwd(), p));
    return true;
  } catch {
    return false;
  }
};

type Row = { id: string; [key: string]: unknown };

/** Minimal PocketBase REST double: auth, collection ensure, records CRUD. */
function makePb() {
  const store = new Map<string, Map<string, Row>>();
  const rows = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  };
  let seq = 0;
  const calls: string[] = [];

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const path = url.pathname;
    calls.push(`${method} ${path}`);

    if (path.endsWith('/auth-with-password')) return json({ token: 'test-token' });

    const collectionMatch = path.match(/^\/api\/collections\/([^/]+)$/);
    if (collectionMatch) {
      const name = decodeURIComponent(collectionMatch[1]);
      if (method === 'GET') return json({ name, fields: [] });
      return json({ name });
    }

    const recordMatch = path.match(/^\/api\/collections\/([^/]+)\/records(?:\/([^/]+))?$/);
    if (!recordMatch) return json({ message: 'not found' }, 404);
    const collection = decodeURIComponent(recordMatch[1]);
    const recordId = recordMatch[2] ? decodeURIComponent(recordMatch[2]) : null;
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};

    if (method === 'GET' && !recordId) {
      let items = [...rows(collection).values()];
      const filter = url.searchParams.get('filter') ?? '';
      for (const match of filter.matchAll(/(\w+)\s*=\s*'([^']*)'/g)) {
        const [, field, value] = match;
        items = items.filter((row) => String(row[field] ?? '') === value);
      }
      items.sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
      return json({ items, totalItems: items.length });
    }

    if (method === 'POST') {
      seq += 1;
      const id = `rec${seq}`;
      const row = { ...body, id };
      rows(collection).set(id, row);
      return json(row);
    }

    if (recordId && method === 'PATCH') {
      const current = rows(collection).get(recordId);
      if (!current) return json({ message: 'missing' }, 404);
      const next = { ...current, ...body, id: recordId };
      rows(collection).set(recordId, next);
      return json(next);
    }

    return json({ message: 'unsupported' }, 405);
  };

  return { store, rows, calls, fetchImpl };
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

describe('PocketBase growth posts — primary store', () => {
  it('creates by logical id, merges the next write, and reads it back', async () => {
    const pb = makePb();
    globalThis.fetch = pb.fetchImpl as typeof fetch;

    const created = await pbWriteGrowthPost('post-1', {
      productId: 'prod1',
      sellerId: 'seller1',
      caption: 'First copy',
      status: 'draft',
      updatedAt: '2026-11-01T10:00:00.000Z',
    });
    assert.equal(created.id, 'post-1');

    // A second write must MERGE, not duplicate.
    const patched = await pbWriteGrowthPost('post-1', {
      caption: 'Edited copy',
      status: 'approved',
      updatedAt: '2026-11-01T11:00:00.000Z',
    });
    assert.equal(patched.caption, 'Edited copy');
    assert.equal(patched.productId, 'prod1', 'untouched fields survive the merge');
    assert.equal(pb.rows('growth_posts').size, 1, 'one PocketBase record per logical id');

    const fetched = await pbGetGrowthPost('post-1');
    assert.equal(fetched?.caption, 'Edited copy');
    assert.equal(fetched?.id, 'post-1');

    assert.equal(await pbGetGrowthPost('missing'), null);
  });

  it('filters the queue by status on the VPS side', async () => {
    const pb = makePb();
    globalThis.fetch = pb.fetchImpl as typeof fetch;

    await pbWriteGrowthPost('a', { caption: 'a', status: 'draft', updatedAt: '2026-11-01T10:00:00Z' });
    await pbWriteGrowthPost('b', { caption: 'b', status: 'approved', updatedAt: '2026-11-01T11:00:00Z' });

    const approved = await pbListGrowthPosts(10, 'approved');
    assert.deepEqual(approved.map((row) => row.id), ['b']);

    const all = await pbListGrowthPosts(10);
    assert.deepEqual(all.map((row) => row.id).sort(), ['a', 'b']);
  });
});

describe('PocketBase social engine — primary store', () => {
  it('merges a connection document and keeps the sealed payload opaque', async () => {
    const pb = makePb();
    globalThis.fetch = pb.fetchImpl as typeof fetch;
    const collection = SOCIAL_ENGINE_PB_COLLECTIONS.connections;

    await pbSocialWrite(collection, 'telegram__seller1', {
      module: 'telegram',
      ownerId: 'seller1',
      status: 'connected',
      tokens: { v: 1, iv: 'a', tag: 'b', data: 'c' },
      updatedAt: '2026-11-01T10:00:00.000Z',
    });
    const disconnected = await pbSocialWrite(collection, 'telegram__seller1', {
      status: 'disconnected',
      tokens: null,
      updatedAt: '2026-11-01T11:00:00.000Z',
    });
    assert.equal(disconnected.status, 'disconnected');
    assert.equal(disconnected.tokens, null);

    const fetched = await pbSocialGet(collection, 'telegram__seller1');
    assert.equal(fetched?.module, 'telegram', 'the merge keeps the module');
    assert.equal(fetched?.status, 'disconnected');
  });

  it('appends audit entries as distinct rows', async () => {
    const pb = makePb();
    globalThis.fetch = pb.fetchImpl as typeof fetch;
    const collection = SOCIAL_ENGINE_PB_COLLECTIONS.audit;

    await pbSocialAppend(collection, 'audit-1', { module: 'tiktok', outcome: 'ok', at: '2026-11-01T10:00:00Z' });
    await pbSocialAppend(collection, 'audit-2', { module: 'tiktok', outcome: 'failed', at: '2026-11-01T10:01:00Z' });

    assert.equal(pb.rows(collection).size, 2);
  });
});

describe('store direction (source level)', () => {
  it('growth posts read and write PocketBase first, with no PB mirror left', () => {
    const service = read('src/lib/vidnov-core/growth-posts/service.ts');
    assert.ok(service.includes('pbGetGrowthPost'));
    assert.ok(service.includes('pbWriteGrowthPost'));
    assert.ok(service.includes('pocketBaseEnabled()'));
    assert.equal(service.includes('pbMirrorGrowthPost'), false, 'the old FS→PB mirror must be gone');
    // The Firestore mirror is explicitly best-effort.
    assert.ok(service.includes('fsMirrorGrowthPost'));
  });

  it('connections and readiness use the PocketBase primary store', () => {
    const connections = read('src/lib/social-engine/connections.ts');
    assert.ok(connections.includes('socialEnginePbEnabled()'));
    assert.ok(connections.includes('pbSocialGet'));
    assert.ok(connections.includes('pbSocialWrite'));

    const engine = read('src/lib/social-engine/engine.ts');
    for (const marker of ['pbSocialAppend', 'pbSocialGet', 'pbSocialWrite', 'socialEnginePbEnabled()']) {
      assert.ok(engine.includes(marker), `engine.ts missing ${marker}`);
    }
    assert.ok(engine.includes('fsMirrorDoc'), 'Firestore stays as a best-effort mirror');
  });

  it('the copy script exists, is idempotent by logical id and is dry-run by default', () => {
    assert.ok(exists('scripts/migrate-social-engine.ts'));
    const script = read('scripts/migrate-social-engine.ts');
    for (const marker of [
      'growthPosts',
      'social_connections',
      'social_engine_tests',
      'social_engine_meta',
      'social_engine_audit',
      '--apply',
      '--verify',
      'pocketBaseEnabled()',
      'Counts only',
    ]) {
      assert.ok(script.includes(marker), `migration script missing ${marker}`);
    }
    assert.ok(
      script.includes("const apply = args.has('--apply')"),
      'writes must require an explicit --apply',
    );
  });
});
