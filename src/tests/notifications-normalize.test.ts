/**
 * Notification store helpers — pure-logic tests.
 *
 * Covers the three things the VPS-backed notification section depends on and
 * that could silently break an inbox:
 *
 *   1. normalization of every generation of record into ONE shape,
 *   2. unread counting across both legacy field shapes,
 *   3. duplicate-suppression identity (same event → one notification).
 *
 * Run with `npm test` (tsx --test).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  dedupeIdentity,
  isUnreadRecord,
  normalizeNotification,
  sameEventIdentity,
  sortNotificationsDesc,
  toIso,
} from '../lib/notifications/normalize';

test('normalizes the legacy status/timestamp shape', () => {
  const when = new Date('2026-10-01T12:00:00.000Z');
  const out = normalizeNotification({
    id: 'a1',
    userId: 'u1',
    type: 'announcement',
    title: 'Sale on Friday',
    message: 'Everything 10% off.',
    status: 'unread',
    timestamp: when,
    link: '/dashboard/seller/products',
  });

  assert.equal(out.id, 'a1');
  assert.equal(out.isRead, false);
  assert.equal(out.createdAt, when.toISOString());
  assert.equal(out.category, 'system'); // legacy writer sent none
  assert.equal(out.link, '/dashboard/seller/products');
});

test('normalizes the engine isRead/createdAt shape', () => {
  const out = normalizeNotification({
    id: 'b1',
    type: 'NEW_ORDER',
    title: 'New order',
    message: 'Toyota Prado Tx',
    category: 'orders',
    isRead: true,
    createdAt: '2026-10-02T08:30:00.000Z',
    entityType: 'ORDER',
    entityId: 'o-9',
  });

  assert.equal(out.isRead, true);
  assert.equal(out.createdAt, '2026-10-02T08:30:00.000Z');
  assert.equal(out.category, 'orders');
  assert.equal(out.entityId, 'o-9');
});

test('a record with neither read field counts as unread', () => {
  assert.equal(isUnreadRecord({ id: 'x' }), true);
  assert.equal(isUnreadRecord({ status: 'read' }), false);
  assert.equal(isUnreadRecord({ status: 'unread' }), true);
  assert.equal(isUnreadRecord({ isRead: false }), true);
  assert.equal(isUnreadRecord({ isRead: true }), false);
  // isRead wins when both are present (the engine's shape is authoritative).
  assert.equal(isUnreadRecord({ isRead: true, status: 'unread' }), false);
});

test('missing display fields fall back safely', () => {
  const out = normalizeNotification({ id: 'c1' });
  assert.equal(out.title, 'Notification');
  assert.equal(out.type, 'SYSTEM');
  assert.equal(out.category, 'system');
  assert.equal(out.message, '');
  assert.equal(out.createdAt, null);
});

test('toIso handles Date, ISO string, epoch millis, seconds and Timestamp-likes', () => {
  const iso = '2026-05-05T00:00:00.000Z';
  assert.equal(toIso(new Date(iso)), iso);
  assert.equal(toIso(iso), iso);
  assert.equal(toIso(Date.parse(iso)), iso);
  assert.equal(toIso({ seconds: Date.parse(iso) / 1000 }), iso);
  assert.equal(
    toIso({ toMillis: () => Date.parse(iso) }),
    iso,
  );
  assert.equal(toIso({ toDate: () => new Date(iso) }), iso);
  assert.equal(toIso('not a date'), null);
  assert.equal(toIso(null), null);
  assert.equal(toIso(undefined), null);
});

test('dedupe identity matches the same event and nothing else', () => {
  const identity = dedupeIdentity({
    userId: 'seller-1',
    type: 'NEW_ORDER',
    entityId: 'order-7',
    title: 'New order received',
  });

  assert.equal(
    sameEventIdentity(
      { userId: 'seller-1', type: 'NEW_ORDER', entityId: 'order-7', title: 'New order received' },
      identity,
    ),
    true,
  );
  // Different recipient — must never collapse two people's notifications.
  assert.equal(
    sameEventIdentity(
      { userId: 'seller-2', type: 'NEW_ORDER', entityId: 'order-7', title: 'New order received' },
      identity,
    ),
    false,
  );
  // Different event about the same entity.
  assert.equal(
    sameEventIdentity(
      { userId: 'seller-1', type: 'ORDER_STATUS', entityId: 'order-7', title: 'New order received' },
      identity,
    ),
    false,
  );
  // Different entity.
  assert.equal(
    sameEventIdentity(
      { userId: 'seller-1', type: 'NEW_ORDER', entityId: 'order-8', title: 'New order received' },
      identity,
    ),
    false,
  );
});

test('broadcasts without an entity dedupe on the title', () => {
  const identity = dedupeIdentity({
    userId: 'buyer-1',
    type: 'announcement',
    title: 'Sale on Friday',
  });
  assert.equal(
    sameEventIdentity({ userId: 'buyer-1', type: 'announcement', title: 'Sale on Friday' }, identity),
    true,
  );
  assert.equal(
    sameEventIdentity({ userId: 'buyer-1', type: 'announcement', title: 'Sale on Saturday' }, identity),
    false,
  );
});

test('sorts newest first across mixed timestamp representations', () => {
  const sorted = sortNotificationsDesc([
    { id: 'old', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'newest', createdAt: new Date('2026-10-01T00:00:00.000Z') },
    { id: 'middle', createdAt: '2026-06-01T00:00:00.000Z' },
    { id: 'legacy', timestamp: new Date('2026-08-01T00:00:00.000Z') },
    { id: 'none' },
  ]);

  assert.deepEqual(
    sorted.map((n) => n.id),
    ['newest', 'legacy', 'middle', 'old', 'none'],
  );
});