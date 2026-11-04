import { NextRequest, NextResponse } from 'next/server';
import { isAdminUid } from '@/lib/server/admin-guard';
import { isModuleId, type ModuleId } from '@/lib/social-engine/types';
import { MODULE_SPECS } from '@/lib/social-engine/modules';
import { META_GRAPH_API, TUMBLR_OAUTH, callbackUrl } from '@/lib/social-engine/flows';
import {
  oauth1AuthorizationHeader,
  stateCookieName,
  stateCookieOptions,
  verifyState,
} from '@/lib/social-engine/oauth';
import { saveConnection, type StoredTokens } from '@/lib/social-engine/connections';
import { recordAudit } from '@/lib/social-engine/engine';
import { sanitizeErrorMessage } from '@/lib/vidnov-core/distribution/job-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DASHBOARD = '/dashboard/admin/system/social-engine';
const TIMEOUT = 20_000;

interface ExchangeClient {
  clientId: string;
  clientSecret: string;
}

/** The OAuth2 client credentials for a module — from the env NAMES its spec declares. */
function exchangeClientFor(module: ModuleId): ExchangeClient | null {
  const env = process.env;
  switch (module) {
    case 'mastodon':
      return {
        clientId: (env.MASTODON_CLIENT_ID ?? '').trim(),
        clientSecret: (env.MASTODON_CLIENT_SECRET ?? '').trim(),
      };
    case 'discord':
      return {
        clientId: (env.DISCORD_APPLICATION_ID ?? '').trim(),
        clientSecret: (env.DISCORD_CLIENT_SECRET ?? '').trim(),
      };
    case 'facebook':
    case 'instagram':
      return {
        clientId: (env.META_APP_ID ?? '').trim(),
        clientSecret: (env.META_APP_SECRET ?? '').trim(),
      };
    case 'google':
      return {
        clientId: (env.GOOGLE_CLIENT_ID ?? '').trim(),
        clientSecret: (env.GOOGLE_CLIENT_SECRET ?? '').trim(),
      };
    default:
      return null;
  }
}

interface OAuth2Tokens {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
}

interface ConnectionResult {
  tokens: StoredTokens;
  accountLabel?: string;
  scopes?: string[];
}

/** Clears the one-shot cookies on the way out (single-use flows). */
function withClearedCookies(response: NextResponse, module: ModuleId): NextResponse {
  const clear = { ...stateCookieOptions(), maxAge: 0 };
  response.cookies.set(stateCookieName(module), '', clear);
  response.cookies.set(`${stateCookieName(module)}_req`, '', clear);
  return response;
}

function fail(request: NextRequest, module: ModuleId, code: string, note?: string): NextResponse {
  const url = new URL(DASHBOARD, request.url);
  url.searchParams.set('error', code);
  if (note) url.searchParams.set('note', note.slice(0, 200));
  return withClearedCookies(NextResponse.redirect(url), module);
}

