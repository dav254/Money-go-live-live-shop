import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

/**
 * Securely generates a VideoSDK access token.
 * Optimized for speed to prevent handshake timeouts.
 */
export async function GET() {
  const API_KEY = process.env.VIDEOSDK_API_KEY;
  const SECRET_KEY = process.env.VIDEOSDK_SECRET_KEY;

  if (!API_KEY || !SECRET_KEY) {
    console.warn("[VideoSDK] API keys missing in environment variables.");
    return NextResponse.json({ 
        error: 'CONFIG_MISSING',
        message: 'VideoSDK API keys are not configured on this server.' 
    }, { status: 500 });
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
