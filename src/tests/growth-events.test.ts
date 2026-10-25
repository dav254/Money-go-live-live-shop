/**
 * GROWTH ENGINE PHASE 1 — event spine, share attribution, counter security.
 * Run: npx tsx --test src/tests/growth-events.test.ts
 *
 * Layers (same style as the rest of the suite):
 *   1. PURE logic — payload validation drops client-supplied counters,
 *      qualification thresholds, dedupe identity, share-ref helpers, and
 *      the privacy hash (stable per day, never contains the raw nonce);
 *   2. SOURCE-level guards — session evidence, size limits, self-view
 *      filtering, transactional create-if-absent dedupe, TTL retention, no
 *      IP/UA collection, failure → 202 (browsing never breaks), client
 *      fire-and-forget wiring, referral carry-through, rules hardening.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const ev = require(join(ROOT, 'src', 'lib', 'growth', 'events.ts')) as {
  MAX_EVENT_BYTES: number;
  VIEW_QUALIFY_MS: number;
  EVENT_RETENTION_DAYS: number;
  parseEventInput: (b: unknown) => { ok: boolean; error?: string; value?: Record<string, unknown> };
  isQualifiedView: (e: { type: string; dwellMs?: number }) => boolean;
  eventDayKey: (d?: Date) => string;
  eventExpiresAt: (d?: Date) => Date;
  dedupeDocId: (...parts: string[]) => string;
  withShareRef: (url: string, code?: string | null) => string;
};
const srv = require(join(ROOT, 'src', 'lib', 'growth', 'server.ts')) as {
  hashViewerId: (raw: string, day: string) => string;
};

/* ── pure: validation ──────────────────────────────────────────────────── */

describe('event payload validation', () => {
  it('accepts a well-formed view and click', () => {
    const v = ev.parseEventInput({
      type: 'view',
      targetKind: 'product',
      targetId: 'prod123',
      dwellMs: 2000,
      sid: 'a'.repeat(32),
      ref: 'shop-name',
    });
    assert.equal(v.ok, true);
    assert.equal(v.value?.type, 'view');

    const c = ev.parseEventInput({
      type: 'click',
      targetKind: 'shop',
      targetId: 'sellerUid_1',
      platform: 'whatsapp',
      sid: 'b'.repeat(32),
    });
    assert.equal(c.ok, true);
    assert.equal(c.value?.platform, 'whatsapp');
  });

  it('DROPS client-supplied counters, seller ids, prices and unknown keys', () => {
    const r = ev.parseEventInput({
      type: 'view',
      targetKind: 'product',
      targetId: 'p1',
      sid: 'c'.repeat(32),
      // hostile extras:
      viewCount: 999999,
      clickCount: 42,
      sellerId: 'attacker-uid',
      price: 0.01,
      totalAmount: 1,
      orderStatus: 'delivered',
      qualified: true,
    });
    assert.equal(r.ok, true);
    for (const k of ['viewCount', 'clickCount', 'sellerId', 'price', 'totalAmount', 'orderStatus', 'qualified']) {
      assert.equal(k in (r.value ?? {}), false, `${k} must not survive parsing`);
    }
  });

  it('rejects malformed ids, types, sessions and dwells', () => {
    const bad = [
      { type: 'hack', targetKind: 'product', targetId: 'p', sid: 'd'.repeat(32) },
      { type: 'view', targetKind: 'product', targetId: '../../etc/passwd', sid: 'd'.repeat(32) },
      { type: 'view', targetKind: 'product', targetId: 'p', sid: 'tooshort' },
      { type: 'click', targetKind: 'product', targetId: 'p', sid: 'd'.repeat(32), dwellMs: 10 ** 9 },
      { type: 'click', targetKind: 'product', targetId: 'p', sid: 'd'.repeat(32), dwellMs: -5 },
      { type: 'view', targetKind: 'shop', targetId: 'p', sid: 'd'.repeat(32) },
      { type: 'view', targetKind: 'product' },
      'not-an-object',
      null,
    ];
    for (const body of bad) {
      const r = ev.parseEventInput(body);
      assert.equal(r.ok, false, `must reject: ${JSON.stringify(body).slice(0, 80)}`);
    }
  });

  it('platform outside the whitelist degrades to "other"', () => {
    const r = ev.parseEventInput({
      type: 'click',
      targetKind: 'product',
      targetId: 'p',
      platform: '<script>',
      sid: 'e'.repeat(32),
    });
    assert.equal(r.ok, true);
    assert.equal(r.value?.platform, 'other');
  });

  it('a click defaults to a platform (analytics stay categorisable)', () => {
    const r = ev.parseEventInput({ type: 'click', targetKind: 'product', targetId: 'p', sid: 'f'.repeat(32) });
    assert.equal(r.value?.platform, 'other');
  });
});

