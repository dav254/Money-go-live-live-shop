
import { NextRequest, NextResponse } from 'next/server';
import { db, auth as adminAuth } from '@/firebase/server';
import axios from 'axios';

/**
 * Handles the OAuth callback from TikTok.
 * Exchanges the authorization code for an access token and saves it to the user's profile.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // The user's UID
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL('/dashboard/seller/settings?error=tiktok_denied', request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard/seller/settings?error=invalid_tiktok_response', request.url));
  }
  
  const userId = state; // The state parameter should contain the user's UID

  try {
    // Exchange authorization code for an access token
    const tokenResponse = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/tiktok/callback`,
    }), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        }
    });

    const {
      access_token,
      refresh_token,
      expires_in,
      open_id,
      scope,
    } = tokenResponse.data;

    if (!access_token) {
      throw new Error('Failed to retrieve access token from TikTok.');
    }
    
    // Calculate expiry date
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Save the credentials to the user's profile in Firestore
    const userProfileRef = db.doc(`userProfiles/${userId}`);
    await userProfileRef.update({
      'connections.tiktok': {
        openId: open_id,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: expiresAt,
        scopes: scope.split(','),
        connectedAt: new Date(),
      }
    });

    // Redirect user back to the settings page with a success message
    return NextResponse.redirect(new URL('/dashboard/seller/settings?success=tiktok_connected', request.url));

  } catch (err: any) {
    console.error('TikTok OAuth callback error:', err.response?.data || err.message);
    const errorMessage = err.response?.data?.error_description || 'An unknown error occurred during TikTok authentication.';
    return NextResponse.redirect(new URL(`/dashboard/seller/settings?error=${encodeURIComponent(errorMessage)}`, request.url));
  }
}
