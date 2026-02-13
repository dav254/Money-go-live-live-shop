
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

/**
 * Securely generates a VideoSDK access token using the API Key and Secret Key
 * stored in the server-side environment variables.
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
      permissions: ['allow_join', 'allow_mod'], // Allow both joining and moderating (starting) streams
      version: 2,
    };

    // @ts-ignore
    const token = jwt.sign(payload, SECRET_KEY, options);

    return NextResponse.json({ token });
  } catch (error: any) {
    console.error('Error generating VideoSDK token:', error);
    return NextResponse.json(
      { error: 'Failed to generate access token.' },
      { status: 500 }
    );
  }
}