describe('qualified vs raw views', () => {
  it('a view qualifies only at the documented 2-second threshold', () => {
    assert.equal(ev.VIEW_QUALIFY_MS, 2000);
    assert.equal(ev.isQualifiedView({ type: 'view', dwellMs: 0 }), false); // mere load
    assert.equal(ev.isQualifiedView({ type: 'view' }), false); // no attestation
    assert.equal(ev.isQualifiedView({ type: 'view', dwellMs: 1999 }), false);
    assert.equal(ev.isQualifiedView({ type: 'view', dwellMs: 2000 }), true);
    assert.equal(ev.isQualifiedView({ type: 'view', dwellMs: 30_000 }), true);
  });

  it('a share click is inherently an action (always qualified)', () => {
    assert.equal(ev.isQualifiedView({ type: 'click' }), true);
  });
});

describe('dedupe identity and retention', () => {
  it('day keys are UTC and stable, expiry is exactly the retention window', () => {
    assert.match(ev.eventDayKey(new Date('2026-03-05T23:59:59Z')), /^2026-03-05$/);
    const now = new Date('2026-03-05T10:00:00Z');
    const exp = ev.eventExpiresAt(now);
    const days = (exp.getTime() - now.getTime()) / (24 * 3600 * 1000);
    assert.equal(days, ev.EVENT_RETENTION_DAYS);
  });

  it('the dedupe id binds type, target, day and viewer; unsafe chars are stripped', () => {
    const a = ev.dedupeDocId('view', 'product', 'p1_2', '2026-03-05', 'abc123');
    const b = ev.dedupeDocId('view', 'product', 'p1_2', '2026-03-05', 'abc123');
    const otherDay = ev.dedupeDocId('view', 'product', 'p1_2', '2026-03-06', 'abc123');
    const otherViewer = ev.dedupeDocId('view', 'product', 'p1_2', '2026-03-05', 'abc124');
    assert.equal(a, b, 'same inputs → same id (idempotent)');
    assert.notEqual(a, otherDay, 'a new day may count again');
    assert.notEqual(a, otherViewer, 'a different viewer may count');
    assert.equal(/[/.#$[\]]/.test(a), false, 'no Firestore-unsafe id characters');
  });
});

describe('privacy hash (server)', () => {
  it('is stable within a day, differs across days, and never contains the nonce', () => {
    const sid = 'a'.repeat(32);
    const d1 = srv.hashViewerId(`s:${sid}`, '2026-03-05');
    const d1again = srv.hashViewerId(`s:${sid}`, '2026-03-05');
    const d2 = srv.hashViewerId(`s:${sid}`, '2026-03-06');
    assert.equal(d1, d1again, 'dedupe needs day-stability');
    assert.notEqual(d1, d2, 'cross-day correlation must be impossible');
    assert.match(d1, /^[0-9a-f]{32}$/);
    assert.equal(d1.includes(sid.slice(0, 12)), false, 'raw nonce never appears in the hash');
    assert.notEqual(d1, srv.hashViewerId('s:' + 'b'.repeat(32), '2026-03-05'));
  });
});

describe('share attribution helpers', () => {
  it('appends the established ?ref= parameter without stacking', () => {
    assert.equal(ev.withShareRef('https://vidnov.com/products/p1', 'code1'), 'https://vidnov.com/products/p1?ref=code1');
    assert.equal(ev.withShareRef('/products/p1?a=1', 'code1'), '/products/p1?a=1&ref=code1');
    assert.equal(ev.withShareRef('/products/p1?ref=old', 'code1'), '/products/p1?ref=old', 'never overrides');
    assert.equal(ev.withShareRef('/products/p1', null), '/products/p1');
    assert.equal(ev.withShareRef('/products/p1', ''), '/products/p1');
    assert.equal(ev.withShareRef('/products/p1', 'Bad Code!'), '/products/p1', 'junk codes are dropped');
  });
});

/* ── source-level: the endpoint ────────────────────────────────────────── */

describe('POST /api/events hardening', () => {
  const src = read('src/app/api/events/route.ts');

  it('requires session evidence: verified Bearer, or the server-issued cookie', () => {
    assert.ok(src.includes('verifyUserUid'), 'Bearer path must verify server-side');
    assert.ok(src.includes('status: 401'), 'invalid Bearer is rejected, never downgraded');
    // Session ids are minted SERVER-side: an httpOnly cookie JS can't touch.
    assert.ok(src.includes("const SESSION_COOKIE = 'vn_evs'"), 'cookie name defined');
    assert.ok(src.includes('request.cookies.get(SESSION_COOKIE)'), 'cookie is the session source');
    assert.ok(src.includes('randomBytes(16)'), 'fresh server-generated nonce on first contact');
    assert.ok(src.includes('httpOnly: true'), 'cookie unreachable from page JavaScript');
    assert.equal(src.includes('event.sid'), false, 'a body-supplied sid is never used');
  });

  it('bounds request size before parsing', () => {
    assert.ok(src.includes('MAX_EVENT_BYTES'), 'size cap referenced');
    assert.ok(src.includes('status: 413'), 'oversize rejected');
    assert.ok(src.includes('Buffer.byteLength'), 'actual bytes checked, not just the header');
  });

  it('never reads client counters, seller ids or order values', () => {
    for (const banned of ['json.viewCount', 'json.clickCount', 'json.sellerId', 'json.price', 'json.totalAmount', 'body.viewCount', 'body.sellerId']) {
      assert.equal(src.includes(banned), false, `${banned} must not be read`);
    }
    assert.ok(src.includes('parseEventInput(json)'), 'only the whitelisted parser shapes input');
    assert.ok(src.includes('target.data()'), 'seller identity is re-derived from the document');
  });

  it('dedupe and counters are one transaction with create-if-absent', () => {
    assert.ok(src.includes('runTransaction'), 'atomic transaction');
    assert.ok(src.includes('tx.create(eventRef'), 'insert-if-absent is the dedupe primitive');
    assert.ok(src.includes('seen.exists'), 'repeat visits short-circuit');
    assert.ok(src.includes('FieldValue.increment(1)'), 'counters only via server increment');
    assert.ok(src.includes("targetKind === 'product' ? 'products' : 'sellerShops'"), 'target resolved server-side');
  });

  it('seller self-views are recorded raw but never counted', () => {
    assert.ok(src.includes("reason: self ? 'self_view' : 'unqualified'") || src.includes("'self_view'"), 'self-view reason');
    assert.ok(src.includes('uid === sellerId'), 'identity comparison on verified uid');
    assert.ok(src.includes('qualified && !self'), 'public counter skips self events');
  });

  it('stores TTL expiry and hashes the viewer before storage', () => {
    assert.ok(src.includes('eventExpiresAt'), 'retention field set');
    assert.ok(src.includes('hashViewerId'), 'raw sid/uid is hashed');
    assert.equal(src.includes('event.sid!,'), false, 'raw sid is never written to a document');
    assert.ok(src.includes('viewer: viewerHash'), 'stored value is the hash');
  });

  it('session ids cannot be supplied or rotated by the client body', () => {
    // The parser may still ACCEPT a legacy `sid` key (old cached bundles),
    // but the route must never read it: only the httpOnly cookie and the
    // verified uid decide viewer identity.
    assert.equal(src.includes('event.sid'), false);
    assert.equal(src.includes('parsed.value.sid'), false);
    assert.ok(src.includes("`s:${sid}`"), 'hash input is the server cookie value');
  });

  it('collects no IP, user-agent, or referrer URLs', () => {
    // Strip comments first: the module's own docs mention these terms while
    // explaining that they are NOT collected — only real code may be asserted.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.equal(code.includes('x-forwarded-for'), false);
    assert.equal(code.includes('user-agent'), false);
    assert.equal(code.includes('referer'), false);
    assert.equal(code.includes('referrer'), false);
  });

  it('failure answers 202 without internals — browsing can never break on it', () => {
    assert.ok(src.includes('status: 202'), 'unexpected failure still acks');
    assert.ok(src.includes("{ ok: true, counted: false }"), 'soft-fail shape');
    assert.ok(
      /console\.error\('\[events\][^']*'\);/.test(src),
      'log line carries no payload or error object',
    );
    assert.equal(src.includes('stack'), false);
  });
});

/* ── source-level: client wiring ───────────────────────────────────────── */

describe('client helpers are fire-and-forget and dwell-gated', () => {
  const src = read('src/lib/growth/client.ts');

  it('all network failures are swallowed', () => {
    assert.ok(src.startsWith("'use client'"), 'client module');
    assert.ok(src.includes('.catch(() => {'), 'fetch failures never surface');
    assert.ok(src.includes('never throws'), 'contract documented');
    assert.equal(src.includes('throw '), false, 'no throwing path');
  });

  it('views are day-gated client-side and cancelled on early navigation', () => {
    assert.ok(src.includes('localDayKey()'), 'per-local-day gate');
    assert.ok(src.includes('localStorage.getItem(key)'), 'refresh loop sends nothing');
    assert.ok(src.includes('document.visibilityState'), 'hidden page never counts');
    assert.ok(src.includes('disposed'), 'dispose-on-unmount cancels the pending view');
    assert.ok(src.includes('VIEW_QUALIFY_MS'), 'client uses the shared threshold');
  });

  it('carries only whitelisted fields on the wire', () => {
    assert.ok(src.includes('type: input.type'));
    assert.ok(src.includes('targetKind: input.targetKind'));
    assert.ok(src.includes('targetId: input.targetId'));
    assert.equal(src.includes('sellerId'), false, 'no ownership claims from the client');
    assert.equal(src.includes('viewCount:'), false, 'no counters from the client');
    // Session identity is server-owned: the client neither generates nor
    // transmits a nonce the server would trust.
    assert.equal(src.includes('ensureSid'), false, 'no client session minting');
    assert.equal(src.includes('sid:'), false, 'no sid in the request body');
  });

  it('share refs are normalised and time-limited to 30 days', () => {
    assert.ok(src.includes('REF_MAX_AGE_MS'), 'stored refs expire');
    assert.ok(src.includes('/^[a-z0-9-]{1,40}$/'), 'ref uses the referral alphabet only');
    assert.ok(src.includes('30 * 24 * 60 * 60'), 'spec window: 30 days');
  });
});

describe('attribution wiring across surfaces', () => {
  const websiteProduct = read('src/app/products/[productId]/page.tsx');
  const appProduct = read('src/app/app/buyer/product/[productId]/page.tsx');
  const discovery = read('src/components/discovery/discovery-video-post.tsx');
  const signup = read('src/app/signup/page.tsx');
  const cart = read('src/app/cart/page.tsx');
  const appCart = read('src/app/app/buyer/cart/page.tsx');
  const types = read('src/lib/types.ts');

  it('both product pages capture refs and track qualified views', () => {
    for (const [name, src] of [
      ['website', websiteProduct],
      ['app', appProduct],
    ] as const) {
      assert.ok(src.includes('captureShareRef()'), `${name} product page captures ?ref=`);
      assert.ok(src.includes('trackListingView(productId)'), `${name} product page tracks views`);
    }
  });

  it('discovery share appends the established ref code and records the tap', () => {
    assert.ok(discovery.includes('withShareRef('), 'shared URL carries ?ref=');
    assert.ok(discovery.includes("referralCodeFor(user.uid)"), 'legacy code fallback');
    assert.ok(discovery.includes('?.referralCode'), 'profile code preferred');
    assert.ok(discovery.includes("trackShareClick('product'"), 'tap recorded');
  });

  it('signup claims URL code first, stored share ref second — server still validates', () => {
    assert.ok(signup.includes('urlRefCode ?? readStoredShareRef()'), 'carry-through fallback');
    assert.ok(signup.includes('claimSignupReferral'), 'existing claim path untouched');
    assert.equal(signup.includes('code: undefined,'), false);
  });

  it('checkout records shareRef without touching money fields', () => {
    assert.ok(cart.includes('shareRef: shareCode'), 'order carries attribution when a ref exists');
    assert.ok(cart.includes('readStoredShareRef()'), 'source is the stored share ref');
    assert.ok(cart.includes('shareCode ?'), 'spread only when present — no undefined fields');
    assert.ok(types.includes('shareRef?: string'), 'typed optional field');
    assert.ok(cart.includes('totalAmount: total'), 'existing order math untouched');
  });

  it('the authenticated app cart records shareRef too (both checkout paths)', () => {
    assert.ok(appCart.includes('shareRef: shareCode'), 'app order carries attribution');
    assert.ok(appCart.includes('readStoredShareRef()'), 'same stored ref source');
    assert.ok(appCart.includes('totalAmount: total'), 'app order math untouched');
  });
});

/* ── rules + script guard ──────────────────────────────────────────────── */

describe('counter security (rules + scripts)', () => {
  const rules = read('firestore.rules');
  const rulesCopy = read('src/firestore.rules');

  it('both rules files stay byte-identical', () => {
    assert.equal(rules, rulesCopy);
  });

  it('clients can no longer write viewCount; likes and cart stay writable', () => {
    const hasOnly = rules.match(/hasOnly\(\[[^\]]*\]\)/g) ?? [];
    const productUpdate = hasOnly.find((h) => h.includes('likes'));
    assert.ok(productUpdate, 'product update clause exists');
    assert.equal(productUpdate?.includes("'viewCount'"), false, 'viewCount must be server-owned');
    assert.equal(productUpdate?.includes("'clickCount'"), false, 'clickCount must be server-owned');
    assert.ok(productUpdate?.includes("'likes'"), 'likes preserved');
    assert.ok(productUpdate?.includes("'inCartCount'"), 'cart interactions preserved');
    assert.ok(productUpdate?.includes("'salesCount'"), 'existing order flow untouched (pre-existing)');
    // The OWNER branch must be diff-guarded too — otherwise the seller could
    // inflate their own listing through the autonomy clause.
    assert.ok(
      rules.includes("affectedKeys().hasAny(['viewCount', 'clickCount'])"),
      'owner updates are blocked from touching server counters',
    );
  });

  it('sellerShops counters are server-owned for everyone, owner included', () => {
    const shop = rules.match(/match \/sellerShops\/\{shopId\} \{[\s\S]*?\n    \}/)?.[0] ?? '';
    assert.ok(shop, 'sellerShops block found');
    assert.equal(/allow write: if isOwner/.test(shop), false, 'no blanket owner write remains');
    assert.ok(shop.includes('allow create, delete:'), 'create/delete explicitly owned');
    assert.ok(
      shop.includes("hasAny(['clickCount', 'followers'])"),
      'owner updates cannot move clickCount or followers',
    );
    assert.ok(shop.includes('isAdmin()'), 'admin path preserved');
  });

  it('contentEvents is deny-all for clients in both files', () => {
    for (const r of [rules, rulesCopy]) {
      assert.ok(
        /match \/contentEvents\/\{eventId\} \{\s*allow read, write: if false;/.test(r),
        'event docs must be server-only',
      );
    }
  });

  it('the fake-stats verification script refuses to run without an explicit opt-in', () => {
    const script = read('scripts/verify-listing-bonus.ts');
    assert.ok(script.includes("VIDNOV_FAKE_STATS_TEST !== 'ALLOW'"), 'guard present');
    assert.ok(script.includes('process.exit(1)'), 'refuses by default');
    assert.ok(script.includes('never run against production'), 'warning documented');
  });
});

describe('seller analytics distinguishes real journey stages', () => {
  const src = read('src/app/dashboard/seller/analytics/page.tsx');

  it('shows views, share clicks, enquiries and completed orders separately', () => {
    assert.ok(src.includes('title="Views"'));
    assert.ok(src.includes('title="Share Clicks"'));
    assert.ok(src.includes('title="Buyer Enquiries"'));
    assert.ok(src.includes('title="Completed Orders"'));
    assert.ok(src.includes('p.viewCount || 0'), 'views come from stored counters');
    assert.ok(src.includes('p.clickCount || 0'), 'shares come from stored counters');
    assert.ok(src.includes("'delivered' || o.orderStatus === 'shipped'"), 'completed = delivered/shipped');
    assert.ok(src.includes('estimated or backfilled'), 'honesty caption present');
  });
});
