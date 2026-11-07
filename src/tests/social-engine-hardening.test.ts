/**
 * SOCIAL ENGINE — hardening tests for this pass.
 *
 * Three properties are load-bearing and are covered here:
 *
 *   1. token expiry is honest (`unknown` is never green),
 *   2. Mastodon resolves credentials from the LINKED ACCOUNT first, and a
 *      decryption failure refuses instead of silently using the legacy server
 *      token,
 *   3. every publishing platform ships a setup guide derived from real code
 *      (official docs host, real scope names, redirect URI from the callback
 *      route), and the dashboard renders it.
 *
 * Nothing here contacts a provider, Firestore or PocketBase.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  TOKEN_EXPIRING_WINDOW_MS,
  tokenExpiryState,
} from '../lib/social-engine/types';
import { MODULE_SPECS } from '../lib/social-engine/modules';
import { computeReadiness } from '../lib/social-engine/readiness';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Social Engine — token expiry reporting', () => {
  const now = Date.UTC(2026, 0, 1);

  it('reports unknown when the provider declared no expiry', () => {
    for (const value of [undefined, null, 0, -1, Number.NaN, 'tomorrow', {}]) {
      assert.equal(tokenExpiryState(value, now).state, 'unknown');
    }
  });

  it('classifies a live token, an expiring one and an expired one', () => {
    const hour = 60 * 60 * 1000;
    assert.equal(tokenExpiryState(now + 30 * 24 * hour, now).state, 'valid');
    assert.equal(tokenExpiryState(now + TOKEN_EXPIRING_WINDOW_MS - hour, now).state, 'expiring');
    assert.equal(tokenExpiryState(now - hour, now).state, 'expired');
  });

  it('exposes the expiry as an ISO timestamp and never as a token', () => {
    const at = now + 5 * 24 * 60 * 60 * 1000;
    const result = tokenExpiryState(at, now);
    assert.equal(result.expiresAt, new Date(at).toISOString());
    assert.deepEqual(Object.keys(result).sort(), ['expiresAt', 'state']);
  });

  it('an expired token can never render as READY', () => {
    const result = computeReadiness({
      readyBy: 'publish',
      missingRequiredEnv: [],
      connection: { connected: true, tokenState: 'expired' },
      approval: { required: false, granted: false, note: '' },
      tests: {
        diagnostic: { kind: 'diagnostic', ok: true, at: '2025-12-01T00:00:00.000Z', note: 'ok' },
        publish: { kind: 'publish', ok: true, at: '2025-12-01T00:00:00.000Z', note: 'ok', remoteId: '1' },
      },
      tokenState: 'expired',
    });
    assert.equal(result.state, 'ERROR');
    assert.match(result.nextStep, /expired — reconnect/);
  });

  it('an unexpired token keeps the recorded success', () => {
    const result = computeReadiness({
      readyBy: 'publish',
      missingRequiredEnv: [],
      connection: { connected: true, tokenState: 'valid' },
      approval: { required: false, granted: false, note: '' },
      tests: {
        publish: { kind: 'publish', ok: true, at: '2025-12-01T00:00:00.000Z', note: 'ok', remoteId: '1' },
      },
      tokenState: 'valid',
    });
    assert.equal(result.state, 'READY');
  });

  it('the connection view carries expiry, never credentials', () => {
    const source = read('src/lib/social-engine/connections.ts');
    const fn = source.slice(source.indexOf('export function toConnectionInfo'));
    const body = fn.slice(0, fn.indexOf('\n}') + 2);
    assert.doesNotMatch(body, /access_token|refresh_token|tokens:/);
    assert.match(body, /expiresAt/);
    assert.match(body, /tokenState/);
  });
});

describe('Social Engine — Mastodon credential resolver', () => {
  const source = read('src/lib/social-engine/publishing.ts');
  const fn = source.slice(
    source.indexOf('async function publishMastodonModule'),
    source.indexOf('/* ── Tumblr'),
  );

  it('reads the linked account BEFORE the legacy env pair', () => {
    const connectionAt = fn.indexOf('openConnectionTokens');
    const legacyAt = fn.indexOf('MASTODON_API_URL');
    assert.ok(connectionAt > -1, 'the connection must be read');
    assert.ok(legacyAt > -1, 'the legacy fallback must still exist');
    assert.ok(connectionAt < legacyAt, 'the account must win over the legacy server token');
  });

  it('refuses when the linked account cannot be decrypted', () => {
    assert.match(fn, /missing !== 'store_unreadable'/);
    assert.match(fn, /SOCIAL_ENGINE_TOKEN_KEY is not set/);
    assert.match(fn, /could not be decrypted — reconnect/);
  });

  it('says so when it publishes with the legacy token after a store failure', () => {
    assert.match(fn, /legacy server token — the connection store could not be read/);
  });

  it('never puts a token into a note', () => {
    assert.doesNotMatch(fn, /note:.*access_token/);
  });
});

describe('Social Engine — setup guides are real', () => {
  /** Platforms that must ship an in-dashboard setup guide. */
  const GUIDE_MODULES = [
    'facebook',
    'instagram',
    'tiktok',
    'telegram',
    'discord',
    'bluesky',
    'mastodon',
    'tumblr',
  ] as const;

  const OFFICIAL_HOST: Record<(typeof GUIDE_MODULES)[number], string> = {
    facebook: 'developers.facebook.com',
    instagram: 'developers.facebook.com',
    tiktok: 'developers.tiktok.com',
    telegram: 'core.telegram.org',
    discord: 'discord.com',
    bluesky: 'docs.bsky.app',
    mastodon: 'docs.joinmastodon.org',
    tumblr: 'www.tumblr.com',
  };

  for (const id of GUIDE_MODULES) {
    it(`${id} ships a complete guide on the provider's own domain`, () => {
      const setup = MODULE_SPECS[id].setup;
      assert.ok(setup, `${id} must have a setup guide`);
      assert.match(setup.docsUrl, /^https:\/\//);
      assert.ok(
        setup.docsUrl.includes(OFFICIAL_HOST[id]),
        `${id} docs must live on ${OFFICIAL_HOST[id]}, got ${setup.docsUrl}`,
      );
      assert.ok(setup.needs.length > 0, `${id} needs a "create/collect" list`);
      assert.ok(setup.scopes.length > 0, `${id} needs real scope names`);
      assert.ok(setup.commonErrors.length > 0, `${id} needs common errors`);
      for (const error of setup.commonErrors) {
        // Actionable, not a placeholder.
        assert.ok(error.length > 25, `${id} error text must be useful: ${error}`);
      }
    });
  }

  it('the redirect URI in the guide is derived from the real callback route', () => {
    const dashboard = read('src/app/dashboard/admin/system/social-engine/page.tsx');
    // Built from the canonical origin + the callback route, never hardcoded.
    assert.match(dashboard, /canonicalOrigin\}\/api\/social-engine\/callback\/\$\{module\.id\}/);
  });

  it('the dashboard renders the guide, the scopes and the token lifetime', () => {
    const dashboard = read('src/app/dashboard/admin/system/social-engine/page.tsx');
    assert.match(dashboard, /Setup guide/);
    assert.match(dashboard, /Redirect URI \(must match exactly\)/);
    assert.match(dashboard, /Permissions to request/);
    assert.match(dashboard, /Common errors/);
    assert.match(dashboard, /Server variables/);
    assert.match(dashboard, /tokenStateLabel/);
    assert.match(dashboard, /Access token expired — reconnect/);
  });

  it('provider approval is never presented as bypassable', () => {
    for (const id of ['facebook', 'instagram', 'tiktok'] as const) {
      const guide = MODULE_SPECS[id].setup;
      assert.ok(guide?.providerRequirement, `${id} must state the provider requirement`);
      assert.match(guide!.providerRequirement!, /review|verification/i);
    }
  });
});

describe('Social Engine — no readiness payload can carry a secret', () => {
  it('the readiness record has no token/credential field', () => {
    const types = read('src/lib/social-engine/types.ts');
    const connectionBlock = types.slice(
      types.indexOf('export interface ConnectionInfo'),
      types.indexOf('/** Provider-approval gate'),
    );
    assert.doesNotMatch(connectionBlock, /token\?:|accessToken|secret/);
  });

  it('the status route returns readiness objects only', () => {
    const route = read('src/app/api/social-engine/status/route.ts');
    assert.match(route, /getAllReadiness/);
    assert.doesNotMatch(route, /openConnectionTokens|sealTokens|openTokens/);
  });

  it('the status route is admin-gated on the server', () => {
    const route = read('src/app/api/social-engine/status/route.ts');
    assert.match(route, /verifyUserContext/);
    assert.match(route, /isAdminUid/);
    assert.match(route, /status: 403/);
  });
});
