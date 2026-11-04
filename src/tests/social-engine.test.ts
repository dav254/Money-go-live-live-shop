/**
 * SOCIAL ENGINE — unit tests (shared, pure surface).
 *
 * Covers the readiness state machine, env-name-only outputs, token
 * encryption, OAuth state security, callback validation, OAuth flow builders,
 * URL/referral tracking, the module registry, media capability profiles, the
 * capability ids, and source-level guarantees on the routes and the dashboard.
 *
 * Nothing here touches the network or Firestore.
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { computeReadiness, STATE_RANK } from '../lib/social-engine/readiness';
import {
  isSealedToken,
  openTokens,
  sealTokens,
  tokenKeyPresent,
  TokenKeyMissingError,
} from '../lib/social-engine/crypto';
import {
  callbackPath,
  callbackUrl,
  issueState,
  stateCookieName,
  stateCookieOptions,
  validateRegisteredCallback,
  verifyState,
} from '../lib/social-engine/oauth';
import {
  buildAuthorizeUrl,
  callbackPath as flowsCallbackPath,
  tokenExchangeFor,
  validateRegisteredCallback as flowsValidate,
  META_GRAPH_API,
  TUMBLR_OAUTH,
} from '../lib/social-engine/flows';
import {
  buildProductReferralUrl,
  buildSellerReferralUrl,
  buildShareUrl,
  buildUtmQuery,
  canonicalOrigin,
  isSafeVidnovUrl,
  oauthCallbackUrl,
  sanitizePath,
  TRACKED_EVENTS,
} from '../lib/social-engine/url-track';
import { MODULE_IDS, READINESS_STATES } from '../lib/social-engine/types';
import { MODULE_SPECS, requiredEnvNames } from '../lib/social-engine/modules';
import { allCapabilities, moduleCapabilities } from '../lib/social-engine/capabilities';
import {
  PLATFORM_MEDIA_CAPS,
  capsForPlatform,
  validateForPlatform,
} from '../lib/social-engine/media';

const read = (path: string): string => readFileSync(path, 'utf8');

const TEST_KEY = 'social-engine-test-key-0123456789';

afterEach(() => {
  delete process.env.SOCIAL_ENGINE_TOKEN_KEY;
});

describe('Social Engine — readiness state machine', () => {
  it('stays NOT_CONFIGURED while a required env var is missing', () => {
    const result = computeReadiness({
      readyBy: 'publish',
      missingRequiredEnv: ['TELEGRAM_BOT_TOKEN'],
      connection: { connected: false },
      approval: { required: false, granted: true, note: '' },
      tests: {},
    });
    assert.equal(result.state, 'NOT_CONFIGURED');
    assert.match(result.nextStep, /TELEGRAM_BOT_TOKEN/);
  });

  it('reaches CONNECTED when only the auth test passed', () => {
    const result = computeReadiness({
      readyBy: 'publish',
      missingRequiredEnv: [],
      connection: { connected: false },
      approval: { required: false, granted: true, note: '' },
      tests: { auth: { kind: 'auth', ok: true, at: '2026-01-01T00:00:00Z', note: 'Bot authenticated.' } },
    });
    assert.equal(result.state, 'CONNECTED');
  });

  it('reaches TESTED when the safe diagnostic passed', () => {
    const result = computeReadiness({
      readyBy: 'publish',
      missingRequiredEnv: [],
      connection: { connected: false },
      approval: { required: false, granted: true, note: '' },
      tests: {
        auth: { kind: 'auth', ok: true, at: '2026-01-01T00:00:00Z', note: 'ok' },
        diagnostic: { kind: 'diagnostic', ok: true, at: '2026-01-02T00:00:00Z', note: 'Destination verified.' },
      },
    });
    assert.equal(result.state, 'TESTED');
  });

  it('reaches READY only after a confirmed publish', () => {
    const result = computeReadiness({
      readyBy: 'publish',
      missingRequiredEnv: [],
      connection: { connected: false },
      approval: { required: false, granted: true, note: '' },
      tests: {
        publish: { kind: 'publish', ok: true, at: '2026-01-03T00:00:00Z', note: 'Neutral message posted.', remoteId: '123' },
      },
    });
    assert.equal(result.state, 'READY');
    assert.equal(result.nextStep, 'Live — scheduled publishing may use this module.');
  });

  it('never promotes a publish-ready module on a diagnostic alone', () => {
    const result = computeReadiness({
      readyBy: 'publish',
      missingRequiredEnv: [],
      connection: { connected: false },
      approval: { required: false, granted: true, note: '' },
      tests: { diagnostic: { kind: 'diagnostic', ok: true, at: '2026-01-02T00:00:00Z', note: 'config sane.' } },
    });
    assert.equal(result.state, 'TESTED');
    assert.notEqual(result.state, 'READY');
  });

  it('reaches READY for a diagnostic-proven module on a diagnostic', () => {
    const result = computeReadiness({
      readyBy: 'diagnostic',
      missingRequiredEnv: [],
      connection: { connected: false },
      approval: { required: false, granted: true, note: '' },
      tests: { diagnostic: { kind: 'diagnostic', ok: true, at: '2026-01-02T00:00:00Z', note: 'config sane.' } },
    });
    assert.equal(result.state, 'READY');
  });

  it('prefers ERROR when a later failure outranks an older success', () => {
    const result = computeReadiness({
      readyBy: 'publish',
      missingRequiredEnv: [],
      connection: { connected: false },
      approval: { required: false, granted: true, note: '' },
      tests: {
        auth: { kind: 'auth', ok: true, at: '2026-01-01T00:00:00Z', note: 'ok' },
        publish: { kind: 'publish', ok: true, at: '2026-01-02T00:00:00Z', note: 'ok', remoteId: '1' },
        diagnostic: { kind: 'diagnostic', ok: false, at: '2026-01-04T00:00:00Z', note: 'wrong destination' },
      },
    });
    assert.equal(result.state, 'ERROR');
  });

  it('shows APPROVAL_REQUIRED before READY', () => {
    const result = computeReadiness({
      readyBy: 'publish',
      missingRequiredEnv: [],
      connection: { connected: false },
      approval: { required: true, granted: false, note: 'App review pending.' },
      tests: { publish: { kind: 'publish', ok: true, at: '2026-01-03T00:00:00Z', note: 'ok', remoteId: '1' } },
    });
    assert.equal(result.state, 'APPROVAL_REQUIRED');
    assert.match(result.nextStep, /App review pending/);
  });

  it('claims ERROR over APPROVAL_REQUIRED on a failure', () => {
    const result = computeReadiness({
      readyBy: 'publish',
      missingRequiredEnv: [],
      connection: { connected: false },
      approval: { required: true, granted: false, note: 'pending' },
      tests: { publish: { kind: 'publish', ok: false, at: '2026-01-05T00:00:00Z', note: 'publish failed' } },
    });
    assert.equal(result.state, 'ERROR');
  });

  it('turns an explicit disconnect into CONFIGURED, never CONNECTED', () => {
    const result = computeReadiness({
      readyBy: 'publish',
      missingRequiredEnv: [],
      connection: { connected: false, disconnectedAt: '2026-01-06T00:00:00Z' },
      approval: { required: false, granted: true, note: '' },
      tests: {},
    });
    assert.equal(result.state, 'CONFIGURED');
    assert.match(result.nextStep, /reconnect/i);
  });

  it('is deterministic and exposes the nine states', () => {
    const input = {
      readyBy: 'publish' as const,
      missingRequiredEnv: [],
      connection: { connected: false },
      approval: { required: false, granted: true, note: '' },
      tests: {},
    };
    assert.equal(computeReadiness(input).state, computeReadiness(input).state);
    assert.equal(READINESS_STATES.length, 7);
    assert.equal(Object.keys(STATE_RANK).length, 7);
  });
});

describe('Social Engine — env names only', () => {
  it('never puts a value into a readiness output', () => {
    const { state, nextStep } = computeReadiness({
      readyBy: 'publish',
      missingRequiredEnv: ['TELEGRAM_BOT_TOKEN'],
      connection: { connected: false },
      approval: { required: false, granted: true, note: '' },
      tests: {},
    });
    assert.equal(state, 'NOT_CONFIGURED');
    assert.equal(nextStep.includes('AGENT_IS_A_SECRET_VALUE_9001'), false);
    assert.match(nextStep, /TELEGRAM_BOT_TOKEN/);
  });

  it('the module registry stores roles and names, never values', () => {
    for (const spec of Object.values(MODULE_SPECS)) {
      for (const env of spec.env) {
        assert.equal(typeof env.name, 'string');
        assert.equal(typeof env.role, 'string');
        assert.equal('value' in env, false);
      }
    }
  });
});

describe('Social Engine — token encryption', () => {
  it('refuses to seal without a key (no plaintext fallback)', () => {
    delete process.env.SOCIAL_ENGINE_TOKEN_KEY;
    assert.equal(tokenKeyPresent(), false);
    assert.throws(() => sealTokens({ access_token: 'x' }), TokenKeyMissingError);
  });

  it('seals and opens a token round trip', () => {
    process.env.SOCIAL_ENGINE_TOKEN_KEY = TEST_KEY;
    const sealed = sealTokens({ access_token: 'tok-1', scopes: ['read'] });
    assert.equal(isSealedToken(sealed), true);
    assert.equal(JSON.stringify(sealed).includes('tok-1'), false, 'plaintext must not appear in the ciphertext');
    const opened = openTokens<{ access_token: string }>(sealed);
    assert.equal(opened.access_token, 'tok-1');
  });

  it('uses a fresh IV per seal', () => {
    process.env.SOCIAL_ENGINE_TOKEN_KEY = TEST_KEY;
    const a = sealTokens({ access_token: 'same' });
    const b = sealTokens({ access_token: 'same' });
    assert.notEqual(a.iv, b.iv);
    assert.notEqual(a.data, b.data);
  });

  it('rejects tampered ciphertext instead of returning garbage', () => {
    process.env.SOCIAL_ENGINE_TOKEN_KEY = TEST_KEY;
    const sealed = sealTokens({ access_token: 'tok-1' });
    const tampered = { ...sealed, data: `${sealed.data.slice(0, -2)}AA` };
    assert.throws(() => openTokens(tampered));
  });

  it('the missing-key error names the env var and nothing else', () => {
    delete process.env.SOCIAL_ENGINE_TOKEN_KEY;
    let thrown: Error | undefined;
    try {
      sealTokens({});
    } catch (error) {
      thrown = error as Error;
    }
    assert.ok(thrown instanceof TokenKeyMissingError);
    assert.match(thrown.message, /SOCIAL_ENGINE_TOKEN_KEY/);
    assert.equal(/SECRET|VALUE/.test(thrown.message), false);
  });
});

describe('Social Engine — OAuth state', () => {
  const secret = 'unit-test-oauth-state-secret-0123456789';

  it('issues and verifies a state bound to the initiating administrator', () => {
    const state = issueState('seller-uid-1', secret);
    assert.equal(verifyState(state, state, secret), 'seller-uid-1');
  });

  it('rejects a tampered state', () => {
    const state = issueState('seller-uid-1', secret);
    const tampered = state.split('.').join('.x.');
    assert.equal(verifyState(tampered, state, secret), null);
  });

  it('rejects a state whose cookie does not match', () => {
    const state = issueState('seller-uid-1', secret);
    const other = issueState('seller-uid-2', secret);
    assert.equal(verifyState(state, other, secret), null);
  });

  it('rejects an expired state', () => {
    const state = issueState('seller-uid-1', secret, Date.now() - 11 * 60 * 1000);
    assert.equal(verifyState(state, state, secret, Date.now()), null);
  });

  it('refuses to verify with no secret at all', () => {
    const state = issueState('seller-uid-1', secret);
    assert.equal(verifyState(state, state, null), null);
    assert.equal(verifyState(state, null, secret), null);
    assert.equal(verifyState(null, state, secret), null);
  });

  it('binds each module flow to its own cookie', () => {
    assert.notEqual(stateCookieName('mastodon'), stateCookieName('discord'));
    const options = stateCookieOptions();
    assert.equal(options.httpOnly, true);
    assert.equal(options.sameSite, 'lax');
    assert.equal(options.path, '/api/social-engine');
    assert.ok(options.maxAge <= 600);
  });
});

describe('Social Engine — callback URL validation', () => {
  it('builds the module callback from the canonical origin', () => {
    const url = callbackUrl('mastodon');
    assert.equal(url, `${canonicalOrigin()}/api/social-engine/callback/mastodon`);
    assert.equal(callbackPath('mastodon'), '/api/social-engine/callback/mastodon');
    assert.equal(oauthCallbackUrl('mastodon'), url);
    assert.equal(flowsCallbackPath('mastodon'), callbackPath('mastodon'));
  });

  it('refuses an unknown module instead of building a path', () => {
    assert.throws(() => callbackUrl('not-a-module'));
  });

  it('validates a registered callback against the fixed path', () => {
    const ok = validateRegisteredCallback(`${canonicalOrigin()}/api/social-engine/callback/mastodon`, 'mastodon');
    assert.equal(ok.ok, true);
    // A trailing slash is tolerated; a different path is not.
    assert.equal(validateRegisteredCallback(`${canonicalOrigin()}/api/social-engine/callback/mastodon/`, 'mastodon').ok, true);
    assert.equal(validateRegisteredCallback(`${canonicalOrigin()}/api/social-engine/callback/discord`, 'mastodon').ok, false);
    assert.equal(validateRegisteredCallback('', 'mastodon').ok, false);
    assert.equal(validateRegisteredCallback(undefined, 'mastodon').ok, false);
    // The flows re-export is the same implementation.
    assert.equal(flowsValidate('', 'mastodon').ok, false);
  });
});

describe('Social Engine — flow builders', () => {
  it('returns null for server-level (no-OAuth) modules', () => {
    assert.equal(buildAuthorizeUrl('telegram', 's'), null);
    assert.equal(buildAuthorizeUrl('bluesky', 's'), null);
  });

  it('returns an OAuth 1.0a handshake for Tumblr, not a static URL', () => {
    assert.equal(buildAuthorizeUrl('tumblr', 's'), null);
    assert.match(TUMBLR_OAUTH.requestToken, /request_token$/);
    assert.match(TUMBLR_OAUTH.accessToken, /access_token$/);
  });

  it('builds a Mastodon authorize URL with the state embedded once', () => {
    process.env.MASTODON_INSTANCE_URL = 'https://mastodon.social';
    process.env.MASTODON_CLIENT_ID = 'cid';
    const url = buildAuthorizeUrl('mastodon', 'state-1')?.uri ?? '';
    assert.ok(url.includes('/oauth/authorize'));
    assert.ok(url.includes('response_type=code'));
    assert.ok(url.includes('state=state-1'));
    assert.equal(url.split('state=').length - 1, 1);
    assert.ok(url.includes(encodeURIComponent(`${canonicalOrigin()}/api/social-engine/callback/mastodon`)));
    delete process.env.MASTODON_INSTANCE_URL;
    delete process.env.MASTODON_CLIENT_ID;
  });

  it('uses the shared Meta Graph version for Facebook and Instagram', () => {
    const facebook = buildAuthorizeUrl('facebook', 's')?.uri ?? '';
    const instagram = buildAuthorizeUrl('instagram', 's')?.uri ?? '';
    assert.ok(facebook.includes('facebook.com/v26.0/dialog/oauth'));
    assert.ok(facebook.includes('pages_manage_posts'));
    assert.ok(instagram.includes('instagram_content_publish'));
    assert.match(tokenExchangeFor('facebook')?.tokenEndpoint ?? '', /graph\.facebook\.com/);
    assert.equal(tokenExchangeFor('facebook')?.tokenEndpoint, `${META_GRAPH_API}/oauth/access_token`);
  });

  it('exposes no token exchange for env-level modules', () => {
    assert.equal(tokenExchangeFor('telegram'), undefined);
    assert.equal(tokenExchangeFor('bluesky'), undefined);
    assert.ok(tokenExchangeFor('mastodon')?.tokenEndpoint.includes('oauth/token'));
  });
});

describe('Social Engine — URL and referral tracking', () => {
  it('builds a canonical home link', () => {
    assert.equal(buildShareUrl('home', '', { source: 'social' }), canonicalOrigin());
  });

  it('adds campaign, content, term and ref parameters', () => {
    const url = buildShareUrl('product', 'p1', {
      source: 'tiktok',
      campaign: 'black-friday-2026',
      content: 'add-to-cart',
      term: 'vegan-mugs',
      ref: 'alice-1',
    });
    assert.ok(url.includes('/products/p1'));
    assert.match(url, /camp=black-friday-2026/);
    assert.match(url, /content=add-to-cart/);
    assert.match(url, /term=vegan-mugs/);
    assert.match(url, /ref=alice-1/);
    assert.ok(url.startsWith(canonicalOrigin()));
  });

  it('emits a validated channel id as `ch` only when one is supplied', () => {
    const withChannel = buildShareUrl('product', 'p1', { source: 'social', channel: 'tiktok' });
    assert.match(withChannel, /ch=tiktok/);
    const unknown = buildShareUrl('product', 'p1', { source: 'social', channel: 'not-a-channel' });
    assert.equal(unknown.includes('ch='), false);
  });

  it('never stacks a ref or overrides an existing one', () => {
    const url = buildShareUrl('product', 'p1?ref=old', { source: 'tiktok', ref: 'alice-1' });
    assert.match(url, /ref=old/);
    assert.equal(url.includes('ref=alice-1'), false);
    assert.equal(url.split('ref=').length - 1, 1);
  });

  it('drops junk referral codes', () => {
    assert.equal(
      buildShareUrl('product', 'p1', { source: 'tiktok', ref: 'Bad Code!' }),
      `${canonicalOrigin()}/products/p1`,
    );
  });

  it('builds seller and product referral URLs in the existing format', () => {
    const seller = buildSellerReferralUrl('sellers/dave', 'alice-1', { medium: 'social', campaign: 'q4' });
    assert.ok(seller.includes('/sellers/dave'));
    assert.equal(seller.includes('/sellers/sellers'), false);
    assert.match(seller, /ref=alice-1/);
    assert.match(seller, /utm_campaign=q4/);
    assert.match(seller, /utm_medium=social/);

    const product = buildProductReferralUrl('products/mug', 'dave-2');
    assert.ok(product.includes('/products/mug'));
    assert.match(product, /ref=dave-2/);
  });

  it('cannot be turned into an open redirect', () => {
    const external = buildShareUrl('product', 'https://evil.example/x', { source: 'x' });
    assert.ok(external.startsWith(canonicalOrigin()));
    assert.equal(external.includes('evil.example/'), true); // it is a path segment, not a host
    assert.equal(new URL(external).host, new URL(canonicalOrigin()).host);

    const protocolRelative = buildShareUrl('product', '//evil.example/x', { source: 'x' });
    assert.equal(new URL(protocolRelative).host, new URL(canonicalOrigin()).host);

    const javascript = buildShareUrl('product', 'javascript:alert(1)', { source: 'x' });
    assert.equal(javascript.startsWith(canonicalOrigin()), true);

    assert.equal(isSafeVidnovUrl('https://evil.example/x'), false);
    assert.equal(isSafeVidnovUrl('javascript:alert(1)'), false);
    assert.equal(isSafeVidnovUrl(`${canonicalOrigin()}/products/p1`), true);
  });

  it('removes path traversal', () => {
    assert.equal(sanitizePath('../../admin'), 'admin');
    assert.equal(sanitizePath('/../..//secret'), 'secret');
    const url = buildShareUrl('product', '../../dashboard/admin', { source: 'x' });
    assert.equal(new URL(url).pathname, '/products/dashboard/admin');
  });

  it('never carries credential-shaped parameters into a link', () => {
    const url = buildShareUrl('product', 'p1?access_token=abc123&ref=alice-1', { source: 'x', ref: 'bob-2' });
    assert.equal(url.includes('abc123'), false);
    assert.equal(url.includes('access_token'), false);
    assert.match(url, /ref=alice-1/);
  });

  it('accepts only bounded, safe utm values', () => {
    assert.equal(buildUtmQuery({ source: 'bad source!' }), '');
    assert.equal(buildUtmQuery({ source: '' }), '');
    assert.match(buildUtmQuery({ source: 'tiktok', medium: 'social' }), /utm_source=tiktok/);
  });

  it('keeps the six attribution events separate', () => {
    assert.deepEqual(TRACKED_EVENTS, [
      'share_handoff_initiated',
      'post_confirmed_published',
      'referral_link_clicked',
      'website_visit_received',
      'enquiry_submitted',
      'order_completed',
    ]);
  });
});

describe('Social Engine — module registry', () => {
  it('supports exactly the fourteen module specs', () => {
    assert.equal(MODULE_IDS.length, 14);
    assert.equal(Object.keys(MODULE_SPECS).length, 14);
    for (const id of MODULE_IDS) assert.ok(MODULE_SPECS[id], `${id} has no spec`);
  });

  it('declares env vars and one readyBy per module', () => {
    for (const [id, spec] of Object.entries(MODULE_SPECS)) {
      assert.ok(spec.env.length > 0, `${id} declares no env vars at all`);
      assert.ok(['publish', 'diagnostic', 'none'].includes(spec.readyBy));
      assert.ok(spec.activation.length > 0);
      // Any module you CONNECT to (oauth or server credentials) must name at
      // least one required variable. Built-in modules may have none: `media`
      // reads MEDIA_CONFIG defaults, `urls` falls back to https://vidnov.com
      // and `publishing` uses the in-house queue, so an empty 'required' list
      // there is correct rather than an oversight.
      if (spec.connectionKind === 'oauth' || spec.connectionKind === 'env') {
        assert.ok(requiredEnvNames(spec).length > 0, `${id} has no required env vars`);
      }
    }
  });

  it('publishes through publish tests and proves infrastructure by diagnostic', () => {
    const publishing = ['telegram', 'tiktok', 'bluesky', 'tumblr', 'mastodon', 'discord', 'facebook', 'instagram', 'media'];
    for (const [id, spec] of Object.entries(MODULE_SPECS)) {
      assert.equal(spec.readyBy, publishing.includes(id) ? 'publish' : 'diagnostic', `${id} readyBy`);
    }
  });

  it('marks Meta and TikTok approvals as external dependencies', () => {
    assert.equal(MODULE_SPECS.facebook.approval?.required, true);
    assert.equal(MODULE_SPECS.instagram.approval?.required, true);
    assert.equal(MODULE_SPECS.tiktok.approval?.required, true);
    assert.ok(MODULE_SPECS.facebook.additionalSetup?.some((s) => /App Review/i.test(s)));
    assert.ok(MODULE_SPECS.instagram.additionalSetup?.some((s) => /professional/i.test(s)));
  });
});

describe('Social Engine — capability ids', () => {
  it('every per-module capability is a known identifier', () => {
    const known = new Set<string>(allCapabilities());
    for (const id of MODULE_IDS) {
      const caps = moduleCapabilities(id);
      for (const cap of [...caps.free, ...caps.aiPoint]) {
        assert.ok(known.has(cap), `${id} exposes unknown capability ${cap}`);
      }
    }
  });

  it('carries no price or point cost', () => {
    const ids = allCapabilities();
    assert.equal(ids.some((id) => /price|cost|points?:?\d/i.test(id)), false);
    assert.equal(ids.length, 16);
  });
});

describe('Social Engine — platform media profiles', () => {
  it('covers every publishing platform plus Facebook Pages and Instagram', () => {
    assert.equal(PLATFORM_MEDIA_CAPS.length, 8);
    for (const id of ['telegram', 'bluesky', 'tumblr', 'mastodon', 'discord', 'tiktok', 'facebook', 'instagram']) {
      assert.ok(capsForPlatform(id), `${id} has no media profile`);
    }
    assert.equal(capsForPlatform('nope'), null);
  });

  it('accepts a PNG where the platform accepts PNG', () => {
    const verdict = validateForPlatform('telegram', { kind: 'image', mime: 'image/png', bytes: 14_238 });
    assert.equal(verdict.ok, true);
  });

  it('refuses PNG for Instagram and any image for TikTok', () => {
    const instagram = validateForPlatform('instagram', { kind: 'image', mime: 'image/png', bytes: 1024 });
    assert.equal(instagram.ok, false);
    assert.match(instagram.note, /image\/jpeg/);
    const tiktok = validateForPlatform('tiktok', { kind: 'image', mime: 'image/jpeg', bytes: 1024 });
    assert.equal(tiktok.ok, false);
  });

  it('refuses an oversized asset and an unknown platform', () => {
    const huge = validateForPlatform('bluesky', { kind: 'image', mime: 'image/png', bytes: 50 * 1024 * 1024 });
    assert.equal(huge.ok, false);
    assert.equal(validateForPlatform('nope', { kind: 'image', mime: 'image/png', bytes: 1 }).ok, false);
  });
});

describe('Social Engine — source-level guarantees', () => {
  it('the dashboard never reads process.env', () => {
    const source = read('src/app/dashboard/admin/system/social-engine/page.tsx');
    assert.equal(source.includes('process.env.'), false);
    assert.ok(source.includes('useUser'));
  });

  it('every route is authenticated and admin-gated where it must be', () => {
    for (const route of [
      'src/app/api/social-engine/status/route.ts',
      'src/app/api/social-engine/[module]/test/route.ts',
      'src/app/api/social-engine/[module]/publish-test/route.ts',
      'src/app/api/social-engine/approval/route.ts',
    ]) {
      const source = read(route);
      assert.ok(source.includes('verifyUserContext'), `${route} has no verifyUserContext`);
      assert.ok(source.includes('isAdminUid'), `${route} does not use the admin allowlist`);
    }
  });

  it('publish tests require an explicit confirm flag and expose no credential', () => {
    const publish = read('src/app/api/social-engine/[module]/publish-test/route.ts');
    assert.ok(publish.includes('confirm === true'));
    assert.equal(publish.includes('access_token'), false);
    const engine = read('src/lib/social-engine/engine.ts');
    assert.ok(engine.includes('if (ctx.confirm !== true)'));
    assert.ok(engine.includes('approval.granted'));
  });

  it('connections are tenant-isolated in the storage layer', () => {
    const source = read('src/lib/social-engine/connections.ts');
    assert.ok(source.includes('caller.uid !== ownerId'));
    assert.ok(source.includes('connectionId(module, ownerId)'));
    assert.ok(source.includes('sealTokens'));
  });

  it('readTestDoc performs a real Firestore read', () => {
    const engine = read('src/lib/social-engine/engine.ts');
    assert.ok(engine.includes('export async function readTestDoc'));
    assert.ok(engine.includes('TESTS_COLLECTION).doc(platformDocId(module)).get()'));
    assert.equal(/return \{\} as ModuleTestDoc/.test(engine), false);
  });

  it('Facebook and Instagram have their own diagnostics', () => {
    const source = read('src/lib/social-engine/diagnostics.ts');
    assert.ok(source.includes("case 'facebook':"));
    assert.ok(source.includes("case 'instagram':"));
    assert.ok(source.includes('pages_manage_posts'));
    assert.ok(source.includes('instagram_content_publish'));
  });

  it('a handoff is never reported as a publish', () => {
    const source = read('src/lib/social-engine/publishing.ts');
    assert.ok(source.includes('handoffUrl'));
    assert.ok(source.includes("event: 'share_handoff_initiated'"));
    // Every handoff outcome is ok:false.
    assert.ok(source.includes('const handoff = (note: string): PublishTestOutcome => ({\n    ok: false,'));
  });

  it('the callback verifies state instead of trusting a bearer token', () => {
    const source = read('src/app/api/social-engine/callback/[module]/route.ts');
    assert.ok(source.includes('verifyState(state, cookie)'));
    assert.equal(source.includes("headers.get('Authorization')"), false);
    assert.ok(source.includes('withClearedCookies'));
  });

  it('the approval route takes the module from the body and requires a real boolean', () => {
    const source = read('src/app/api/social-engine/approval/route.ts');
    assert.ok(source.includes('const module = typeof body.module'));
    assert.ok(source.includes('body.granted === true'));
  });
});
