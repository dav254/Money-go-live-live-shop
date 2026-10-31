/**
 * THE AI EXPOSURE ENGINE — structured data, machine surfaces, index pings.
 *
 *   • every graph is built from REAL document fields only: a missing price,
 *     description, image or stock number is OMITTED, never invented;
 *   • `aggregateRating` is never emitted, even for a doc that carries a
 *     rating — reviews live inside a tab here, and half-true markup is
 *     worse than none (see `src/lib/seo/json-ld.ts` header);
 *   • availability is conservative: explicit out-of-stock or a real stock
 *     number on a non-service decides; unknown states stay silent;
 *   • "get a quote" listings get NO offer (a published price of 0 would be
 *     a number the seller never set);
 *   • serialization escapes `<` so no listing text can close the script tag;
 *   • the machine surfaces report an honest source and never fabricate rows;
 *   • IndexNow: own flag, public key served at the path the payload claims,
 *     no fetch at all when the flag is off, status-only logging;
 *   • the route heads only emit metadata/JSON-LD for VERIFIED public docs.
 *
 * Run: npx tsx --test src/tests/ai-exposure.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  absUrl,
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildProductJsonLd,
  buildShopJsonLd,
  cleanText,
  productImageUrls,
  resolveOffer,
  schemaAvailability,
  serializeJsonLd,
} from '../lib/seo/json-ld';
import { publicOrigin } from '../lib/site-url';
import {
  buildLlmsText,
  buildProductsPayload,
  toProductEntry,
  toShopEntry,
} from '../lib/seo/catalogue-feed';
import { INDEXNOW_KEY, INDEXNOW_KEY_PATH, pingIndexNow } from '../lib/seo/indexnow';
import { SITEMAP_ORIGIN } from '../lib/sitemap-entries';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/**
 * The origin under test — derived, never hardcoded, so the suite passes
 * whether the workspace overrides `NEXT_PUBLIC_SITE_URL` or not (the
 * sitemap hardcodes its own origin; these builders are env-driven).
 */
const ORIGIN = publicOrigin();

type Doc = Record<string, unknown>;

const REAL_PRODUCT: Doc = {
  sellerId: 'seller-1',
  name: 'Handwoven Kiondo Basket',
  description: 'A sturdy market basket, woven by hand.\nDurable and light.',
  category: 'Home',
  price: 1500,
  imageUrl: 'https://cdn.example.com/basket.jpg',
  condition: 'new',
  stock: 4,
  status: 'active',
};

const REAL_SHOP: Doc = {
  shopName: 'Nairobi Weaves',
  description: 'Handmade homeware from Nairobi.',
  logoUrl: '/icons/icon-192.png',
  facebookUrl: 'https://facebook.com/nairobeweaves',
  county: 'Nairobi',
  cityTown: 'Westlands',
  contactPhone: '+254 700 000 000',
};

/* ── product graph: real data only ───────────────────────────────────────── */

