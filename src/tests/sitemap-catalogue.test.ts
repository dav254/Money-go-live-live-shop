/**
 * SITEMAP CATALOGUE — discovery rules under the failure modes that actually
 * happen in production.
 *
 * Covers the four required classes:
 *   1. Firestore quota errors (RESOURCE_EXHAUSTED) never break the sitemap
 *   2. PocketBase catalogue reads — visibility, tombstones, fsId hygiene,
 *      suspended-owner deny-set
 *   3. Pagination — full walks, exact stopping, protocol caps
 *   4. Empty catalogues — fall through, never fabricated ids
 *
 * The last test is an end-to-end round trip through the REAL PocketBase HTTP
 * client (`pbListRecordsPage` → auth → paginated records) against an in-process
 * mock server, so the wire contract itself is exercised, not just the logic.
 * The mock binds an ephemeral 127.0.0.1 port and the env vars it needs are
 * set and restored inside the test process only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  isPublicListingDoc,
  readPocketBaseCatalogue,
  resolveCatalogue,
  SITEMAP_MAX_PRODUCTS,
  SITEMAP_MAX_SHOPS,
  type CatalogueIds,
  type CataloguePage,
  type PageFetcher,
} from '../lib/sitemap-catalogue';
import { buildSitemapEntries, SITEMAP_ORIGIN } from '../lib/sitemap-entries';

/* --------------------------------------------------------------------------- */
/* Test helpers                                                                */
/* --------------------------------------------------------------------------- */

type RecordedCall = { collection: string; page: number; filter?: string; sort?: string };

/** A fetcher serving pre-baked pages per collection, recording every call. */
function recordingFetcher(
  pages: Record<string, CataloguePage[]>,
): PageFetcher & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchPage = (async (collection: string, params: { page: number; perPage: number; filter?: string; sort?: string }) => {
    calls.push({ collection, page: params.page, filter: params.filter, sort: params.sort });
    const list = pages[collection] ?? [];
    return list[params.page - 1] ?? { items: [], totalItems: 0 };
  }) as PageFetcher;
  return Object.assign(fetchPage, { calls });
}

function pocketbase(source: Partial<CatalogueIds> = {}): CatalogueIds {
  return {
    productIds: [],
    shopIds: [],
    updatedAtById: {},
    source: 'pocketbase',
    ...source,
  };
}

function firestore(source: Partial<CatalogueIds> = {}): CatalogueIds {
  return {
    productIds: [],
    shopIds: [],
    updatedAtById: {},
    source: 'firestore',
    ...source,
  };
}

/* --------------------------------------------------------------------------- */
/* 1. Firestore quota errors                                                   */
/* --------------------------------------------------------------------------- */

test('a Firestore quota error never breaks a working PocketBase catalogue', async () => {
  const pb = pocketbase({ productIds: ['prodA'], shopIds: ['sellerB'] });
  const result = await resolveCatalogue({
    fromPocketBase: async () => pb,
    fromFirestore: async () => {
      throw new Error(
        'RESOURCE_EXHAUSTED: Quota exceeded for quota "firestore.allFields.indexes" on collection "products"',
      );
    },
  });
  assert.equal(result, pb, 'PocketBase catalogue must be served despite the quota error');
});

test('quota-exhausted Firestore + failed PocketBase → null (route serves core sitemap)', async () => {
  const result = await resolveCatalogue({
    fromPocketBase: async () => {
      throw new Error('PocketBase list "products" failed (503): connection refused');
    },
    fromFirestore: async () => {
      throw new Error('RESOURCE_EXHAUSTED: Quota exceeded');
    },
  });
  assert.equal(result, null, 'both sources failing must yield null, not fabricated ids');
});

test('a failed PocketBase read falls back to Firestore', async () => {
  const fs = firestore({ productIds: ['prodFromFs'] });
  const result = await resolveCatalogue({
    fromPocketBase: async () => null,
    fromFirestore: async () => fs,
  });
  assert.equal(result, fs);
});

