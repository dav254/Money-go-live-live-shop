/**
 * A BUYER'S REQUEST REACHES THE SELLERS IN THE SAME CATEGORY.
 *
 * ## The product promise this file pins down
 *
 * When a buyer posts a request they pick a category, and every seller whose
 * shop carries that category is told: "a buyer has a request in your
 * category". That is how more sellers get a chance to answer — and none of it
 * is visible in a normal unit test, because the whole path is Firestore reads
 * that only exist in production. The fan-out runs fire-and-forget inside
 * `createRequest`, so nothing else in the suite even touches it.
 *
 * These are source-level assertions, the same technique as
 * `media-ownership.test.ts`: they fail the moment someone reorders the fan-out
 * so an email check gates the notification again, drops the direct category
 * query back to a capped scan, or "cleans up" the second notification shape on
 * the screen where the seller actually reads these alerts.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** Code only — the doc comments in these files describe the code in prose. */
function readCode(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const MATCHING = 'src/lib/requests/matching.ts';
const REQUEST_SERVICE = 'src/lib/requests/request-service.ts';
const SELLER_REQUESTS = 'src/app/app/seller/requests/page.tsx';
const SELLER_NOTIFICATIONS = 'src/app/app/seller/notifications/page.tsx';

describe('matching: every same-category seller is in', () => {
  it('queries sellerShops by category directly instead of only scanning', () => {
    const code = readCode(MATCHING);
    assert.ok(
      code.includes("where('category', '==', category)"),
      'findMatchingSellers must run a direct `category ==` query — a capped scan ' +
        'alone can silently drop same-category sellers from the notification fan-out',
    );
    assert.ok(
      code.includes('limit(500)'),
      'the scored scan should still run for location/trust matches',
    );
  });

  it('orders category matches ahead of scored-only matches', () => {
    const code = readCode(MATCHING);
    const categoryPart = code.indexOf('categoryMatches');
    const rest = code.indexOf('...others');
    assert.ok(categoryPart !== -1, 'category matches must be collected as their own group');
    assert.ok(rest !== -1, 'results must be assembled as category matches first, then the rest');
    assert.ok(
      categoryPart < rest,
      'the result limit must never be able to starve a same-category seller',
    );
  });

  it('compares categories tolerant of case and whitespace', () => {
    const code = readCode(MATCHING);
    assert.ok(code.includes('sameCategory('), 'category equality must go through sameCategory()');
    assert.equal(
      /shop\.category\s*===\s*request\.category/.test(code),
      false,
      'a raw === comparison would mute an entire category over one stray space',
    );
  });

  it('assumes no composite index (single equality filters only)', () => {
    const code = readCode(MATCHING);
    assert.equal(code.includes('.orderBy('), false, 'no provisioned composite indexes exist');
  });
});

describe('fan-out: the notification always fires', () => {
  const code = readCode(REQUEST_SERVICE);

  it('is triggered from request creation', () => {
    assert.ok(
      code.includes('void fanOutToMatches(ref.id)'),
      'createRequest must fire the fan-out (fire-and-forget, so the buyer is not blocked)',
    );
  });

  it('notifies in-app before any email-address check', () => {
    const notifyAt = code.indexOf('await notify({');
    const emailGuard = code.indexOf('profileData?.email');
    assert.ok(notifyAt !== -1, 'the fan-out must call notify()');
    assert.ok(emailGuard !== -1, 'email stays an optional extra channel');
    assert.ok(
      notifyAt < emailGuard,
      'a seller who never gave an email address must still get the in-app ' +
        'notification — the email check may only gate the email',
    );
  });

  it('tells a category-matched seller the request is in their category', () => {
    assert.ok(
      code.includes("'A buyer has a request in your category'"),
      'category matches need their own title',
    );
    assert.ok(
      code.includes('the same category as your shop'),
      'the message must say why this seller was picked',
    );
    assert.equal(
      code.includes("type: 'SYSTEM'"),
      true,
      'request alerts ride the SYSTEM notification type (see CATEGORY_BY_TYPE)',
    );
  });

  it('deep-links the seller into the app with that brief open', () => {
    assert.ok(
      code.includes('/app/seller/requests?open='),
      'the notification must land on the seller’s Requests queue with the ' +
        'brief expanded, not on a page with no route',
    );
    assert.ok(
      read(REQUEST_SERVICE).includes('appLink(`/requests/'),
      'the email keeps a website link, since an email reader may not be signed in',
    );
  });

  it('keeps the fan-out capped for the small VPS', () => {
    assert.match(
      code,
      /findMatchingSellers\(request,\s*20\)/,
      'fan-out stays capped — this box has 2 GB of RAM',
    );
  });
});

describe('the seller actually sees it', () => {
  it('requests screen reads the ?open= deep link', () => {
    const code = readCode(SELLER_REQUESTS);
    assert.ok(
      code.includes(".get('open')"),
      'the screen must read ?open= from the URL so the notification lands on the brief',
    );
  });

  it('requests screen flags briefs in the shop’s own category', () => {
    const code = readCode(SELLER_REQUESTS);
    assert.ok(code.includes('sameCategory('), 'each card is checked against the shop category');
    assert.ok(
      code.includes('categoryMatchCount'),
      'the screen must count same-category briefs for the banner',
    );
    assert.ok(
      code.includes("doc(firestore, 'sellerShops', user.uid)"),
      "the shop's category comes from the seller's own shop document",
    );
  });

  it('notifications screen reads the engine shape, not only the legacy one', () => {
    const code = readCode(SELLER_NOTIFICATIONS);
    assert.ok(
      code.includes('item.isRead === false'),
      'notify() writes isRead/status-free docs — without this the alert shows as already read',
    );
    assert.ok(
      code.includes('item.createdAt ?? item.timestamp'),
      'engine docs carry createdAt; legacy docs carry timestamp',
    );
    assert.ok(
      code.includes('sortNotificationsDesc'),
      'sorting must prefer createdAt then timestamp, or these alerts sink to the bottom',
    );
  });
});
