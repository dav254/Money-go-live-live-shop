
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

/**
 * Securely generates a VideoSDK access token.
 * Optimized for version 2 protocols which offer faster participant discovery.
 */
export async function GET() {
  const API_KEY = process.env.VIDEOSDK_API_KEY;
  const SECRET_KEY = process.env.VIDEOSDK_SECRET_KEY;

  if (!API_KEY || !SECRET_KEY) {
    return NextResponse.json(
      { error: 'CONFIGURATION_REQUIRED', message: 'VideoSDK API keys are not configured. Please add VIDEOSDK_API_KEY and VIDEOSDK_SECRET_KEY to your .env file.' },
      { status: 401 }
    );
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
