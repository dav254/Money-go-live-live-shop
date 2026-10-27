/**
 * SHOPS, CARTS AND SAVED METHODS MUST SURVIVE A FIRESTORE OUTAGE.
 *
 * ## The failure this file exists to prevent
 *
 * The catalog was mirrored to the VPS, but three things that hang off it were
 * not:
 *
 *   • `sellerShops/{uid}` — the storefront. Discovery, the buyer dashboard,
 *     invoices and the LIVE grid all read it, so a Firestore outage hid every
 *     shop while its listings survived.
 *   • `userProfiles/{uid}/cart` — read directly by both cart screens at
 *     checkout. An empty answer reads as "my cart was wiped".
 *   • `userProfiles/{uid}/paymentMethods|payoutMethods` — the destinations a
 *     payout is sent to. The `payments`/`payouts` ledgers were mirrored; the
 *     account details they point at were not.
 *
 * Mirroring is only half of it: a mirror nobody calls, a sync route that
 * trusts the request body, or a helper that throws instead of returning false
 * would all leave the same hole. These tests are the stop.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  SHOPS_COLLECTION,
  pbGetShop,
  pbListShops,
  pbMirrorShop,
} from '../lib/pocketbase/shops';
import {
  USER_DATA_COLLECTION,
  USER_DATA_SUBCOLLECTION,
  pbDeleteUserDoc,
  pbListUserDocs,
  pbMirrorUserDoc,
} from '../lib/pocketbase/user-data';

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

/** The cart screens that write `userProfiles/{uid}/cart`. */
const CART_WRITE_SITES = [
  'src/app/cart/page.tsx',
  'src/app/app/buyer/cart/page.tsx',
  'src/app/app/buyer/product/[productId]/page.tsx',
  'src/app/products/[productId]/page.tsx',
  'src/components/feed/product-drawer.tsx',
  'src/components/discovery/discovery-details.tsx',
  'src/components/seller/product-card.tsx',
  'src/components/buyer/LiveProductCard.tsx',
  'src/components/products/product-card.tsx',
  'src/components/live/PinnedProduct.tsx',
  'src/components/live/LiveProductCard.tsx',
];

/** The screens that write `sellerShops/{uid}`. */
const SHOP_WRITE_SITES = [
  'src/components/app/seller/shop-branding-section.tsx',
  'src/components/account/account-shop-profile.tsx',
  'src/app/app/seller/account/page.tsx',
  'src/app/dashboard/seller/settings/page.tsx',
];

describe('the VPS mirror degrades instead of throwing', () => {
  it('every helper reports "not configured" when PocketBase is off', async () => {
    const saved: Record<string, string | undefined> = {};
    for (const key of POCKETBASE_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    try {
      assert.equal(await pbMirrorShop('uid-1', { shopName: 'Test' }), false);
      assert.equal(await pbGetShop('uid-1'), null);
      assert.equal(await pbListShops(), null);

      assert.equal(await pbMirrorUserDoc('cart', 'uid-1', 'prod-1', { quantity: 1 }), false);
      assert.equal(await pbDeleteUserDoc('cart', 'uid-1', 'prod-1'), false);
      assert.equal(await pbListUserDocs('cart', 'uid-1'), null);
      assert.equal(await pbListUserDocGuard(), true);
    } finally {
      for (const key of POCKETBASE_KEYS) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
      }
    }
  });

  it('each per-user set has its own collection, keyed by owner + doc id', () => {
    // A cart line's id is a PRODUCT id, so it repeats across buyers: without
    // `userId` in every filter one buyer's cart could be served to another.
    assert.deepEqual(Object.keys(USER_DATA_COLLECTION).sort(), [
      'cart',
      'paymentMethod',
      'payoutMethod',
    ]);
    assert.equal(new Set(Object.values(USER_DATA_COLLECTION)).size, 3);
    assert.equal(USER_DATA_SUBCOLLECTION.cart, 'cart');
    assert.equal(USER_DATA_SUBCOLLECTION.paymentMethod, 'paymentMethods');
    assert.equal(USER_DATA_SUBCOLLECTION.payoutMethod, 'payoutMethods');
    assert.notEqual(SHOPS_COLLECTION, USER_DATA_COLLECTION.cart);
  });
});