describe('product JSON-LD only claims what the document says', () => {
  it('builds a full graph for a complete listing', () => {
    const graph = buildProductJsonLd(REAL_PRODUCT, 'prod1');
    assert.ok(graph);
    assert.equal(graph['@type'], 'Product');
    assert.equal(graph.name, 'Handwoven Kiondo Basket');
    assert.equal(graph.url, `${ORIGIN}/products/prod1`);
    const offer = graph.offers as Doc;
    assert.equal(offer.price, '1500');
    assert.equal(offer.priceCurrency, 'USD');
    assert.equal(offer.availability, 'https://schema.org/InStock');
    assert.equal(offer.itemCondition, 'https://schema.org/NewCondition');
    assert.deepEqual(graph.image, ['https://cdn.example.com/basket.jpg']);
  });

  it('returns null without a name (no anonymous product graphs)', () => {
    assert.equal(buildProductJsonLd({ price: 10 }, 'x'), null);
    assert.equal(buildProductJsonLd({ name: '   ' }, 'x'), null);
  });

  it('omits the offer entirely when the price is missing, invalid or quote-mode', () => {
    const cases: Doc[] = [
      { ...REAL_PRODUCT, price: undefined },
      { ...REAL_PRODUCT, price: -5 },
      { ...REAL_PRODUCT, price: 'lots' },
      { ...REAL_PRODUCT, priceMode: 'quote' },
      { ...REAL_PRODUCT, price: 0, priceMode: 'quote' },
    ];
    for (const doc of cases) {
      const graph = buildProductJsonLd(doc, 'p');
      assert.ok(graph);
      assert.equal('offers' in graph, false, `no offer for ${JSON.stringify(doc.price ?? doc.priceMode)}`);
    }
  });

  it('omits description, brand, category, seller and media that do not exist', () => {
    const graph = buildProductJsonLd({ name: 'Plain' }, 'p');
    assert.ok(graph);
    for (const key of ['description', 'brand', 'category', 'seller', 'image', 'video']) {
      assert.equal(key in graph, false, `${key} must be omitted, not defaulted`);
    }
  });

  it('never emits aggregateRating or review — even for a doc that has ratings', () => {
    const graph = buildProductJsonLd(
      { ...REAL_PRODUCT, rating: 4.8, reviewsCount: 912, aggregateRating: { ratingValue: 4.8 } },
      'p',
    );
    assert.ok(graph);
    assert.equal('aggregateRating' in graph, false);
    assert.equal('review' in graph, false);
    const offer = graph.offers as Doc;
    assert.equal('aggregateRating' in offer, false);
  });

  it('keeps local price/currency exactly as the page displays them', () => {
    const offer = resolveOffer({ price: 100, localPrice: 2500, localCurrency: 'kes' });
    assert.deepEqual(offer, { price: 2500, currency: 'KES' });
    // A malformed currency falls back to the page's own default, never a claim.
    assert.equal(resolveOffer({ price: 10, localCurrency: 'shillings' })?.currency, 'USD');
  });
});

/* ── availability: conservative by design ────────────────────────────────── */

describe('availability is only emitted when unambiguous', () => {
  it('maps explicit out-of-stock and real stock numbers', () => {
    assert.equal(schemaAvailability({ availabilityState: 'out_of_stock' }), 'https://schema.org/OutOfStock');
    assert.equal(schemaAvailability({ stock: 3 }), 'https://schema.org/InStock');
    assert.equal(schemaAvailability({ stock: 0 }), 'https://schema.org/OutOfStock');
  });

  it('never treats a service at 0 stock as unsellable', () => {
    assert.equal(schemaAvailability({ stock: 0, listingType: 'service' }), null);
  });

  it('stays silent for unknown or ambiguous states', () => {
    for (const doc of [{}, { stock: 'many' }, { availabilityState: 'on_request' }]) {
      assert.equal(schemaAvailability(doc), null, JSON.stringify(doc));
    }
  });
});

/* ── media + url hygiene ─────────────────────────────────────────────────── */

describe('media urls must be absolute and sane', () => {
  it('resolves root-relative paths against the public origin and drops other schemes', () => {
    assert.equal(absUrl('/media/a.jpg'), `${ORIGIN}/media/a.jpg`);
    assert.equal(absUrl('https://cdn.example.com/x.png'), 'https://cdn.example.com/x.png');
    assert.equal(absUrl('javascript:alert(1)'), null);
    assert.equal(absUrl('data:image/png;base64,AAA'), null);
    assert.equal(absUrl('   '), null);
    assert.equal(absUrl(42), null);
  });

  it('collects the primary image first, dedupes, and ignores non-urls', () => {
    const urls = productImageUrls({
      imageUrl: '/a.jpg',
      imageUrls: ['/a.jpg', 'https://cdn.example.com/b.jpg', 'ftp://nope', ''],
    });
    assert.deepEqual(urls, [`${ORIGIN}/a.jpg`, 'https://cdn.example.com/b.jpg']);
  });

  it('builds VideoObject entries only for real https video urls', () => {
    const graph = buildProductJsonLd(
      { ...REAL_PRODUCT, videoUrl: 'https://cdn.example.com/clip.mp4', videoUrls: ['not-a-url'] },
      'p',
    );
    assert.ok(graph);
    const videos = graph.video as Doc[];
    assert.equal(videos.length, 1);
    assert.equal(videos[0]['@type'], 'VideoObject');
    assert.equal(videos[0].contentUrl, 'https://cdn.example.com/clip.mp4');
  });
});

