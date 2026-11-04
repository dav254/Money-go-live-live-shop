/**
 * THE OPERATIONAL-HISTORY MIRROR MUST ACTUALLY FIRE AT EVERY WRITE SITE.
 *
 * ## The failure this file exists to prevent
 * `activityLogs`, `errorLogs` and `supportTickets` were the three trails an
 * admin reads when something went wrong — and all three were Firestore-only.
 * Mirroring them only helps if:
 *
 *   • the mirror is called at EVERY screen/route that writes them (a mirror
 *     nobody calls is decoration — one missed status transition is one lost
 *     ticket history),
 *   • the sync route verifies the caller before it touches a document and
 *     never accepts ticket content from the request body (or a tampered
 *     request would push forged content into the VPS store),
 *   • a disabled PocketBase degrades to `false` instead of throwing — a
 *     failed mirror must never fail an admin action, an error capture or a
 *     customer's support ticket.
 *
 * These tests are the stop: behaviour checks for the degrade path, source
 * checks for the wiring.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  ACTIVITY_LOGS_COLLECTION,
  ERROR_LOGS_COLLECTION,
  SUPPORT_TICKETS_COLLECTION,
  pbMirrorActivityLog,
  pbMirrorErrorLog,
  pbMirrorSupportTicket,
} from '../lib/pocketbase/logs';

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

describe('the history mirror degrades instead of throwing', () => {
  it('every helper reports "not configured" when PocketBase is off', async () => {
    const saved: Record<string, string | undefined> = {};
    for (const key of POCKETBASE_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    try {
      assert.equal(await pbMirrorActivityLog('a-1', { category: 'REQUEST_ENGINE' }), false);
      assert.equal(await pbMirrorErrorLog('e-1', { errorMessage: 'boom' }), false);
      assert.equal(await pbMirrorSupportTicket('t-1', { userId: 'u-1', status: 'pending' }), false);
    } finally {
      for (const key of POCKETBASE_KEYS) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
      }
    }
  });

  it('three distinct collections, each keyed by fsId and carrying the full document', () => {
    const collections = [ACTIVITY_LOGS_COLLECTION, ERROR_LOGS_COLLECTION, SUPPORT_TICKETS_COLLECTION];
    assert.deepEqual([...collections].sort(), ['activity_logs', 'error_logs', 'support_tickets']);
    assert.equal(new Set(collections).size, 3, 'the trails must not collide');

    const source = readCode('src/lib/pocketbase/logs.ts');
    // fsId required (re-runnable mirror) + the full document in `data`.
    const fsIdDecls = source.match(/\{ name: 'fsId', type: 'text', required: true \}/g) ?? [];
    assert.equal(fsIdDecls.length, 3, 'every collection is keyed by its Firestore doc id');
    const dataDecls = source.match(/\{ name: 'data', type: 'json' \}/g) ?? [];
    assert.equal(dataDecls.length, 3, 'the full document always travels, columns only index it');
    // Guards first: no network when off, no throw when on.
    assert.ok(source.includes('if (!pocketBaseEnabled()) return false'), 'disabled PocketBase never hits the network');
    assert.ok(source.includes('catch (error)'), 'a VPS failure is logged, never thrown');
  });
});

describe('every Firestore write site is actually mirrored', () => {
  it('activityLogs are mirrored from the admin request-audit writer', () => {
    const source = readCode('src/app/api/admin/requests/route.ts');
    assert.ok(
      source.includes("db.collection('activityLogs').add"),
      'the audit entry still lands in Firestore first',
    );
    const addIndex = source.indexOf("db.collection('activityLogs').add");
    const mirrorIndex = source.indexOf('void pbMirrorActivityLog');
    assert.ok(mirrorIndex > addIndex, 'the audit row is written, then mirrored');
    assert.ok(
      source.includes('void pbMirrorActivityLog'),
      'the mirror is fire-and-forget — the audit write never waits on the VPS',
    );
  });

  it('errorLogs are mirrored for every document that actually landed', () => {
    const source = readCode('src/app/api/error-log/route.ts');
    assert.ok(source.includes("db.collection('errorLogs').doc("), 'the capture still lands in Firestore first');
    assert.ok(source.includes('void pbMirrorErrorLog'), 'each created entry is mirrored fire-and-forget');
    const setIndex = source.indexOf('await ref.set(');
    const pushIndex = source.indexOf('created.push(');
    const mirrorIndex = source.indexOf('void pbMirrorErrorLog');
    assert.ok(
      setIndex < pushIndex && pushIndex < mirrorIndex,
      'only successfully written documents are mirrored',
    );
  });

  it('support tickets sync route authenticates before it touches the document', () => {
    const source = readCode('src/app/api/support/sync/route.ts');
    const post = source.slice(source.indexOf('export async function POST'));
    assert.ok(post.includes('if (!user) return'), 'unauthenticated callers are rejected');
    assert.ok(
      post.indexOf('verifyRequestUser') < post.indexOf("collection('supportTickets')"),
      'the caller must be verified before the document path is built',
    );
    assert.ok(post.includes('verifyAdminUid'), 'naming someone else’s ticket requires admin');
    assert.ok(
      post.indexOf('verifyAdminUid') < post.indexOf('request.json()'),
      'both gates run before the body is read',
    );
    assert.ok(
      post.includes('ownerId !== user.uid && !adminUid'),
      'a normal user may only mirror their own ticket',
    );
    // The payload may carry only the document id — never ticket content.
    assert.equal(
      /\bbody\.(data|description|issueType|status|userId)\b/.test(source),
      false,
      'ticket content must never be accepted from the client',
    );
    assert.ok(source.includes('pbMirrorSupportTicket'), 'the ticket is mirrored server-side');
  });

  it('both ticket write sites call the sync route', () => {
    const contact = readCode('src/app/dashboard/reseller/support/contact/page.tsx');
    assert.ok(contact.includes("collection(firestore, 'supportTickets')"), 'the create path still writes Firestore');
    assert.ok(contact.includes('/api/support/sync'), 'the create path mirrors the new ticket');

    const admin = readCode('src/app/dashboard/admin/support/tickets/page.tsx');
    assert.ok(admin.includes('updateDoc(ticketRef, { status })'), 'the transition still writes Firestore');
    assert.ok(admin.includes('/api/support/sync'), 'the status transition mirrors too');
    assert.ok(admin.includes('.catch(() => undefined)'), 'a failed mirror never breaks the admin action');
  });
});
