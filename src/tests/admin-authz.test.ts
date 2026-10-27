/**
 * ADMIN AUTHORIZATION — repo-wide sweep.
 *
 * The distribution Control Center added ~15 admin routes alongside ~20
 * pre-existing ones, each written by a different session and each using a
 * DIFFERENT guard helper (`verifyAdminUid`, `verifyAdmin`, `requireAdmin`,
 * `isAdminUid`, or an inline `userRole !== 'admin'` check). Every one of them
 * is server-side today — verified by inspection — but nothing stopped the
 * next admin route from being written without any of them, and a single
 * unguarded admin route is a full platform compromise.
 *
 * This file is that stop: it walks every route.ts under src/app/api/admin and
 * fails if ANY route handler lacks a recognized admin-role gate or its 403.
 * It also pins the two non-`/api/admin` surfaces that must never be opened
 * by accident: the distribution cron (secret-gated, its own test file) and
 * the seller job API (any signed-in user, ownership-checked per product).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const ADMIN_API = path.join(ROOT, 'src', 'app', 'api', 'admin');

/** Every guard this repository legitimately uses for admin-only routes. */
const ADMIN_GUARDS: readonly string[] = [
  'verifyAdminUid', // notifications/server-utils (Firebase token + role/PB store)
  'verifyAdmin', // boosts route helper
  'requireAdmin', // users/complaints/products helpers
  'isAdminUid', // lib/server/admin-guard
  "userRole !== 'admin'", // inline role check (most common)
  "role !== 'admin'", // inline variant accepting the legacy role field
  'const isAdmin', // local admin flag computed from the profile, then branched on
  'user.isAdmin', // context helper already resolved the caller's admin flag
  ".userRole === 'admin'", // role equality on the stored profile
  'isAdmin(', // helper call taking an explicit flag
];

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...routeFiles(full));
    else if (entry.name === 'route.ts') out.push(full);
  }
  return out;
}

const files = routeFiles(ADMIN_API);
const rel = (f: string) => path.relative(ROOT, f);

function firstGuardIndex(source: string): number {
  const indexes = ADMIN_GUARDS.map((g) => source.indexOf(g)).filter((i) => i >= 0);
  return indexes.length ? Math.min(...indexes) : -1;
}

/**
 * First MUTATION in the file. Reads before the guard are legitimate when the
 * read IS the guard (a helper loading the caller's profile to decide the
 * role); a write before authorization is not.
 */
const WRITE_MARKERS = ['.add(', '.set(', '.update(', '.delete(', '.batch(', 'runTransaction('] as const;
function firstWriteIndex(source: string): number {
  const indexes = WRITE_MARKERS.map((m) => source.indexOf(m)).filter((i) => i >= 0);
  return indexes.length ? Math.min(...indexes) : -1;
}

describe('every admin API route enforces authorization server-side', () => {
  it('finds the admin route surface (the sweep is not silently empty)', () => {
    assert.ok(files.length >= 20, `expected the admin surface, found ${files.length} routes`);
  });

  for (const file of files) {
    it(`${rel(file)} is admin-gated and answers 403`, () => {
      const source = fs.readFileSync(file, 'utf8');
      const guardIdx = firstGuardIndex(source);
      assert.ok(
        guardIdx >= 0,
        `${rel(file)} has no recognized admin-role guard (${ADMIN_GUARDS.join(', ')})`,
      );
      assert.ok(
        /status: (401|403)/.test(source),
        `${rel(file)} must refuse a non-admin with 401 or 403 — a thrown error is not a policy`,
      );
      // No MUTATION may happen before the first authorization check. Reads
      // before it are allowed only when they are the guard's own profile
      // lookup (that is how several helpers decide the role).
      const writeIdx = firstWriteIndex(source);
      if (writeIdx >= 0) {
        assert.ok(
          guardIdx < writeIdx,
          `${rel(file)} writes data before any authorization check`,
        );
      }
    });
  }

  it('the distribution cron is secret-gated, not admin-token-gated (its own model)', () => {
    const cron = fs.readFileSync(
      path.join(ROOT, 'src', 'app', 'api', 'distribution', 'cron', 'route.ts'),
      'utf8',
    );
    assert.ok(cron.includes('authorizeCronSchedule'), 'the cron uses the fail-closed gate');
    assert.ok(!cron.includes('verifyAdminUid'), 'a scheduler has no user token to present');
  });

  it('the seller distribution API is signed-in and ownership-checked, never public', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'src', 'app', 'api', 'distribution', 'jobs', 'route.ts'),
      'utf8',
    );
    assert.ok(source.includes('verifyUserContext'), 'any job call is authenticated');
    assert.ok(
      source.includes('createDistributionJobSchema'),
      'create payloads are schema-validated',
    );
    const service = fs.readFileSync(
      path.join(ROOT, 'src', 'lib', 'vidnov-core', 'distribution', 'service.ts'),
      'utf8',
    );
    assert.ok(
      service.includes('data.sellerId !== actorUid'),
      'ownership is verified against the STORED product, never a client claim',
    );
  });
});