/* ── shop + organization + breadcrumb ────────────────────────────────────── */

describe('shop and site graphs stay truthful', () => {
  it('builds a Store with logo, address, phone and sameAs from real links', () => {
    const graph = buildShopJsonLd(REAL_SHOP, 'seller-1');
    assert.ok(graph);
    assert.equal(graph['@type'], 'Store');
    assert.equal(graph.name, 'Nairobi Weaves');
    assert.equal(graph.image, `${ORIGIN}/icons/icon-192.png`);
    assert.deepEqual(graph.sameAs, ['https://facebook.com/nairobeweaves']);
    assert.equal((graph.address as Doc).addressLocality, 'Westlands');
    assert.equal(graph.telephone, '+254 700 000 000');
    assert.equal('aggregateRating' in graph, false);
  });

  it('needs a shop name, and drops non-http social links', () => {
    assert.equal(buildShopJsonLd({ county: 'Nairobi' }, 's1'), null);
    const graph = buildShopJsonLd({ shopName: 'X', facebookUrl: 'javascript:evil' }, 's1');
    assert.ok(graph);
    assert.equal('sameAs' in graph, false);
  });

  it('organization graph carries identity and a real search action', () => {
    const graph = buildOrganizationJsonLd();
    assert.equal(graph.name, 'Vidnov');
    assert.equal(graph.url, ORIGIN);
    const action = (graph.potentialAction as Doc).target as Doc;
    assert.ok(String(action.urlTemplate).includes('/search?q='));
  });

  it('breadcrumbs need at least a home and a current page', () => {
    assert.equal(buildBreadcrumbJsonLd([{ name: 'Only', url: 'https://x' }]), null);
    const crumbs = buildBreadcrumbJsonLd([
      { name: 'Vidnov', url: `${ORIGIN}/` },
      { name: 'Basket', url: `${ORIGIN}/products/p1` },
    ]);
    assert.ok(crumbs);
    const items = crumbs.itemListElement as Doc[];
    assert.equal(items.length, 2);
    assert.equal(items[0].position, 1);
    assert.equal(items[1].name, 'Basket');
  });

  it('no listing text can close the JSON-LD script tag', () => {
    const graph = buildProductJsonLd(
      { ...REAL_PRODUCT, name: 'Evil </script><script>alert(1)</script>' },
      'p',
    );
    const html = serializeJsonLd(graph);
    assert.equal(html.includes('<'), false, 'raw < must be escaped');
    assert.ok(html.includes('\\u003c'));
    assert.doesNotThrow(() => JSON.parse(html.replace(/\\u003c/g, '<')));
  });
});

/* ── machine surfaces ────────────────────────────────────────────────────── */

