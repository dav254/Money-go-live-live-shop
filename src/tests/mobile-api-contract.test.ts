/**
 * MOBILE API CONTRACT.
 *
 * The Android app is a second frontend over the SAME backend. That only works
 * if every endpoint it calls actually exists — a typo in a path is invisible
 * until a phone shows an error, because nothing on the web build touches these
 * routes.
 *
 * So this test pins the contract from both ends:
 *
 *   • every endpoint the app uses resolves to a `route.ts` on disk;
 *   • the public projection strips seller-only and moderation fields, because
 *     the whole point of the `/api/mobile/*` layer is that raw documents never
 *     reach a device.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { projectListing, projectSeller } from '../lib/mobile/public-listing';

const ROOT = process.cwd();

/**
 * Endpoints the Android client depends on. Paths use the app-router directory
 * names (dynamic segments keep their bracket names), so this is a direct
 * filesystem assertion rather than a string match against the client.
 */
const REQUIRED_ROUTES = [
  // added for the mobile client
  'mobile/listing/[id]',
  'mobile/catalog',
  'mobile/orders',
  'mobile/seller/overview',
  'mobile/chats',
  'mobile/saved',
  'account/delete-request',
  // existing shared backend the app reuses
  'search',
  'home/live',
  'public/business/[sellerId]',
  'auth/profile',
  'chat',
  'chat/[chatId]/messages',
  'notifications',
  'notifications/read-all',
  'notifications/[id]',
  'requests',
  'requests/offers',
  'seller/orders',
  'seller/orders/[orderId]/status',
  'products/mine',
  'ai/generate',
  'ai/jobs',
  'media/upload',
  'live',
];

test('every endpoint the Android app calls exists', () => {
  const missing = REQUIRED_ROUTES.filter(
    (route) => !existsSync(path.join(ROOT, 'src', 'app', 'api', ...route.split('/'), 'route.ts')),
  );
  assert.deepEqual(missing, [], `endpoints the app calls but the backend lacks:\n${missing.join('\n')}`);
});

test('the android client has no endpoint outside the audited list', () => {
  const client = readFileSync(path.join(ROOT, 'mobile', 'src', 'lib', 'api.ts'), 'utf8');

  // Every literal `/api/...` path in the client, template placeholders removed.
  const called = new Set<string>();
  for (const match of client.matchAll(/['"`](\/api\/[^'"`?]*(?:\?[^'"`]*)?)['"`]/g)) {
    const raw = match[1].split('?')[0];
    // Skip anything that is not a literal route: doc comments describe the
    // surface with globs (`/api/mobile/*`), which are prose, not calls.
    if (raw.includes('*')) continue;
    called.add(raw);
  }

  assert.ok(called.size > 0, 'expected the client to call the API');

  for (const calledPath of called) {
    const known = REQUIRED_ROUTES.some((route) => {
      const base = `/api/${route}`;
      if (calledPath === base) return true;
      // `/api/chat/<id>/messages` matches the `[chatId]` directory.
      const pattern = new RegExp(`^${base.replace(/\[[^\]]+\]/g, '[^/]+')}$`);
      return pattern.test(calledPath);
    });
    assert.ok(known, `undocumented endpoint in the mobile client: ${calledPath}`);
  }
});

test('public listing projection drops internal and moderation fields', () => {
  const projected = projectListing('abc123', {
    name: 'Neon jacket',
    price: 42,
    sellerId: 'seller-1',
    imageUrls: ['a.jpg', 'b.jpg', 'a.jpg'],
    // Fields that must never cross to a device:
    moderationFlags: ['spam'],
    costNotes: 'bought for 12',
    internalNotes: 'seller only',
    password: 'hunter2',
    sellerPayoutAccount: 'acct_1',
  });

  assert.equal(projected.name, 'Neon jacket');
  assert.equal(projected.price, 42);
  assert.equal(projected.sellerId, 'seller-1');
  assert.deepEqual(projected.imageUrls, ['a.jpg', 'b.jpg']);

  const serialized = JSON.stringify(projected);
  for (const forbidden of ['moderationFlags', 'costNotes', 'internalNotes', 'hunter2', 'acct_1']) {
    assert.ok(!serialized.includes(forbidden), `projection leaked ${forbidden}`);
  }
});

test('projection tolerates documents written by other surface generations', () => {
  // No fields at all: an empty document must not throw.
  const empty = projectListing('x', null);
  assert.equal(empty.id, 'x');
  assert.equal(empty.name, undefined);

  // Wrong types degrade to undefined rather than crashing the screen.
  const messy = projectListing('y', {
    name: 42,
    price: 'free',
    listingType: 'auction',
    condition: 'refurbished',
    uploadDate: { seconds: 1_700_000_000 },
  });
  assert.equal(messy.name, undefined);
  assert.equal(messy.price, undefined);
  assert.equal(messy.listingType, undefined);
  assert.equal(messy.condition, undefined);
  assert.equal(messy.uploadedAt, new Date(1_700_000_000_000).toISOString());
});

test('seller card exposes display fields only', () => {
  const seller = projectSeller('s1', {
    fullName: 'Ada',
    shopName: 'Ada Makes',
    email: 'ada@example.com',
    phoneNumber: '+000',
    connections: { tiktok: 'token' },
    verificationStatus: 'verified',
  });

  assert.equal(seller.name, 'Ada');
  assert.equal(seller.shopName, 'Ada Makes');
  assert.equal(seller.verified, true);

  const serialized = JSON.stringify(seller);
  for (const forbidden of ['ada@example.com', '+000', 'token']) {
    assert.ok(!serialized.includes(forbidden), `seller card leaked ${forbidden}`);
  }
});

test('authenticated mobile readers verify a bearer token before reading', () => {
  // Orders, seller overview, chats and saved items are per-account. Each must
  // reject a missing token, not fall through to an unscoped read.
  const guarded = ['mobile/orders', 'mobile/seller/overview', 'mobile/chats', 'mobile/saved'];
  for (const route of guarded) {
    const source = readFileSync(
      path.join(ROOT, 'src', 'app', 'api', ...route.split('/'), 'route.ts'),
      'utf8',
    );
    assert.match(source, /401/, `${route} must answer 401 when unauthenticated`);
    assert.match(
      source,
      /verifyIdToken|verifyUserContext/,
      `${route} must verify the caller's token`,
    );
  }
});

test('public mobile readers expose no write path', () => {
  for (const route of ['mobile/listing/[id]', 'mobile/catalog']) {
    const source = readFileSync(
      path.join(ROOT, 'src', 'app', 'api', ...route.split('/'), 'route.ts'),
      'utf8',
    );
    assert.match(source, /export async function GET/, `${route} should export GET`);
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/, `${route} must stay read-only`);
  }
});