/** OAuth 2.0 code → token exchange. */
async function exchangeOAuth2(
  module: ModuleId,
  code: string,
): Promise<{ tokens?: OAuth2Tokens; note?: string }> {
  const client = exchangeClientFor(module);
  if (!client || !client.clientId || !client.clientSecret) {
    return { note: 'The OAuth client credentials for this module are not configured.' };
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl(module),
    client_id: client.clientId,
    client_secret: client.clientSecret,
  });

  const res = await fetch(
    module === 'google'
      ? 'https://oauth2.googleapis.com/token'
      : module === 'discord'
        ? 'https://discord.com/api/v10/oauth2/token'
        : module === 'mastodon'
          ? `${(process.env.MASTODON_INSTANCE_URL ?? '').replace(/\/+$/, '')}/oauth/token`
          : `${META_GRAPH_API}/oauth/access_token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(TIMEOUT),
    },
  ).catch(() => null);

  if (!res) return { note: 'The token endpoint could not be reached.' };
  const payload = (await res.json().catch(() => null)) as OAuth2Tokens | null;
  if (!res.ok || !payload?.access_token || payload.error) {
    return { note: `Token exchange failed (HTTP ${res.status}).` };
  }
  return { tokens: payload };
}

interface MetaPage {
  id?: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id?: string };
}

/**
 * Facebook / Instagram identity.
 *
 * Pages are read with the USER token and saved WITH the connection (inside the
 * sealed payload), because Page publishing needs the Page access token. Only
 * Pages the connected user manages are returned — personal profiles are never
 * a publishing destination.
 */
async function metaIdentity(module: ModuleId, userToken: string): Promise<ConnectionResult & { meta?: Record<string, unknown> }> {
  const headers = { Authorization: `Bearer ${userToken}` };
  const profileRes = await fetch(`${META_GRAPH_API}/me?fields=id,name&access_token=${encodeURIComponent(userToken)}`, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT),
  }).catch(() => null);
  const profile = profileRes ? ((await profileRes.json().catch(() => null)) as { name?: string } | null) : null;

  const accountsRes = await fetch(
    `${META_GRAPH_API}/me/accounts?fields=id,name,access_token,instagram_business_account&limit=25&access_token=${encodeURIComponent(userToken)}`,
    { headers, signal: AbortSignal.timeout(TIMEOUT) },
  ).catch(() => null);
  const accounts = accountsRes
    ? ((await accountsRes.json().catch(() => null)) as { data?: MetaPage[] } | null)
    : null;
  const pages = Array.isArray(accounts?.data)
    ? accounts!.data!.filter((page) => typeof page.id === 'string').map((page) => ({
        id: page.id as string,
        name: page.name,
        access_token: page.access_token,
        instagram_business_account: page.instagram_business_account,
      }))
    : [];

  const tokens: StoredTokens = { access_token: userToken, meta: { pages } };

  if (module === 'facebook') {
    return {
      tokens,
      accountLabel: pages[0]?.name ?? profile?.name ?? 'Facebook user',
      meta: { pages },
    };
  }

  const linked = pages.find((page) => page.instagram_business_account?.id);
  const igUserId = linked?.instagram_business_account?.id;
  if (igUserId) {
    const igRes = await fetch(
      `${META_GRAPH_API}/${encodeURIComponent(igUserId)}?fields=username&access_token=${encodeURIComponent(userToken)}`,
      { signal: AbortSignal.timeout(TIMEOUT) },
    ).catch(() => null);
    const ig = igRes ? ((await igRes.json().catch(() => null)) as { username?: string } | null) : null;
    return {
      tokens: { access_token: userToken, meta: { pages, instagramUserId: igUserId } },
      accountLabel: ig?.username ? `@${ig.username}` : 'Instagram business account',
      meta: { pages, instagramUserId: igUserId },
    };
  }

  return { tokens, accountLabel: 'Instagram (no professional account linked)', meta: { pages } };
}

/** Tumblr: OAuth 1.0a access-token exchange + blog discovery. */
async function tumblrConnection(
  request: NextRequest,
  requestToken: string,
  verifier: string,
): Promise<ConnectionResult | { note: string }> {
  const consumerKey = (process.env.TUMBLR_CONSUMER_KEY ?? '').trim();
  const consumerSecret = (process.env.TUMBLR_CONSUMER_SECRET ?? '').trim();
  const requestSecret =
    request.cookies.get(`${stateCookieName('tumblr')}_req`)?.value ?? '';
  if (!consumerKey || !consumerSecret) return { note: 'Tumblr consumer credentials are not configured.' };
  if (!requestSecret) return { note: 'The Tumblr request-token secret is missing — restart the connect flow.' };

  const params = { oauth_verifier: verifier };
  const header = oauth1AuthorizationHeader({
    method: 'POST',
    url: TUMBLR_OAUTH.accessToken,
    consumerKey,
    consumerSecret,
    token: requestToken,
    tokenSecret: requestSecret,
    params,
  });

  const res = await fetch(TUMBLR_OAUTH.accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: header },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(TIMEOUT),
  }).catch(() => null);
  if (!res || !res.ok) return { note: `Tumblr access-token exchange failed (HTTP ${res?.status ?? 'network'}).` };

  const parsed = new URLSearchParams(await res.text());
  const accessToken = parsed.get('oauth_token');
  const accessSecret = parsed.get('oauth_token_secret');
  if (!accessToken || !accessSecret) return { note: 'Tumblr did not return an access token.' };

  const infoUrl = 'https://api.tumblr.com/v2/user/info';
  const infoHeader = oauth1AuthorizationHeader({
    method: 'GET',
    url: infoUrl,
    consumerKey,
    consumerSecret,
    token: accessToken,
    tokenSecret: accessSecret,
  });
  const infoRes = await fetch(infoUrl, {
    headers: { Authorization: infoHeader },
    signal: AbortSignal.timeout(TIMEOUT),
  }).catch(() => null);
  const info = infoRes ? ((await infoRes.json().catch(() => null)) as {
    response?: { user?: { name?: string }; blogs?: Array<{ name?: string }> };
  } | null) : null;

  const blogName = info?.response?.blogs?.[0]?.name;
  return {
    tokens: {
      access_token: accessToken,
      extra: { oauth_token_secret: accessSecret },
      meta: blogName ? { blogHostname: `${blogName}.tumblr.com` } : {},
    },
    accountLabel: info?.response?.user?.name ?? blogName ?? 'Tumblr account',
  };
}

/**
 * GET /api/social-engine/callback/[module] — the OAuth callback.
 *
 * The browser arrives from the provider with cookies but WITHOUT a bearer
 * token, so identity comes from the signed state itself: `verifyState()`
 * checks the signature, the expiry and the HttpOnly cookie binding, and
 * returns the uid that started the flow. The admin flag is then resolved
 * server-side. A state that fails any check aborts the flow.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ module: string }> },
) {
  const { module } = await params;
  if (!isModuleId(module)) {
    return NextResponse.redirect(new URL(`${DASHBOARD}?error=invalid_module`, request.url));
  }
  const spec = MODULE_SPECS[module];
  if (spec.connectionKind !== 'oauth') {
    return fail(request, module, 'no_oauth', 'This module does not use an OAuth flow.');
  }

  const url = new URL(request.url);
  const providerError = url.searchParams.get('error');
  if (providerError) return fail(request, module, 'denied');

  const state = url.searchParams.get('state');
  const cookie = request.cookies.get(stateCookieName(module))?.value ?? null;
  const uid = verifyState(state, cookie);
  if (!uid) return fail(request, module, 'state_invalid');

  const isAdmin = await isAdminUid(uid);
  const caller = { uid, isAdmin };

  let connection: ConnectionResult | { note: string };

  if (module === 'tumblr') {
    const requestToken = url.searchParams.get('oauth_token');
    const verifier = url.searchParams.get('oauth_verifier');
    if (!requestToken || !verifier) return fail(request, module, 'no_verifier');
    connection = await tumblrConnection(request, requestToken, verifier);
  } else {
    const code = url.searchParams.get('code');
    if (!code) return fail(request, module, 'no_code');

    const exchanged = await exchangeOAuth2(module, code);
    if (!exchanged.tokens?.access_token) return fail(request, module, 'token_failed');

    const accessToken = exchanged.tokens.access_token;
    const scopes = exchanged.tokens.scope ? exchanged.tokens.scope.split(/[\s,]+/).filter(Boolean) : undefined;
    const expiresAt =
      typeof exchanged.tokens.expires_in === 'number' ? Date.now() + exchanged.tokens.expires_in * 1000 : null;
    const baseTokens: StoredTokens = {
      access_token: accessToken,
      refresh_token: exchanged.tokens.refresh_token,
      expires_at: expiresAt,
      scopes,
    };

    if (module === 'facebook' || module === 'instagram') {
      const identity = await metaIdentity(module, accessToken);
      connection = {
        tokens: { ...identity.tokens, scopes },
        accountLabel: identity.accountLabel,
        scopes,
      };
    } else if (module === 'mastodon') {
      const instance = (process.env.MASTODON_INSTANCE_URL ?? '').replace(/\/+$/, '');
      const res = await fetch(`${instance}/api/v1/accounts/verify_credentials`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(TIMEOUT),
      }).catch(() => null);
      const me = res ? ((await res.json().catch(() => null)) as { username?: string } | null) : null;
      connection = {
        tokens: baseTokens,
        accountLabel: me?.username ? `@${me.username}` : 'Mastodon account',
        scopes,
      };
    } else if (module === 'discord') {
      const res = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(TIMEOUT),
      }).catch(() => null);
      const me = res ? ((await res.json().catch(() => null)) as { username?: string; global_name?: string } | null) : null;
      connection = {
        tokens: baseTokens,
        accountLabel: me?.global_name || me?.username || 'Discord account',
        scopes,
      };
    } else {
      const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(TIMEOUT),
      }).catch(() => null);
      const me = res ? ((await res.json().catch(() => null)) as { name?: string; email?: string } | null) : null;
      connection = {
        tokens: baseTokens,
        accountLabel: me?.name || me?.email || 'Google account',
        scopes,
      };
    }
  }

  if ('note' in connection) return fail(request, module, 'connect_failed', connection.note);

  try {
    // Encryption happens in `saveConnection`; with no SOCIAL_ENGINE_TOKEN_KEY
    // it refuses (TokenKeyMissingError) rather than storing a plaintext token.
    await saveConnection({
      module,
      ownerId: uid,
      tokens: connection.tokens,
      accountLabel: connection.accountLabel,
      scopes: connection.scopes,
      caller,
    });
  } catch (error) {
    await recordAudit({
      module,
      action: 'connect',
      actorUid: uid,
      outcome: 'failed',
      note: sanitizeErrorMessage(error),
    });
    return fail(request, module, 'store_failed', sanitizeErrorMessage(error));
  }

  await recordAudit({
    module,
    action: 'connect',
    actorUid: uid,
    outcome: 'ok',
    note: `Account connected for ${connection.accountLabel ?? 'the administrator'}.`,
  });

  const success = new URL(DASHBOARD, request.url);
  success.searchParams.set('connected', module);
  return withClearedCookies(NextResponse.redirect(success), module);
}