describe('llms.txt and products.json serve only real catalogue rows', () => {
  it('entries need a name; price/media/availability ride along only if real', () => {
    const product = toProductEntry('p1', REAL_PRODUCT);
    assert.ok(product);
    assert.equal(product.url, `${ORIGIN}/products/p1`);
    assert.equal(product.price, 1500);
    assert.equal(product.availability, 'https://schema.org/InStock');
    assert.equal(toProductEntry('p2', { price: 10 }), null);

    const shop = toShopEntry('s1', REAL_SHOP);
    assert.ok(shop);
    assert.equal(shop.name, 'Nairobi Weaves');
    assert.deepEqual(shop.sameAs, ['https://facebook.com/nairobeweaves']);
    assert.equal(toShopEntry('s2', {}), null);
  });

  it('llms.txt follows the convention: H1, summary blockquote, markdown links', () => {
    const text = buildLlmsText({
      products: [toProductEntry('p1', REAL_PRODUCT)!],
      shops: [toShopEntry('s1', REAL_SHOP)!],
      source: 'pocketbase',
    });
    const lines = text.split('\n');
    assert.equal(lines[0], '# Vidnov');
    assert.ok(lines[1] === '');
    assert.ok(text.includes('> '));
    assert.ok(text.includes('## Products'));
    assert.ok(text.includes('## Shops'));
    assert.ok(text.includes(`- [Handwoven Kiondo Basket](${ORIGIN}/products/p1): USD 1500 · Home`));
    assert.ok(text.includes(`- [Nairobi Weaves](${ORIGIN}/sellers/s1)`));
    assert.ok(text.includes(`Sitemap: ${SITEMAP_ORIGIN}/sitemap.xml`));
  });

  it('an empty catalogue says so instead of inventing entries', () => {
    const text = buildLlmsText({ products: [], shops: [], source: 'firestore' });
    assert.ok(text.includes('No public listings are available at this moment.'));
    assert.equal(text.includes('- ['), false);
    const payload = JSON.parse(buildProductsPayload({ products: [], shops: [], source: 'firestore' }));
    assert.equal(payload.productCount, 0);
    assert.equal(payload.source, 'firestore');
    assert.ok(payload.generatedAt);
  });

  it('bracket-hostile names cannot break the markdown list', () => {
    const entry = toProductEntry('p1', { ...REAL_PRODUCT, name: 'Weird [x] (y) [name]' });
    const text = buildLlmsText({ products: [entry!], shops: [], source: 'pocketbase' });
    const line = text.split('\n').find((l) => l.startsWith('- ['))!;
    assert.ok(line.startsWith(`- [Weird x y name](${ORIGIN}/products/p1)`));
  });
});

/* ── index pings ─────────────────────────────────────────────────────────── */

