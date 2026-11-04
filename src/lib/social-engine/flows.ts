/**
 * SOCIAL ENGINE — OAuth flow builders (Phases 3–5, 7).
 *
 * Builds the correct authorization URL + token exchange for every OAuth
 * module, and reuses the hardened state implementation from
 * `src/lib/tiktok/oauth-state.ts` for every Social Engine connect flow.
 *
 * The real HTTP calls live in the API routes — this module deliberately
 * holds ONLY the pure builders and the token-endpoint map, so the routes
 * stay thin and each platform's exchange can be unit-tested with a fake.
 */

import { callbackUrl } from './url-track';
import { validateRegisteredCallback } from './oauth';

/**
 * The one Meta Graph version this repository speaks. Shared by the OAuth
 * builders (this file), the diagnostics and the publishing adapters so a
 * version bump happens in exactly one place.
 */
export const META_GRAPH_API = 'https://graph.facebook.com/v26.0';

/** `GET {origin}/api/social-engine/callback/{module}` — fixed, never from input. */
export function callbackPath(module: string): string {
  return `/api/social-engine/callback/${module}`;
}

// One callback builder lives in url-track (validated against the registry).
export { callbackUrl };

// The registered-callback comparison also lives in exactly one place.
export { validateRegisteredCallback };

/**
 * Canonical OAuth2 authorize URL for each module. The redirect URI is
 * always the SAME fixed path — the registered callback, never user input.
 */
export interface AuthorizeUrl {
  module: string;
  uri: string;
  stateHeader: string;
  /** Scopes to request, joined with spaces. */
  scope?: string;
}

export function buildAuthorizeUrl(module: string, state: string): AuthorizeUrl | null {
  switch (module) {
    case 'telegram':
      // Server-level credential — no OAuth handshake. The admin supplies the
      // bot token directly; the connect route reports this instead.
      return null;
    case 'bluesky':
      return null;
    case 'mastodon': {
      const host = (process.env.MASTODON_INSTANCE_URL ?? 'https://mastodon.social').replace(/\/+$/, '');
      return {
        module,
        uri: `${host}/oauth/authorize?client_id=${encodeURIComponent(process.env.MASTODON_CLIENT_ID ?? '')}&redirect_uri=${encodeURIComponent(callbackUrl(module))}&response_type=code&scope=read+write&state=${encodeURIComponent(state)}`,
        stateHeader: `mastodon ${state}`,
        scope: 'read write',
      };
    }
    case 'discord': {
      const clientId = process.env.DISCORD_APPLICATION_ID ?? '';
      return {
        module,
        uri: `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(callbackUrl(module))}&response_type=code&scope=identify%20guilds&state=${encodeURIComponent(state)}`,
        stateHeader: `discord ${state}`,
        scope: 'identify guilds',
      };
    }
    case 'tumblr':
      // Tumblr is OAuth 1.0a: no static authorize URL exists. The connect
      // route obtains a request token first and redirects to
      // /oauth/authorize?oauth_token=… (see `tumblrRequestToken` below).
      return null;
    case 'facebook':
    case 'instagram': {
      const clientId = process.env.META_APP_ID ?? '';
      const scope = module === 'instagram'
        ? 'pages_read_engagement,instagram_basic,instagram_content_publish'
        : 'pages_read_engagement,pages_manage_posts';
      return {
        module,
        uri: `https://www.facebook.com/v26.0/dialog/oauth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(callbackUrl(module))}&scope=${encodeURIComponent(scope)}&response_type=code&state=${encodeURIComponent(state)}`,
        stateHeader: `${module} ${state}`,
        scope,
      };
    }
    case 'google': {
      const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
      return {
        module,
        uri: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(callbackUrl(module))}&response_type=code&scope=openid%20email%20profile&state=${encodeURIComponent(state)}`,
        stateHeader: `google ${state}`,
        scope: 'openid email profile',
      };
    }
    default:
      return null;
  }
}

/**
 * Token-exchange map: each OAuth module posts its code to a fixed endpoint.
 * All fields are static configs, so a route can loop over this map instead
 * of shipping an `if/else` per module.
 */
export interface TokenExchange {
  module: string;
  tokenEndpoint: string;
  /** Scopes as a space-separated string, echoed back so the dashboard can
   *  distinguish requested from granted. */
  scope?: string;
  /** Post-exchange identity fetch (current user) — present when the token
   *  response has no profile, or the route should refresh profile info. */
  identity?: string;
}

/**
 * Tumblr OAuth 1.0a endpoints. The connect route calls the request-token
 * endpoint (signed), then sends the browser to `authorize` with the request
 * token it received; the callback exchanges that token for an access token.
 */
export const TUMBLR_OAUTH = {
  requestToken: 'https://www.tumblr.com/oauth/request_token',
  authorize: 'https://www.tumblr.com/oauth/authorize',
  accessToken: 'https://www.tumblr.com/oauth/access_token',
} as const;

export const TOKEN_EXCHANGES: Record<string, TokenExchange> = {
  mastodon: {
    module: 'mastodon',
    tokenEndpoint: (process.env.MASTODON_INSTANCE_URL ?? 'https://mastodon.social').replace(/\/+$/, '') + '/oauth/token',
    scope: 'read write',
    identity: (process.env.MASTODON_INSTANCE_URL ?? 'https://mastodon.social').replace(/\/+$/, '') + '/api/v1/accounts/verify_credentials',
  },
  discord: {
    module: 'discord',
    tokenEndpoint: 'https://discord.com/api/v10/oauth2/token',
    scope: 'identify guilds',
    identity: 'https://discord.com/api/v10/users/@me',
  },
  facebook: {
    module: 'facebook',
    tokenEndpoint: `${META_GRAPH_API}/oauth/access_token`,
    scope: 'pages_read_engagement,pages_manage_posts',
    identity: `${META_GRAPH_API}/me?fields=id,name,email`,
  },
  instagram: {
    module: 'instagram',
    tokenEndpoint: `${META_GRAPH_API}/oauth/access_token`,
    scope: 'pages_read_engagement,instagram_basic,instagram_content_publish',
    identity: `${META_GRAPH_API}/me?fields=id,name,email,instagram_business_account`,
  },
  google: {
    module: 'google',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    identity: 'https://openidconnect.googleapis.com/v1/userinfo',
  },
};

export function tokenExchangeFor(module: string): TokenExchange | undefined {
  return TOKEN_EXCHANGES[module];
}

/**
 * Returns the exact redirect URI the route must register with the provider.
 * The route builds it from callbackUrl(), never from request input.
 */
export function registeredRedirectUri(module: string): string {
  return callbackUrl(module);
}


