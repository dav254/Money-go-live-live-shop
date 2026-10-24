import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { saveTikTokConnection } from '@/lib/tiktok/store';
import {
  verifyOAuthState,
  oauthStateSecret,
  tikTokCallbackRedirectUri,
  SOCIAL_REACH_PAGE,
  STATE_COOKIE,
} from '@/lib/tiktok/oauth-state';

export const runtime = 'nodejs';

/**
 * Handles the OAuth callback from TikTok.
 *
 * Hardened against the original flow's problems:
 *   • `state` was the raw UID (no CSRF protection). It is now an HMAC-signed,
 *     expiring, single-use nonce that must match an HttpOnly cookie issued by
 *     /api/tiktok/connect — binding the flow to the browser that started it.
 *   • Tokens were written into `userProfiles` (world-readable). They now go
 *     to the server-only `tiktok_connections/{uid}` collection.
 *   • The token response was never validated. It now is, before any write.
 *   • Error logs could echo upstream payloads; now only codes are logged.
 *
 * Redirects always go to the fixed Social Reach page — never a URL from the
 * request — so this cannot be used as an open redirect.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const denied = url.searchParams.get('error');
  const cookie = request.cookies.get(STATE_COOKIE)?.value;
  const goBack = (qs: string) =>
    NextResponse.redirect(new URL(`${SOCIAL_REACH_PAGE}?${qs}`, tikTokCallbackRedirectUri().replace('/api/tiktok/callback', '')));

  // Always clear the binding cookie: single-use, whatever the outcome.
  // (Manual Set-Cookie: the cookie was scoped to /api/tiktok, which must
  // match exactly for the deletion to take.)
  const finalize = (qs: string) => {
    const res = goBack(qs);
    res.headers.append(
      'set-cookie',
      `${STATE_COOKIE}=; Path=/api/tiktok; HttpOnly; SameSite=Lax${
        process.env.NODE_ENV === 'production' ? '; Secure' : ''
      }; Max-Age=0`,
    );
    return res;
  };

  if (denied) {
    // User pressed "Decline" on TikTok (or an error occurred there).
    return finalize('error=denied');
  }

  const userId = verifyOAuthState(state, cookie, oauthStateSecret());
  if (!code || !userId) {
    // Raw UIDs, tampered/expired states and cross-browser replays all land here.
    console.error('[tiktok] callback rejected invalid state');
    return finalize('error=invalid_state');
  }

  try {
    const tokenResponse = await axios.post(
      'https://open.tiktokapis.com/v2/oauth/token/',
      new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: tikTokCallbackRedirectUri(),
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15_000 },
    );

    const { access_token, refresh_token, expires_in, open_id, scope } = tokenResponse.data ?? {};

    // Validate before storing anything — a partial response must never be saved.
    if (typeof access_token !== 'string' || !access_token || typeof open_id !== 'string' || !open_id) {
      console.error('[tiktok] token exchange returned incomplete credentials');
      return finalize('error=invalid_token_response');
    }

    await saveTikTokConnection(userId, {
      openId: open_id,
      accessToken: access_token,
      refreshToken: typeof refresh_token === 'string' && refresh_token ? refresh_token : undefined,
      expiresAt: typeof expires_in === 'number' ? Date.now() + expires_in * 1000 : null,
      scopes: typeof scope === 'string' ? scope.split(',').map((s) => s.trim()).filter(Boolean) : [],
      connectedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return finalize('success=tiktok_connected');
  } catch (error) {
    // Log the code only — never the token response or authorization code.
    const upstream = (error as { response?: { status?: number; data?: { error?: string } } })?.response;
    console.error('[tiktok] token exchange failed', upstream?.status ?? '', upstream?.data?.error ?? (error as Error)?.message);
    return finalize('error=exchange_failed');
  }
}
