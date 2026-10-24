import { NextRequest, NextResponse } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { issueOAuthState, oauthStateSecret, tikTokCallbackRedirectUri, STATE_COOKIE } from '@/lib/tiktok/oauth-state';

export const runtime = 'nodejs';

/**
 * GET /api/tiktok/connect — starts the TikTok OAuth flow for the signed-in
 * seller (or admin). Issues an HMAC-signed, 10-minute, single-use state,
 * binds it to this browser via an HttpOnly cookie, and redirects to TikTok's
 * consent screen.
 *
 * Everything is built server-side from `TIKTOK_CLIENT_KEY` (the public key
 * half only — the secret never leaves the server and never appears in
 * NEXT_PUBLIC variables). The redirect URI matches the callback route and the
 * existing TikTok developer-portal registration exactly.
 */

export async function GET(request: NextRequest) {
  const user = await verifyUserContext(request);
  // Server-side authorization: a buyer must never start a seller connect.
  if (!user) return NextResponse.redirect(new URL('/login', request.url));
  if (user.role !== 'seller' && user.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard/seller/social-reach?error=not_seller', request.url));
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const secret = oauthStateSecret();
  if (!clientKey || !secret) {
    // Fail safely and loudly (no secret values): document what is missing.
    console.error(
      '[tiktok] connect blocked — missing TIKTOK_CLIENT_KEY' +
        (secret ? '' : ' / TIKTOK_OAUTH_SECRET (or TIKTOK_CLIENT_SECRET)'),
    );
    return NextResponse.redirect(new URL('/dashboard/seller/social-reach?error=not_configured', request.url));
  }

  const state = issueOAuthState(user.uid, secret);

  const params = new URLSearchParams({
    client_key: clientKey,
    scope: 'video.publish', // only what publishing needs — nothing more
    response_type: 'code',
    redirect_uri: tikTokCallbackRedirectUri(),
    state,
  });
  const authorizeUrl = `https://www.tiktok.com/v2/auth/authorize?${params.toString()}`;

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/tiktok',
    maxAge: 600,
  });

  // The dashboard is a SPA that authenticates with a Bearer token (no cookie
  // session), so the page fetches this route with Accept: application/json
  // (which carries the Set-Cookie) and then performs the top-level redirect
  // itself. Plain navigation keeps the redirect for convenience.
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');
  if (wantsJson) {
    const json = NextResponse.json({ authorizeUrl });
    json.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/tiktok',
      maxAge: 600,
    });
    return json;
  }
  return response;
}