/**
 * The per-user module must pin BOTH keys on every single-document filter —
 * asserted from its source. The list filter pins the owner alone on purpose
 * (that is the tenancy query); anything naming a document must name its owner
 * too, or one buyer's cart line could be read, patched or removed for another.
 */
function pbListUserDocGuard(): boolean {
  const source = readCode('src/lib/pocketbase/user-data.ts');
  const filters = source.match(/filter: `[^`]*`/g) ?? [];
  const byDocument = filters.filter((f) => f.includes('fsId = '));
  return (
    filters.length >= 3 &&
    byDocument.length === 2 &&
    byDocument.every((f) => f.includes('userId = '))
  );
}

describe('the sync routes verify the caller and never trust the body', () => {
  it('users/sync authenticates before it touches anything', () => {
    const fn = readCode('src/app/api/users/sync/route.ts');
    const post = fn.slice(fn.indexOf('export async function POST'));
    assert.ok(post.includes('if (!user) return'), 'unauthenticated callers are rejected');
    assert.ok(
      post.indexOf('verifyRequestUser') < post.indexOf('const ref = db'),
      'the caller must be verified before the document path is built',
    );
    assert.ok(
      post.indexOf('if (!user) return') < post.indexOf('const ref = db'),
      'a rejected caller never reaches the document path',
    );
  });

  it('users/sync builds the path from the verified uid only', () => {
    const source = readCode('src/app/api/users/sync/route.ts');
    assert.ok(source.includes(".collection('userProfiles')"), 'the path starts at the profile collection');
    assert.ok(
      source.includes('.doc(user.uid)'),
      'the profile segment must come from the verified token, never the body',
    );
    // The body may carry kind/id/action — nothing that identifies an account.
    const bodyBlock = source.slice(source.indexOf('= (await request.json()'), source.indexOf('const action'));
    for (const forbidden of ['uid', 'userId', 'sellerId', 'buyerId']) {
      assert.equal(
        bodyBlock.includes(forbidden),
        false,
        `users/sync must not accept "${forbidden}" from the request body`,
      );
    }
  });

  it('users/sync validates kind and id before doing any work', () => {
    const source = readCode('src/app/api/users/sync/route.ts');
    assert.ok(source.includes('Invalid kind'), 'unknown kinds are rejected');
    assert.ok(source.includes('Invalid id'), 'empty/oversized ids are rejected');
    assert.ok(source.includes("id.includes('/')"), 'a path separator in the id is rejected');
    assert.ok(source.includes('length > 128'), 'ids are length-bounded');
  });

  it('users/sync reads the document server-side and scrubs it for JSON', () => {
    const source = readCode('src/app/api/users/sync/route.ts');
    assert.ok(
      source.includes('scrubForPocketBase'),
      'Firestore Timestamps must be converted before the PocketBase round-trip',
    );
    // The payload carries only kind/id/action — no document content.
    assert.equal(
      /\bbody\.(data|content|item|method)\b/.test(source),
      false,
      'document content must never be accepted from the client',
    );
  });

  it('shops/sync defaults to the caller and gates any other shop on admin', () => {
    const source = readCode('src/app/api/shops/sync/route.ts');
    assert.ok(
      source.includes('body.shopId ?? user.uid'),
      'the shop id defaults to the seller’s own uid (the doc id IS the owner)',
    );
    assert.ok(source.includes("shopId !== user.uid && !(await isAdmin(user.uid))"), 'naming another seller’s shop requires admin');
    assert.ok(source.includes('verifyRequestUser'), 'the caller must be authenticated');
    assert.ok(source.includes('scrubForPocketBase'), 'the document is scrubbed server-side');
    assert.equal(
      source.includes('body.data'),
      false,
      'shop content must never be accepted from the client',
    );
  });

  it('cart reads are VPS-first, uid-scoped and silent', () => {
    const source = readCode('src/app/api/cart/route.ts');
    assert.ok(source.includes('if (!user) return'), 'unauthenticated callers are rejected');
    const get = source.slice(source.indexOf('export async function GET'));
    assert.ok(
      get.indexOf('pbListUserDocs') < get.indexOf("collection('userProfiles')"),
      'the VPS copy must be tried before Firestore',
    );
    assert.ok(source.includes('.doc(user.uid)'), 'the cart read is scoped to the caller');
    assert.equal(source.includes('console.log'), false, 'cart contents are never logged');
    assert.ok(source.includes('503'), 'both stores failing is reported, not hidden');
  });
});

describe('the client mirrors are fire-and-forget', () => {
  it('neither helper ever blocks the user or leaks a token', () => {
    for (const rel of ['src/lib/users/mirror.ts', 'src/lib/shops/mirror.ts']) {
      const source = readCode(rel);
      assert.ok(source.includes('void callSync'), `${rel} must not await the mirror call`);
      assert.ok(source.includes('keepalive: true'), `${rel} must survive page navigation`);
      assert.ok(source.includes('Authorization: `Bearer ${token}`'), `${rel} must authenticate`);
      assert.equal(source.includes('console.log'), false, `${rel} must not log the token`);
      assert.equal(
        /export function mirror\w+\([^)]*\)[^{]*\{[^}]*await /.test(source),
        false,
        `${rel} must never make the caller wait for the mirror`,
      );
    }
  });

  it('the shop mirror sends only an id, never the shop document', () => {
    const source = readCode('src/lib/shops/mirror.ts');
    assert.ok(source.includes("body: JSON.stringify(shopId ? { shopId } : {})"));
  });
});

describe('every write site keeps its VPS copy current', () => {
  for (const rel of CART_WRITE_SITES) {
    it(`${rel} mirrors the cart line it writes`, () => {
      const source = read(rel);
      assert.ok(
        source.includes('mirrorCartItem('),
        `${rel} writes userProfiles/{uid}/cart without calling mirrorCartItem`,
      );
    });
  }

  it('both cart screens mirror removals too', () => {
    for (const rel of ['src/app/cart/page.tsx', 'src/app/app/buyer/cart/page.tsx']) {
      const source = read(rel);
      assert.ok(
        source.includes('mirrorCartItemDelete('),
        `${rel} deletes a cart line without dropping the VPS copy`,
      );
    }
  });

  for (const rel of SHOP_WRITE_SITES) {
    it(`${rel} mirrors the shop it writes`, () => {
      const source = read(rel);
      assert.ok(
        source.includes('mirrorShop('),
        `${rel} writes sellerShops/{uid} without calling mirrorShop`,
      );
    });
  }

  it('every payout/payment method screen mirrors the method', () => {
    const payoutSites = [
      'src/app/dashboard/seller/wallet/page.tsx',
      'src/app/dashboard/reseller/wallet/page.tsx',
      'src/app/app/seller/payments/page.tsx',
    ];
    for (const rel of payoutSites) {
      assert.ok(
        read(rel).includes('mirrorPayoutMethod('),
        `${rel} writes payoutMethods without mirroring it`,
      );
    }
    assert.ok(
      read('src/app/buyer/wallet/page.tsx').includes('mirrorPaymentMethod('),
      'src/app/buyer/wallet/page.tsx writes paymentMethods without mirroring it',
    );
  });
});

describe('the backfills are safe to run on the live database', () => {
  it('shops re-run without duplicating anything', () => {
    const source = readCode('scripts/migrate-shops.ts');
    assert.ok(source.includes("db.collection('sellerShops')"), 'it copies the real shop collection');
    assert.ok(source.includes("fields: 'fsId'"), 'already-migrated shops are skipped by Firestore id');
    assert.ok(source.includes('skipped++'), 're-runs skip rather than rewrite');
    assert.ok(source.includes('getPocketBaseConfig()'), 'it refuses to run unconfigured');
  });

  it('per-user data only copies documents under a userProfiles parent', () => {
    const source = readCode('scripts/migrate-user-data.ts');
    assert.ok(
      source.includes("profile?.parent?.id === 'userProfiles'"),
      'a collection-group hit with any other parent must be ignored',
    );
    assert.ok(source.includes('userId:'), 're-runs skip by owner + document id');
    assert.ok(source.includes('collectionGroup('), 'subcollections are read in one query per set');
    assert.equal(source.includes('process.env.POCKETBASE_ADMIN_PASSWORD ='), false);
  });
});