/* --------------------------------------------------------------------------- */
/* 2. PocketBase catalogue reads                                              */
/* --------------------------------------------------------------------------- */

test('PocketBase catalogue applies the app visibility rules and id hygiene', async () => {
  const fetchPage = recordingFetcher({
    products: [
      {
        totalItems: 6,
        items: [
          // ✓ good listing
          {
            id: 'row1',
            fsId: 'prodGood',
            status: 'active',
            sellerId: 'u1',
            updated: '2026-10-05T00:00:00.000Z',
            data: { sellerId: 'u1', name: 'Good', price: 10, updatedAt: '2026-09-30T12:00:00.000Z' },
          },
          // ✗ tombstoned mirror row
          { id: 'row2', fsId: 'prodTomb', status: 'deleted', data: null },
          // ✗ explicit opt-out flag
          { id: 'row3', fsId: 'prodHidden', status: 'active', data: { hidden: true, sellerId: 'u1' } },
          // ✗ draft status
          { id: 'row4', fsId: 'prodDraft', status: 'active', data: { status: 'draft', sellerId: 'u1' } },
          // ✗ no fsId → would produce a URL for a page that does not exist
          { id: 'row5', status: 'active', data: { sellerId: 'u1' } },
          // ✗ data payload missing → visibility cannot be verified
          { id: 'row6', fsId: 'prodNoData', status: 'active' },
        ],
      },
    ],
    seller_shops: [
      {
        totalItems: 4,
        items: [
          // ✓ good storefront (fsId IS the owner uid)
          { id: 'rowA', fsId: 'u2', ownerId: 'u2', data: { shopName: 'Two' } },
          // ✗ owner suspended (deny-set below)
          { id: 'rowB', fsId: 'u3', ownerId: 'u3', data: { shopName: 'Three' } },
          // ✗ no owner id at all
          { id: 'rowC', data: { shopName: 'NoOwner' } },
          // ✗ private visibility
          { id: 'rowD', fsId: 'u4', data: { shopName: 'Private', visibility: 'private' } },
        ],
      },
    ],
    user_profiles: [{ totalItems: 1, items: [{ uid: 'u3' }] }],
  });

  const catalogue = await readPocketBaseCatalogue(fetchPage);
  assert.ok(catalogue, 'catalogue must be produced');
  assert.equal(catalogue.source, 'pocketbase');
  assert.deepEqual(catalogue.productIds, ['prodGood']);
  assert.deepEqual(catalogue.shopIds, ['u2'], 'suspended / ownerless / private shops excluded');
  assert.equal(
    catalogue.updatedAtById['prodGood'],
    '2026-09-30T12:00:00.000Z',
    'lastmod prefers the document timestamp over the mirror write',
  );

  // The tombstone filter is pushed to the server AND re-checked client-side.
  const productCall = fetchPage.calls.find((c) => c.collection === 'products');
  assert.equal(productCall?.filter, "status != 'deleted'");
  assert.equal(productCall?.sort, '-createdAt');
});

test('Firestore-style documents follow the same public visibility rules', () => {
  assert.equal(isPublicListingDoc({ name: 'ok', price: 1, sellerId: 'u' }), true);
  assert.equal(isPublicListingDoc({ status: 'deleted' }), false);
  assert.equal(isPublicListingDoc({ status: 'unpublished' }), false);
  assert.equal(isPublicListingDoc({ status: 'archived' }), false);
  assert.equal(isPublicListingDoc({ listed: false }), false);
  assert.equal(isPublicListingDoc({ isActive: false }), false);
  assert.equal(isPublicListingDoc({ visibility: 'private' }), false);
});

/* --------------------------------------------------------------------------- */
/* 3. Pagination                                                               */
/* --------------------------------------------------------------------------- */

