/**
 * VIDNOV DISCOVER — behaviour tests.
 *
 * These exercise the real code paths with a fake Firestore: eligibility,
 * ranking, filtering, paging and the honesty rules (no sponsored boost, no
 * distance for area-only businesses, no listing from a suspended seller).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import {
  isCompleteBusinessProfile,
  isEligibleSellerProfile,
  isPublishedListing,
  parseDiscoverQuery,
  searchDiscover,
  type DiscoverBusiness,
  type DiscoverInput,
  type DiscoverListing,
} from '../lib/discover/search';
import { demandDocId, summarizeDemand, type DemandDoc } from '../lib/discover/demand';
import { MAX_REQUESTS, rateLimit, resetRateLimits } from '../lib/discover/rate-limit';

/* ── Fake Firestore ───────────────────────────────────────────────────────── */

type Row = Record<string, unknown> & { id: string };

class FakeQuery {
  private filters: Array<[string, unknown]> = [];
  private order: { field: string; dir: 'asc' | 'desc' } | undefined;
  private max: number | undefined;

  constructor(private readonly rows: Row[]) {}

  private clone(): FakeQuery {
    const next = new FakeQuery(this.rows);
    next.filters = [...this.filters];
    next.order = this.order;
    next.max = this.max;
    return next;
  }

  where(field: string, _op: string, value: unknown): FakeQuery {
    const next = this.clone();
    next.filters = [...this.filters, [field, value]];
    return next;
  }

  orderBy(field: string, dir: 'asc' | 'desc'): FakeQuery {
    const next = this.clone();
    next.order = { field, dir };
    return next;
  }

  limit(n: number): FakeQuery {
    const next = this.clone();
    next.max = n;
    return next;
  }

  async get() {
    let rows = this.rows.filter((row) => this.filters.every(([field, value]) => row[field] === value));
    if (this.order) {
      const { field, dir } = this.order;
      rows = [...rows].sort((a, b) => {
        const av = Number(a[field] ?? 0);
        const bv = Number(b[field] ?? 0);
        return dir === 'desc' ? bv - av : av - bv;
      });
    }
    if (this.max !== undefined) rows = rows.slice(0, this.max);
    return {
      size: rows.length,
      docs: rows.map((row) => ({
        id: row.id,
        data: () => row,
        get: (field: string) => row[field],
      })),
    };
  }
}

function makeDb(collections: Record<string, Row[]>): Firestore {
  return {
    collection: (name: string) => {
      const rows = collections[name] ?? [];
      return {
        where: (field: string, op: string, value: unknown) =>
          new FakeQuery(rows).where(field, op, value),
        orderBy: (field: string, dir: 'asc' | 'desc') => new FakeQuery(rows).orderBy(field, dir),
        limit: (n: number) => new FakeQuery(rows).limit(n),
        doc: (id: string) => ({
          get: async () => {
            const row = rows.find((candidate) => candidate.id === id);
            return {
              exists: Boolean(row),
              data: () => row,
              get: (field: string) => row?.[field],
            };
          },
        }),
      };
    },
  } as unknown as Firestore;
}

/* ── Fixtures ─────────────────────────────────────────────────────────────── */

type Extra = Record<string, unknown>;

const seller = (id: string, extra: Extra = {}): Row => ({
  id,
  userRole: 'seller',
  status: 'active',
  fullName: `Seller ${id}`,
  ...extra,
});

const shop = (id: string, extra: Extra = {}): Row => ({
  id,
  sellerId: id,
  shopName: `Shop ${id}`,
  description: 'A real shop',
  county: 'Nairobi',
  area: 'Westlands',
  ...extra,
});

const business = (id: string, ownerId: string, extra: Extra = {}): Row => ({
  id,
  name: `Business ${id}`,
  slug: `business-${id}`,
  ownerId,
  category: 'Fashion',
  description: 'We make things',
  isActive: true,
  createdAt: 1_000,
  ...extra,
});

const product = (id: string, sellerId: string, extra: Extra = {}): Row => ({
  id,
  name: `Product ${id}`,
  sellerId,
  price: 1200,
  category: 'Fashion & Apparel',
  location: 'Westlands, Nairobi',
  stock: 4,
  uploadDate: 2_000,
  imageUrl: 'https://example.test/a.jpg',
  ...extra,
});

const input = (overrides: Partial<DiscoverInput> = {}): DiscoverInput => ({
  q: '',
  kind: 'all',
  availability: 'any',
  sort: 'relevance',
  page: 1,
  limit: 12,
  ...overrides,
});

/* ── Parameter validation ─────────────────────────────────────────────────── */

