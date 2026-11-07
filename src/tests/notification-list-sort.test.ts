/**
 * REGRESSION TEST — the PocketBase notification list must sort by "-createdAt".
 *
 * Production incident: `listNotifications()` sent `sort: "-created"` to
 * PocketBase. The `notifications` collection has no `created` field (only
 * `createdAt`, which the writer stores as a `date`), so PocketBase answered
 * HTTP 400 and every inbox request silently fell back to the legacy Firestore
 * path with stale ordering.
 *
 * `listNotifications()` talks to a live VPS, so this test does not perform a
 * network call. Instead it pins the two facts the bug depended on:
 *
 *   1. the collection schema has a `createdAt` date field (the sortable one),
 *   2. `listNotifications()` asks PocketBase to sort by exactly that field,
 *      while keeping the ownership filter and the perPage bound intact.
 *
 * A behavioural check on `sortNotificationsDesc` then pins the newest-first
 * contract that both storage paths promise.
 *
 * Run with: npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { sortNotificationsDesc } from '../lib/notifications/normalize';

const STORE_SOURCE = readFileSync(
  new URL('../lib/notifications/store.ts', import.meta.url),
  'utf8',
);

/** The body of `listNotifications()` up to the next declaration. */
function listNotificationsBody(): string {
  const start = STORE_SOURCE.indexOf('export async function listNotifications(');
  assert.ok(start >= 0, 'listNotifications() must exist in the notification store');
  const end = STORE_SOURCE.indexOf('\nasync function countUnreadPb', start);
  assert.ok(end > start, 'listNotifications() body must be delimited by countUnreadPb');
  return STORE_SOURCE.slice(start, end);
}

describe('notification list sort', () => {
  it('declares createdAt as the sortable date field', () => {
    // The sort is only valid because this field exists on the collection.
    assert.match(
      STORE_SOURCE,
      /name:\s*'createdAt',\s*type:\s*'date'/,
      'the notifications schema must declare createdAt as a date field',
    );
  });

  it('requests "-createdAt" from PocketBase', () => {
    const body = listNotificationsBody();

    assert.ok(
      body.includes("sort: '-createdAt'"),
      'PocketBase sort must be "-createdAt"',
    );

    // Guards the exact incident: a bare "-created" (no "At") is rejected with
    // HTTP 400 because the collection has no such field.
    assert.doesNotMatch(
      body,
      /sort:\s*'-created'(?!At)/,
      'PocketBase sort must never be the rejected "-created"',
    );
  });

  it('keeps the ownership filter and pagination unchanged', () => {
    const body = listNotificationsBody();

    assert.ok(
      body.includes('filter: ownedBy(userId)'),
      'the per-user ownership filter must stay in place',
    );
    assert.ok(
      body.includes('perPage: Math.min(Math.max(limit, 1), 200)'),
      'the perPage bound must stay in place',
    );
  });

  it('keeps the newest-first ordering contract', () => {
    const sorted = sortNotificationsDesc([
      { id: 'a', title: 'oldest', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'b', title: 'newest', createdAt: '2026-03-01T00:00:00.000Z' },
      { id: 'c', title: 'middle', createdAt: '2026-02-01T00:00:00.000Z' },
    ]);

    assert.deepEqual(
      sorted.map((row) => row.title),
      ['newest', 'middle', 'oldest'],
      'notifications must read newest-first',
    );
  });
});
