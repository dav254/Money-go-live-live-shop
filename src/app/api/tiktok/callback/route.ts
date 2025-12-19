
import { NextRequest, NextResponse } from 'next/server';
import { getTikTokAccessToken } from '@/lib/tiktok';
import { db } from '@/firebase/server';

/**
 * This API route handles the callback from TikTok after a user authorizes our application.
 * It exchanges the received authorization code for an access token and refresh token,
 * then securely saves the connection details to the user's profile.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // The user's Go Earn UID
  const error = searchParams.get('error');

  if (error) {
    console.error(`TikTok Auth Error: ${error}`);
    // Redirect to the settings page with an error message
    return NextResponse.redirect(new URL('/dashboard/seller/settings?success=tiktok_connection_failed', request.url));
  }

  if (!code || !state) {
    return NextResponse.json({ message: 'Authorization code or state (user ID) not found.' }, { status: 400 });
  }
  
  const goEarnUserId = state;

  try {
    const tokenData = await getTikTokAccessToken(code);

    if (!tokenData.open_id) {
        throw new Error("TikTok API did not return an open_id.");
    }

    const userRef = db.collection('userProfiles').doc(goEarnUserId);

    await userRef.update({
      'connections.tiktok': {
        openId: tokenData.open_id,
        accessToken: tokenData.access_token, // Encrypt this in production
        refreshToken: tokenData.refresh_token, // Encrypt this in production
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        scopes: tokenData.scope.split(','),
        connectedAt: new Date(),
      }
    });

    // Redirect the user back to the settings page with a success message
    return NextResponse.redirect(new URL('/dashboard/seller/settings?success=tiktok_connected', request.url));

  } catch (apiError: any) {
    console.error('Failed to exchange TikTok code for token or save to Firestore:', apiError);
    return NextResponse.redirect(new URL('/dashboard/seller/settings?error=tiktok_token_exchange_failed', request.url));
  }
}