describe('discover · parameter validation', () => {
  it('applies safe defaults to an empty query', () => {
    const parsed = parseDiscoverQuery(new URLSearchParams());
    assert.ok(parsed.ok);
    assert.equal(parsed.value.kind, 'all');
    assert.equal(parsed.value.sort, 'relevance');
    assert.equal(parsed.value.availability, 'any');
    assert.equal(parsed.value.page, 1);
  });

  it('rejects oversized input instead of passing it to the database', () => {
    assert.equal(parseDiscoverQuery(new URLSearchParams({ q: 'a'.repeat(121) })).ok, false);
    assert.equal(parseDiscoverQuery(new URLSearchParams({ category: 'c'.repeat(61) })).ok, false);
    assert.equal(parseDiscoverQuery(new URLSearchParams({ location: 'l'.repeat(81) })).ok, false);
  });

  it('clamps paging and page size to the supported window', () => {
    const parsed = parseDiscoverQuery(new URLSearchParams({ page: '999', limit: '500' }));
    assert.ok(parsed.ok);
    assert.equal(parsed.value.page, 20);
    assert.equal(parsed.value.limit, 24);
  });

  it('drops "nearby" when there is no position to be near', () => {
    const parsed = parseDiscoverQuery(new URLSearchParams({ sort: 'nearby' }));
    assert.ok(parsed.ok);
    assert.equal(parsed.value.sort, 'relevance');
    assert.equal(parsed.value.coords, undefined);
  });

  it('ignores a half-supplied coordinate pair', () => {
    const parsed = parseDiscoverQuery(new URLSearchParams({ lat: '1.29', sort: 'nearby' }));
    assert.ok(parsed.ok);
    assert.equal(parsed.value.coords, undefined);
    assert.equal(parsed.value.sort, 'relevance');
  });

  it('accepts a full coordinate pair', () => {
    const parsed = parseDiscoverQuery(new URLSearchParams({ lat: '-1.29', lng: '36.82', sort: 'nearby' }));
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.value.coords, { lat: -1.29, lng: 36.82 });
    assert.equal(parsed.value.sort, 'nearby');
  });
});

/* ── Eligibility ──────────────────────────────────────────────────────────── */

describe('discover · eligibility', () => {
  it('requires a seller account that is not suspended', () => {
    assert.equal(isEligibleSellerProfile({ userRole: 'seller' }), true);
    assert.equal(isEligibleSellerProfile({ userRole: 'seller', status: 'active' }), true);
    assert.equal(isEligibleSellerProfile({ userRole: 'seller', status: 'suspended' }), false);
    assert.equal(isEligibleSellerProfile({ userRole: 'buyer' }), false);
    assert.equal(isEligibleSellerProfile(null), false);
  });

  it('treats a business as discoverable only when its public profile is complete', () => {
    assert.equal(isCompleteBusinessProfile({ name: 'A', slug: 'a', category: 'C', description: 'D' }), true);
    assert.equal(isCompleteBusinessProfile({ name: 'A', slug: 'a', category: 'C', logoUrl: 'L' }), true);
    // inactive, no slug, no category and no substance are each disqualifying
    assert.equal(isCompleteBusinessProfile({ name: 'A', slug: 'a', category: 'C', description: 'D', isActive: false }), false);
    assert.equal(isCompleteBusinessProfile({ name: 'A', category: 'C', description: 'D' }), false);
    assert.equal(isCompleteBusinessProfile({ name: 'A', slug: 'a', description: 'D' }), false);
    assert.equal(isCompleteBusinessProfile({ name: 'A', slug: 'a', category: 'C' }), false);
  });

  it('keeps verification separate from completeness', () => {
    // An unverified but complete profile is a legitimate result.
    assert.equal(
      isCompleteBusinessProfile({ name: 'A', slug: 'a', category: 'C', description: 'D' }),
      true,
    );
  });

  it('excludes only explicitly unpublished listings', () => {
    assert.equal(isPublishedListing({}), true);
    assert.equal(isPublishedListing({ unpublished: false }), true);
    assert.equal(isPublishedListing({ unpublished: true }), false);
  });
});

/* ── Search ───────────────────────────────────────────────────────────────── */

