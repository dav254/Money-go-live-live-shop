import { NextRequest, NextResponse } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { isAdminUid } from '@/lib/server/admin-guard';
import { MODULE_IDS, isModuleId, type ModuleId } from '@/lib/social-engine/types';
import { MODULE_SPECS } from '@/lib/social-engine/modules';
import {
  TUMBLR_OAUTH,
  buildAuthorizeUrl,
  callbackUrl,
  validateRegisteredCallback,
} from '@/lib/social-engine/flows';
import {
  callbackEnvName,
  issueState,
  oauth1AuthorizationHeader,
  stateCookieName,
  stateCookieOptions,
} from '@/lib/social-engine/oauth';
import { sanitizeErrorMessage } from '@/lib/vidnov-core/distribution/job-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DASHBOARD = '/dashboard/admin/system/social-engine';

/** Cookie that carries the Tumblr request-token secret until the callback. */
function tumblrSecretCookieName(): string {
  return `${stateCookieName('tumblr')}_req`;
}

function wantsJson(request: NextRequest): boolean {
  if (new URL(request.url).searchParams.get('json') === '1') return true;
  return (request.headers.get('accept') ?? '').includes('application/json');
}

/** Env names the module cannot start without, missing ones only. */
function missingRequired(module: ModuleId): string[] {
  return MODULE_SPECS[module].env
    .filter((spec) => spec.required && !(process.env[spec.name] ?? '').trim())
    .map((spec) => spec.name);
}

/**
 * Tumblr is OAuth 1.0a: there is no static authorize URL, so a signed request
 * token is obtained first. Its secret is kept in an HttpOnly cookie and only
 * used by the callback, which is the same browser that started the flow.
 */
async function tumblrAuthorizeUrl(): Promise<{ url?: string; requestTokenSecret?: string; note?: string }> {
  const consumerKey = (process.env.TUMBLR_CONSUMER_KEY ?? '').trim();
  const consumerSecret = (process.env.TUMBLR_CONSUMER_SECRET ?? '').trim();
  if (!consumerKey || !consumerSecret) {
    return { note: 'TUMBLR_CONSUMER_KEY / TUMBLR_CONSUMER_SECRET are not set.' };
  }

  const params = { oauth_callback: callbackUrl('tumblr') };
  const header = oauth1AuthorizationHeader({
    method: 'POST',
    url: TUMBLR_OAUTH.requestToken,
    consumerKey,
    consumerSecret,
    params,
  });

  try {
    const res = await fetch(TUMBLR_OAUTH.requestToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: header },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { note: `Tumblr request-token exchange failed (HTTP ${res.status}).` };
    const parsed = new URLSearchParams(await res.text());
    const token = parsed.get('oauth_token');
    const tokenSecret = parsed.get('oauth_token_secret');
    if (!token || !tokenSecret || parsed.get('oauth_callback_confirmed') !== 'true') {
      return { note: 'Tumblr did not confirm the request token — check the registered callback URL.' };
    }
    // The request-token secret rides with the browser in an HttpOnly cookie,
    // never in the URL (a URL ends up in history, logs and Referer headers).
    return {
      url: `${TUMBLR_OAUTH.authorize}?oauth_token=${encodeURIComponent(token)}`,
      requestTokenSecret: tokenSecret,
    };
  } catch (error) {
    return { note: `Tumblr request-token exchange failed: ${sanitizeErrorMessage(error)}` };
  }
}

/**
 * GET /api/social-engine/[module]/connect — start the OAuth flow.
 *
 * Admin or seller. In order:
 *   • required env vars must be present (names are reported, never values),
 *   • the registered callback env var must equal the fixed callback URL,
 *   • a signed, expiring state is issued for THIS uid,
 *   • the state is stored in an HttpOnly cookie bound to the browser,
 *   • the browser is redirected to the provider (TikTok reuses the existing
 *     hardened Social Reach flow; server-credential modules have no flow).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ module: string }> },
) {
  const user = await verifyUserContext(request);
  if (!user) {
    return NextResponse.redirect(new URL(`/login?returnTo=${encodeURIComponent(DASHBOARD)}`, request.url));
  }

  const isAdmin = user.isAdmin || (await isAdminUid(user.uid));
  const { module } = await params;
  if (!isModuleId(module)) {
    return NextResponse.json({ error: 'Unknown module.', modules: MODULE_IDS }, { status: 404 });
  }
  if (!isAdmin && user.role !== 'seller') {
    return NextResponse.json({ authorize: false, note: 'Only sellers and administrators can connect an account.' }, { status: 403 });
  }

  // TikTok already has a hardened connect flow in this repository — reuse it
  // rather than reimplementing the same handshake.
  if (module === 'tiktok') {
    if (wantsJson(request)) return NextResponse.json({ authorizeUrl: '/api/tiktok/connect' });
    return NextResponse.redirect(new URL('/api/tiktok/connect', request.url));
  }

  const spec = MODULE_SPECS[module];
  if (spec.connectionKind !== 'oauth') {
    return NextResponse.json({
      authorize: false,
      note: 'This module is configured with server-level credentials — set the variables, then run Test. No OAuth flow is needed.',
      requiredEnvVars: spec.env.map((env) => env.name),
    });
  }

  const missing = missingRequired(module);
  if (missing.length > 0) {
    return NextResponse.json(
      { authorize: false, note: `Set ${missing.join(', ')} on the server before connecting.`, missingEnvVars: missing },
      { status: 409 },
    );
  }

  // Registered callback validation: only enforced for modules whose spec
  // actually declares a callback variable (Google's is derived, not declared).
  const envName = callbackEnvName(module);
  const declaresCallback = spec.env.some((env) => env.name === envName);
  if (declaresCallback) {
    const checked = validateRegisteredCallback(process.env[envName], module);
    if (!checked.ok) {
      return NextResponse.json(
        { authorize: false, note: checked.reason ?? `${envName} is not configured.`, missingEnvVars: [envName] },
        { status: 409 },
      );
    }
  }

  let state: string;
  try {
    state = issueState(user.uid);
  } catch (error) {
    return NextResponse.json(
      { authorize: false, note: sanitizeErrorMessage(error) },
      { status: 503 },
    );
  }

  let authorizeUrl: string | undefined;
  let requestTokenSecret: string | undefined;

  if (module === 'tumblr') {
    const started = await tumblrAuthorizeUrl();
    if (!started.url) {
      return NextResponse.json({ authorize: false, note: started.note ?? 'Tumblr connect failed.' }, { status: 409 });
    }
    authorizeUrl = started.url;
    requestTokenSecret = started.requestTokenSecret;
  } else {
    const authorize = buildAuthorizeUrl(module, state);
    if (!authorize || !authorize.uri) {
      return NextResponse.json({ authorize: false, note: 'This module has no OAuth authorization endpoint.' }, { status: 409 });
    }
    // `buildAuthorizeUrl` embeds the state exactly once; appending it again
    // would produce a duplicated parameter.
    authorizeUrl = authorize.uri;
  }

  if (!authorizeUrl) {
    return NextResponse.json({ authorize: false, note: 'No authorization URL could be built.' }, { status: 409 });
  }

  const response = wantsJson(request)
    ? NextResponse.json({ authorizeUrl, stateBound: true, callbackUrl: callbackUrl(module) })
    : NextResponse.redirect(authorizeUrl);

  response.cookies.set(stateCookieName(module), state, stateCookieOptions());
  if (requestTokenSecret) {
    response.cookies.set(tumblrSecretCookieName(), requestTokenSecret, stateCookieOptions());
  }
  return response;
}
