import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

/**
 * VideoSDK access token (server-side only — the browser never sees the secret).
 *
 * Two modes:
 *  1. VIDEOSDK_API_KEY + VIDEOSDK_SECRET_KEY → mint a fresh 2-hour token
 *     server-side (the normal, recommended setup).
 *  2. VIDEOSDK_TOKEN only → serve the pre-issued token from the VideoSDK
 *     dashboard. Works for joining, expires when the dashboard token expires.
 */
export async function GET() {
  const API_KEY = process.env.VIDEOSDK_API_KEY;
  const SECRET_KEY = process.env.VIDEOSDK_SECRET_KEY;
  const STATIC_TOKEN = process.env.VIDEOSDK_TOKEN;

  if (API_KEY && SECRET_KEY) {
    try {
      const token = jwt.sign(
        { apikey: API_KEY, permissions: ['allow_join', 'allow_mod'], version: 2 },
        SECRET_KEY,
        { expiresIn: '120m', algorithm: 'HS256' },
      );
      return NextResponse.json(
        { token, source: 'minted' },
        { headers: { 'Cache-Control': 'private, max-age=3600', 'X-Signal-Version': '2.0' } },
      );
    } catch (error) {
      console.error('[VideoSDK] token signing failed:', error);
      return NextResponse.json(
        { error: 'SERVER_ERROR', message: 'Failed to generate access token.' },
        { status: 500 },
      );
    }
  }

  if (STATIC_TOKEN) {
    return NextResponse.json(
      { token: STATIC_TOKEN, source: 'static', expiresAt: staticTokenExpiry(STATIC_TOKEN) },
      { headers: { 'Cache-Control': 'private, max-age=300', 'X-Signal-Version': '2.0' } },
    );
  }

  console.warn('[VideoSDK] API keys missing in environment variables.');
  return NextResponse.json(
    {
      error: 'CONFIG_MISSING',
      message: 'VideoSDK API keys are not configured on this server.',
    },
    { status: 500 },
  );
}

/** Reads the `exp` claim so the UI can warn before the token dies. */
function staticTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString('utf8'),
    ) as { exp?: number };
    return payload.exp ?? null;
  } catch {
    return null;
  }
}