test('pagination walks every page and stops exactly at the collection end', async () => {
  const makeRows = (count: number, offset: number): CataloguePage['items'] =>
    Array.from({ length: count }, (_, i) => ({
      id: `row${offset + i}`,
      fsId: `prod${offset + i}`,
      status: 'active',
      sellerId: 'u1',
      data: { sellerId: 'u1', name: `P${offset + i}` },
    }));

  const fetchPage = recordingFetcher({
    products: [
      { items: makeRows(500, 0), totalItems: 1200 },
      { items: makeRows(500, 500), totalItems: 1200 },
      { items: makeRows(200, 1000), totalItems: 1200 },
    ],
  });

  const catalogue = await readPocketBaseCatalogue(fetchPage);
  assert.ok(catalogue);
  assert.equal(catalogue.productIds.length, 1200, 'every page collected');
  assert.equal(catalogue.productIds[0], 'prod0');
  assert.equal(catalogue.productIds[1199], 'prod1199');

  const pagesRequested = fetchPage.calls
    .filter((c) => c.collection === 'products')
    .map((c) => c.page);
  assert.deepEqual(pagesRequested, [1, 2, 3], 'exactly three pages, no extra fetch');
});

test('caps bound the walk even when totalItems claims a huge catalogue', async () => {
  const fullPage = (offset: number): CataloguePage => ({
    items: Array.from({ length: 500 }, (_, i) => ({
      id: `row${offset + i}`,
      fsId: `prod${offset + i}`,
      status: 'active',
      sellerId: 'u1',
      data: { sellerId: 'u1', name: `P${offset + i}` },
    })),
    totalItems: 1_000_000, // deliberately dishonest upper bound
  });
  const fetchPage = recordingFetcher({
    products: Array.from({ length: 40 }, (_, i) => fullPage(i * 500)),
  });

  const catalogue = await readPocketBaseCatalogue(fetchPage);
  assert.ok(catalogue);
  assert.equal(catalogue.productIds.length, SITEMAP_MAX_PRODUCTS, 'product cap enforced');
  assert.ok(SITEMAP_MAX_PRODUCTS + SITEMAP_MAX_SHOPS <= 5000, 'caps stay under the 5,000-entry slice');
  const pagesRequested = fetchPage.calls.filter((c) => c.collection === 'products').length;
  assert.ok(pagesRequested <= 40, `hard page stop respected, got ${pagesRequested} pages`);
});

/* --------------------------------------------------------------------------- */
/* 4. Empty catalogues                                                        */
/* --------------------------------------------------------------------------- */

test('an empty PocketBase catalogue falls through to Firestore', async () => {
  const fs = firestore({ productIds: ['prodFromFs'] });
  const result = await resolveCatalogue({
    fromPocketBase: async () => pocketbase(),
    fromFirestore: async () => fs,
  });
  assert.equal(result, fs, 'an empty mirror must not hide a populated Firestore');
});

test('both sources empty → truthful empty catalogue, homepage-only sitemap', async () => {
  const result = await resolveCatalogue({
    fromPocketBase: async () => pocketbase(),
    fromFirestore: async () => firestore(),
  });
  assert.ok(result, 'an empty-but-successful read is still a result');
  assert.deepEqual(result.productIds, []);
  assert.deepEqual(result.shopIds, []);
  // The sitemap document then contains exactly the homepage — no invented ids.
  const entries = buildSitemapEntries(result);
  assert.deepEqual(entries, [{ url: SITEMAP_ORIGIN }]);
});

test('no sources at all → null (route serves the core document)', async () => {
  assert.equal(await resolveCatalogue({}), null);
  const entries = buildSitemapEntries({ productIds: [], shopIds: [] });
  assert.deepEqual(entries, [{ url: SITEMAP_ORIGIN }]);
});