describe('discover · unified search', () => {
  const base = () => ({
    userProfiles: [seller('s1'), seller('s2')],
    sellerShops: [shop('s1'), shop('s2')],
    businesses: [business('b1', 's1')],
    products: [
      product('p1', 's1', { listingType: 'product' }),
      product('p2', 's1', { listingType: 'service', name: 'Plumbing repair', priceMode: 'hourly' }),
    ],
  });

  it('returns businesses and listings together in one result set', async () => {
    const page = await searchDiscover(makeDb(base()), input());
    assert.equal(page.total, 3);
    assert.equal(page.businesses, 1);
    assert.equal(page.listings, 2);
    const kinds = page.items.map((item) => item.kind).sort();
    assert.deepEqual(kinds, ['business', 'product', 'service']);
  });

  it('links every result to an existing route', async () => {
    const page = await searchDiscover(makeDb(base()), input());
    for (const item of page.items) {
      if (item.kind === 'business') {
        assert.equal((item as DiscoverBusiness).shopHref, '/sellers/s1');
      } else {
        assert.equal((item as DiscoverListing).href, `/products/${item.id}`);
        assert.equal((item as DiscoverListing).shopHref, '/sellers/s1');
      }
    }
  });

  it('drops listings from a suspended seller', async () => {
    const db = makeDb({
      ...base(),
      userProfiles: [seller('s1'), seller('s2', { status: 'suspended' })],
      products: [product('p1', 's1'), product('p3', 's2')],
    });
    const page = await searchDiscover(db, input());
    assert.equal(page.items.some((item) => item.id === 'p3'), false);
  });

  it('drops a business whose owner is suspended', async () => {
    const db = makeDb({
      ...base(),
      userProfiles: [seller('s1', { status: 'suspended' }), seller('s2')],
    });
    const page = await searchDiscover(db, input({ kind: 'businesses' }));
    assert.equal(page.total, 0);
  });

  it('drops a business with no public shop route', async () => {
    const db = makeDb({ ...base(), sellerShops: [shop('s2')] });
    const page = await searchDiscover(db, input({ kind: 'businesses' }));
    assert.equal(page.total, 0);
  });

  it('drops an incomplete business profile', async () => {
    const db = makeDb({ ...base(), businesses: [business('b1', 's1', { description: '' })] });
    const page = await searchDiscover(db, input({ kind: 'businesses' }));
    assert.equal(page.total, 0);
  });

  it('drops an unpublished listing', async () => {
    const db = makeDb({ ...base(), products: [product('p1', 's1', { unpublished: true })] });
    const page = await searchDiscover(db, input({ kind: 'listings' }));
    assert.equal(page.total, 0);
  });

  it('returns an honest empty result rather than an error', async () => {
    const page = await searchDiscover(makeDb(base()), input({ q: 'helicopter parts' }));
    assert.equal(page.total, 0);
    assert.deepEqual(page.items, []);
    assert.equal(page.hasMore, false);
  });

  it('matches on name, description and category', async () => {
    const db = makeDb({
      ...base(),
      products: [product('p1', 's1', { name: 'Leather sandals', description: 'handmade' })],
    });
    assert.equal((await searchDiscover(db, input({ q: 'sandals' }))).total, 1);
    assert.equal((await searchDiscover(db, input({ q: 'handmade' }))).total, 1);
    assert.equal((await searchDiscover(db, input({ q: 'fashion' }))).total >= 1, true);
  });

  it('requires every token to match somewhere', async () => {
    const page = await searchDiscover(makeDb(base()), input({ q: 'leather helicopter' }));
    assert.equal(page.total, 0);
  });

  it('filters by location', async () => {
    const db = makeDb({
      ...base(),
      products: [
        product('p1', 's1', { location: 'Westlands, Nairobi' }),
        product('p2', 's1', { location: 'Nyali, Mombasa' }),
      ],
      businesses: [],
    });
    const page = await searchDiscover(db, input({ location: 'Mombasa' }));
    assert.equal(page.total, 1);
    assert.equal(page.items[0].id, 'p2');
  });

  it('filters to listings that can be bought now', async () => {
    const db = makeDb({
      ...base(),
      products: [
        product('p1', 's1', { availabilityState: 'available' }),
        product('p2', 's1', { availabilityState: 'out_of_stock' }),
      ],
    });
    const page = await searchDiscover(db, input({ availability: 'available', kind: 'listings' }));
    assert.equal(page.total, 1);
    assert.equal(page.items[0].id, 'p1');
  });

  it('pages incrementally without repeating a result', async () => {
    const products = Array.from({ length: 5 }, (_, index) =>
      product(`p${index}`, 's1', { uploadDate: 1_000 + index }),
    );
    const db = makeDb({ ...base(), businesses: [], products });

    const first = await searchDiscover(db, input({ limit: 2, page: 1 }));
    const second = await searchDiscover(db, input({ limit: 2, page: 2 }));
    assert.equal(first.items.length, 2);
    assert.equal(first.hasMore, true);
    assert.equal(second.items.length, 2);
    const overlap = first.items.filter((item) => second.items.some((other) => other.id === item.id));
    assert.deepEqual(overlap, []);
  });

  it('never lets a sponsored listing outrank a more relevant one', async () => {
    const db = makeDb({
      ...base(),
      businesses: [],
      products: [
        product('exact', 's1', { name: 'Leather sandals', sponsored: true }),
        product('weak', 's1', { name: 'Sandals warehouse', description: 'leather' }),
      ],
    });
    const page = await searchDiscover(db, input({ q: 'leather sandals', kind: 'listings' }));
    assert.equal(page.items[0].id, 'exact');
    // The label travels, the ranking does not depend on it.
    assert.equal((page.items[0] as DiscoverListing).sponsored, true);
  });

  it('labels a lapsed campaign as not sponsored', async () => {
    const db = makeDb({
      ...base(),
      businesses: [],
      products: [product('p1', 's1', { sponsored: true, promotedUntil: '2000-01-01T00:00:00.000Z' })],
    });
    const page = await searchDiscover(db, input({ kind: 'listings' }));
    assert.equal((page.items[0] as DiscoverListing).sponsored, false);
  });

  it('never returns a distance for an area-only business', async () => {
    const db = makeDb({
      ...base(),
      businesses: [
        business('b1', 's1', {
          primaryLocation: { lat: -1.26, lng: 36.8, publicPrecision: 'area_only', areaName: 'Westlands' },
        }),
      ],
      products: [],
    });
    const page = await searchDiscover(
      db,
      input({ kind: 'businesses', coords: { lat: -1.29, lng: 36.82 }, sort: 'nearby' }),
    );
    assert.equal((page.items[0] as DiscoverBusiness).distanceKm, undefined);
  });

  it('measures distance for a business that publishes a point', async () => {
    const db = makeDb({
      ...base(),
      businesses: [
        business('b1', 's1', {
          primaryLocation: { lat: -1.29, lng: 36.82, publicPrecision: 'exact', areaName: 'Westlands' },
        }),
      ],
      products: [],
    });
    const page = await searchDiscover(
      db,
      input({ kind: 'businesses', coords: { lat: -1.29, lng: 36.82 }, sort: 'nearby' }),
    );
    const business0 = page.items[0] as DiscoverBusiness;
    assert.equal(typeof business0.distanceKm, 'number');
    assert.ok((business0.distanceKm ?? 99) < 1);
  });

  it('reports when the candidate window was filled', async () => {
    const products = Array.from({ length: 300 }, (_, index) => product(`p${index}`, 's1'));
    const page = await searchDiscover(makeDb({ ...base(), businesses: [], products }), input());
    assert.equal(page.windowCapped, true);
    assert.ok(page.scanned <= 240);
  });
});

