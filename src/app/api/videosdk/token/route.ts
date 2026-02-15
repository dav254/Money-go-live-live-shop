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
    console.error('CRITICAL: VideoSDK API_KEY or SECRET_KEY is not configured in .env');
    return NextResponse.json(
      { error: 'VideoSDK is not correctly configured on the server.' },
      { status: 500 }
    );
  }

  try {
    const options = { expiresIn: '120m', algorithm: 'HS256' };
    const payload = {
      apikey: API_KEY,
      permissions: ['allow_join', 'allow_mod'], 
      version: 2, // Use version 2 for optimized latency and participant discovery
    };

    // @ts-ignore
    const token = jwt.sign(payload, SECRET_KEY, options);

    return NextResponse.json({ token }, {
        headers: {
            'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
            'X-Signal-Version': '2.0'
        }
    });
  } catch (error: any) {
    console.error('Error generating VideoSDK token:', error);
    return NextResponse.json(
      { error: 'Failed to generate access token.' },
      { status: 500 }
    );
  }
}