describe('IndexNow stays opt-in, keyless-in-secret and never throws', () => {
  it('does not touch the network while its own flag is off', async () => {
    const previous = process.env.INDEXNOW_ENABLED;
    delete process.env.INDEXNOW_ENABLED;
    let called = 0;
    const fake = (async () => {
      called += 1;
      return { ok: true, status: 200 };
    }) as unknown as typeof fetch;
    try {
      const result = await pingIndexNow(['/products/p1'], fake);
      assert.deepEqual(result, { sent: false, reason: 'disabled' });
      assert.equal(called, 0);
      process.env.INDEXNOW_ENABLED = 'true';
      const sent = await pingIndexNow(['/products/p1'], fake);
      assert.equal(sent.sent, true);
      assert.equal(called, 1);
    } finally {
      if (previous === undefined) delete process.env.INDEXNOW_ENABLED;
      else process.env.INDEXNOW_ENABLED = previous;
    }
  });

  it('submits a payload whose key and keyLocation match the public file', async () => {
    const previous = process.env.INDEXNOW_ENABLED;
    process.env.INDEXNOW_ENABLED = 'TRUE';
    const captured: { body: Record<string, unknown> | null } = { body: null };
    const fake = (async (_url: unknown, init?: RequestInit) => {
      captured.body = JSON.parse(String(init?.body));
      return { ok: true, status: 200 };
    }) as unknown as typeof fetch;
    try {
      await pingIndexNow(['/products/p1', '/products/p2'], fake);
      assert.ok(captured.body);
      assert.equal(captured.body.host, new URL(ORIGIN).hostname);
      assert.equal(captured.body.key, INDEXNOW_KEY);
      assert.equal(captured.body.keyLocation, `${ORIGIN}${INDEXNOW_KEY_PATH}`);
      assert.deepEqual(captured.body.urlList, [
        `${ORIGIN}/products/p1`,
        `${ORIGIN}/products/p2`,
      ]);
      // The key is 32 hex characters — the protocol's shape, not a secret.
      assert.match(INDEXNOW_KEY, /^[0-9a-f]{32}$/);
    } finally {
      if (previous === undefined) delete process.env.INDEXNOW_ENABLED;
      else process.env.INDEXNOW_ENABLED = previous;
    }
  });

  it('ignores non-site paths and reports network failures without throwing', async () => {
    const previous = process.env.INDEXNOW_ENABLED;
    process.env.INDEXNOW_ENABLED = 'true';
    try {
      const none = await pingIndexNow(['https://evil.example.com/x', 'products/p'], (async () =>
        ({ ok: true, status: 200 }) as unknown as Response) as typeof fetch);
      assert.deepEqual(none, { sent: false, reason: 'no-urls' });
      const failed = await pingIndexNow(['/products/p1'], (async () => {
        throw new Error('boom with secrets');
      }) as unknown as typeof fetch);
      assert.deepEqual(failed, { sent: false, reason: 'network' });
    } finally {
      if (previous === undefined) delete process.env.INDEXNOW_ENABLED;
      else process.env.INDEXNOW_ENABLED = previous;
    }
  });

  it('never submits private, admin, login or user-specific URLs', async () => {
    const previous = process.env.INDEXNOW_ENABLED;
    process.env.INDEXNOW_ENABLED = 'true';
    const captured: { body: Record<string, unknown> | null } = { body: null };
    const fake = (async (_url: unknown, init?: RequestInit) => {
      captured.body = JSON.parse(String(init?.body));
      return { ok: true, status: 200 };
    }) as unknown as typeof fetch;
    try {
      const result = await pingIndexNow(
        [
          '/products/ok1',
          '/dashboard/admin',
          '/admin',
          '/admin-login-net',
          '/auth/login',
          '/api/products',
          '/seller/x', // segment-aware: must NOT match the public /sellers/x
          '/cart',
          '/buyer/orders',
          '/app/seller',
          '/verify-email?token=secret-reset-token',
          '/products/ok2?ref=tracking',
          '/products/ok2',
          '/products/ok1', // duplicate
          'garbage',
          '',
          '/products/has space', // whitespace → not a valid public URL
          `${ORIGIN}/products/absolute-input`, // absolute URLs are not accepted from callers
        ],
        fake,
      );
      assert.equal(result.sent, true);
      assert.ok(captured.body);
      assert.deepEqual(captured.body.urlList, [
        `${ORIGIN}/products/ok1`,
        `${ORIGIN}/products/ok2`,
      ]);

      // A batch made ONLY of private paths never leaves the process.
      let called = 0;
      const counting = (async () => {
        called += 1;
        return { ok: true, status: 200 };
      }) as unknown as typeof fetch;
      const allPrivate = await pingIndexNow(['/dashboard', '/auth/x', '/api/y'], counting);
      assert.deepEqual(allPrivate, { sent: false, reason: 'no-urls' });
      assert.equal(called, 0);
    } finally {
      if (previous === undefined) delete process.env.INDEXNOW_ENABLED;
      else process.env.INDEXNOW_ENABLED = previous;
    }
  });
});

/* ── route / layout wiring (source level) ────────────────────────────────── */