test('unconfigured PocketBase (missing env) reports null instead of throwing', async () => {
  const saved = {
    url: process.env.POCKETBASE_URL,
    email: process.env.POCKETBASE_ADMIN_EMAIL,
    password: process.env.POCKETBASE_ADMIN_PASSWORD,
  };
  delete process.env.POCKETBASE_URL;
  delete process.env.POCKETBASE_ADMIN_EMAIL;
  delete process.env.POCKETBASE_ADMIN_PASSWORD;
  try {
    assert.equal(await readPocketBaseCatalogue(), null, 'disabled → null, caller falls back');
  } finally {
    if (saved.url !== undefined) process.env.POCKETBASE_URL = saved.url;
    if (saved.email !== undefined) process.env.POCKETBASE_ADMIN_EMAIL = saved.email;
    if (saved.password !== undefined) process.env.POCKETBASE_ADMIN_PASSWORD = saved.password;
  }
});

/* --------------------------------------------------------------------------- */
/* 5. End-to-end: the real PocketBase HTTP client against a mock server        */
/* --------------------------------------------------------------------------- */

test('default fetcher authenticates and paginates over real HTTP', async () => {
  const TOTAL_PRODUCTS = 700;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const json = (body: unknown) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(body));
    };
    if (req.method === 'POST' && url.pathname.endsWith('/auth-with-password')) {
      json({ token: 'test-token' });
      return;
    }
    if (url.pathname === '/api/collections/products/records') {
      const page = Number(url.searchParams.get('page') ?? '1');
      const perPage = Number(url.searchParams.get('perPage') ?? '100');
      const start = (page - 1) * perPage;
      const items = [];
      for (let i = start; i < Math.min(start + perPage, TOTAL_PRODUCTS); i++) {
        items.push({
          id: `row${i}`,
          fsId: `prod${i}`,
          status: 'active',
          sellerId: 'u1',
          updated: '2026-10-01T00:00:00.000Z',
          data: { sellerId: 'u1', name: `Product ${i}`, price: 5 },
        });
      }
      json({ items, totalItems: TOTAL_PRODUCTS, page, perPage });
      return;
    }
    if (url.pathname === '/api/collections/seller_shops/records') {
      json({
        items: [{ id: 'rowS', fsId: 'uSeller', ownerId: 'uSeller', data: { shopName: 'Shop' } }],
        totalItems: 1,
      });
      return;
    }
    if (url.pathname === '/api/collections/user_profiles/records') {
      json({ items: [], totalItems: 0 });
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ message: 'Not found' }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  const saved = {
    url: process.env.POCKETBASE_URL,
    email: process.env.POCKETBASE_ADMIN_EMAIL,
    password: process.env.POCKETBASE_ADMIN_PASSWORD,
  };
  process.env.POCKETBASE_URL = `http://127.0.0.1:${port}`;
  process.env.POCKETBASE_ADMIN_EMAIL = 'catalogue-test@example.com';
  process.env.POCKETBASE_ADMIN_PASSWORD = 'catalogue-test-password';

  try {
    const catalogue = await readPocketBaseCatalogue();
    assert.ok(catalogue, 'HTTP read must succeed');
    assert.equal(catalogue.source, 'pocketbase');
    assert.equal(catalogue.productIds.length, TOTAL_PRODUCTS, 'both pages collected over HTTP');
    assert.ok(catalogue.productIds.includes('prod0'));
    assert.ok(catalogue.productIds.includes('prod699'));
    assert.deepEqual(catalogue.shopIds, ['uSeller']);
    assert.equal(catalogue.updatedAtById['uSeller'], undefined, 'shop had no doc timestamp');
  } finally {
    if (saved.url === undefined) delete process.env.POCKETBASE_URL;
    else process.env.POCKETBASE_URL = saved.url;
    if (saved.email === undefined) delete process.env.POCKETBASE_ADMIN_EMAIL;
    else process.env.POCKETBASE_ADMIN_EMAIL = saved.email;
    if (saved.password === undefined) delete process.env.POCKETBASE_ADMIN_PASSWORD;
    else process.env.POCKETBASE_ADMIN_PASSWORD = saved.password;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