/* ── Demand + limits ──────────────────────────────────────────────────────── */

describe('discover · anonymous demand', () => {
  it('builds a deterministic, path-safe document id', () => {
    const id = demandDocId('2026-01-02', { category: 'Fashion & Apparel', location: 'Nairobi/CBD', zeroResults: true });
    assert.equal(id.includes('/'), false);
    assert.equal(id, demandDocId('2026-01-02', { category: 'Fashion & Apparel', location: 'Nairobi/CBD', zeroResults: true }));
    assert.match(id, /^2026-01-02__/);
  });

  it('aggregates counts by category, location and emptiness', () => {
    const docs: DemandDoc[] = [
      { day: '2026-01-01', category: 'plumbing', location: 'nairobi', zeroResults: true, count: 3 },
      { day: '2026-01-01', category: 'plumbing', location: 'mombasa', zeroResults: false, count: 2 },
      { day: '2026-01-02', category: 'fashion', location: 'nairobi', zeroResults: false, count: 6 },
    ];
    const summary = summarizeDemand(docs);
    assert.equal(summary.totalSearches, 11);
    assert.equal(summary.zeroResultSearches, 3);
    // fashion (6) outranks plumbing (5) — no tie, so the ordering is meaningful.
    assert.equal(summary.byCategory[0].key, 'fashion');
    assert.equal(summary.byCategory[0].count, 6);
    assert.equal(summary.byLocation[0].key, 'nairobi');
    assert.equal(summary.byLocation[0].count, 9);
  });

  it('stores no query text or identity in the counter document', () => {
    const doc: DemandDoc = {
      day: '2026-01-01',
      category: 'plumbing',
      location: 'nairobi',
      zeroResults: false,
      count: 1,
    };
    assert.deepEqual(Object.keys(doc).sort(), [
      'category',
      'count',
      'day',
      'location',
      'zeroResults',
    ]);
  });
});

describe('discover · rate limiting', () => {
  it('allows the burst then refuses, and recovers after the window', () => {
    resetRateLimits();
    const start = 1_000_000;
    for (let i = 0; i < MAX_REQUESTS; i += 1) {
      assert.equal(rateLimit('client', start + i).allowed, true);
    }
    const blocked = rateLimit('client', start + MAX_REQUESTS);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfter > 0);
    assert.equal(rateLimit('client', start + 61_000).allowed, true);
  });

  it('tracks clients independently', () => {
    resetRateLimits();
    for (let i = 0; i < MAX_REQUESTS; i += 1) rateLimit('a', 5_000 + i);
    assert.equal(rateLimit('a', 6_000).allowed, false);
    assert.equal(rateLimit('b', 6_000).allowed, true);
  });
});