describe('the exposure surfaces are wired the way the engine requires', () => {
  const productLayout = read('src/app/products/[productId]/layout.tsx');
  const shopLayout = read('src/app/sellers/[sellerId]/layout.tsx');
  const rootLayout = read('src/app/layout.tsx');
  const llmsRoute = read('src/app/llms.txt/route.ts');
  const feedRoute = read('src/app/products.json/route.ts');
  const keyRoute = read('src/app/indexnow-key.txt/route.ts');
  const syncRoute = read('src/app/api/products/sync/route.ts');
  const studioRoute = read('src/app/api/video-studio/publish/route.ts');
  const shopSyncRoute = read('src/app/api/shops/sync/route.ts');

  it('both segment layouts emit metadata and JSON-LD from a server component', () => {
    for (const [name, src] of [['product', productLayout], ['shop', shopLayout]] as const) {
      assert.ok(src.includes('generateMetadata'), `${name} layout exports generateMetadata`);
      assert.ok(src.includes('application/ld+json'), `${name} layout emits JSON-LD`);
      assert.ok(src.includes("state === 'public'"), `${name} graph only for verified public docs`);
      assert.equal(src.includes("'use client'"), false, `${name} layout must stay a server component`);
    }
    assert.ok(productLayout.includes('index: false'), 'absent/hidden products are noindexed');
    // Canonical URLs: both segments point at the exact public URL (the
    // origin comes from publicOrigin, which now matches the live redirect
    // target and the sitemap origin).
    assert.ok(productLayout.includes('alternates: { canonical: url }'), 'product canonical emitted');
    assert.ok(shopLayout.includes('alternates: { canonical: url }'), 'shop canonical emitted');
    assert.ok(productLayout.includes('publicUrl(`/products/${productId}`)'));
    assert.ok(shopLayout.includes('publicUrl(`/sellers/${sellerId}`)'));
  });

  it('the product layout noindexes missing AND hidden, but never `unknown`', () => {
    assert.ok(productLayout.includes("listing.state === 'missing' || listing.state === 'hidden'"));
    assert.equal(/state === 'unknown'[\s\S]*index: false/.test(productLayout), false);
  });

  it('the root layout carries the site organization graph once', () => {
    assert.ok(rootLayout.includes('buildOrganizationJsonLd()'));
    assert.ok(rootLayout.includes('serializeJsonLd('));
    assert.ok(rootLayout.includes('type="application/ld+json"'));
  });

  it('machine routes force dynamic rendering and honest content types', () => {
    assert.ok(llmsRoute.includes("text/plain; charset=utf-8"));
    assert.ok(llmsRoute.includes('force-dynamic'));
    assert.ok(feedRoute.includes('application/json; charset=utf-8'));
    assert.ok(feedRoute.includes('force-dynamic'));
    assert.ok(keyRoute.includes('INDEXNOW_KEY'));
    assert.ok(keyRoute.includes('text/plain'));
  });

  it('listing create/edit/delete paths ping the index (flag-gated inside)', () => {
    assert.ok(syncRoute.includes('pingIndexNow(`') || syncRoute.includes("pingIndexNow([`/products/${productId}`]"), 'sync route pings');
    assert.equal(syncRoute.includes('void pingIndexNow'), true, 'fire-and-forget');
    assert.ok(studioRoute.includes('void pingIndexNow([`/products/${productId}`])'));
  });

  it('shop create/edit pings the public storefront URL, and only that', () => {
    assert.ok(
      shopSyncRoute.includes('void pingIndexNow([`/sellers/${shopId}`])'),
      'shops/sync notifies the public shop page',
    );
    // No seller data leaves the app: the ping payload is paths only — the
    // helper builds URLs from them, and the route never passes document data.
    assert.equal(shopSyncRoute.includes('pingIndexNow(['), true);
    assert.equal(/pingIndexNow\(\[[^\]]*data/.test(shopSyncRoute), false, 'never ping document bodies');
  });

  it('the manual one-shot command is wired as a package script', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
    assert.equal(pkg.scripts?.['ping:search'], 'tsx scripts/ping-indexnow.ts');
    const script = read('scripts/ping-indexnow.ts');
    assert.ok(script.includes('pingIndexNow'), 'reuses the shared ping helper');
    assert.ok(script.includes("process.env.INDEXNOW_ENABLED = 'true'"), '--force overrides the flag for one run');
    assert.ok(script.includes('INDEXNOW_ENABLED is not'), 'flag-off run explains itself');
    assert.ok(script.includes('/indexnow-key.txt'), 'reminds about the key file before deploy');
  });
});
