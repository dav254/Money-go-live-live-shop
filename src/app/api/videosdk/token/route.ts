import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

/**
 * Securely generates a VideoSDK access token.
 * Optimized for speed to prevent handshake timeouts.
 */
export async function GET() {
  const API_KEY = process.env.VIDEOSDK_API_KEY;
  const SECRET_KEY = process.env.VIDEOSDK_SECRET_KEY;

  // Frontend-only fallback mode to prevent hard "Authentication failure" errors
  if (!API_KEY || !SECRET_KEY) {
    console.warn("[VideoSDK] API keys missing. Returning fallback token for development.");
    return NextResponse.json({ 
        token: "fallback_token_development_only",
        isFallback: true 
    }, {
        headers: { 
          'X-VideoSDK-Status': 'development-fallback',
          'Cache-Control': 'no-store' 
        }
    });
  }

  try {
    const options = { expiresIn: '120m', algorithm: 'HS256' };
    const payload = {
      apikey: API_KEY,
      permissions: ['allow_join', 'allow_mod'], 
      version: 2, 
    };

    // @ts-ignore
    const token = jwt.sign(payload, SECRET_KEY, options);

    return NextResponse.json({ token }, {
        headers: {
            'Cache-Control': 'private, max-age=3600',
            'X-Signal-Version': '2.0'
        }
    });
  } catch (error: any) {
    console.error('Error generating VideoSDK token:', error);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Failed to generate access token.' },
      { status: 500 }
    );
  }
}
