

import { NextRequest, NextResponse } from 'next/server';
import { getTikTokAccessToken } from '@/lib/tiktok';
import { initializeAdminApp } from '@/firebase/admin';

/**
 * This API route handles the callback from TikTok after a user authorizes our application.
 * It exchanges the received authorization code for an access token and refresh token.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error(`TikTok Auth Error: ${error}`);
    // Redirect to the settings page with an error message
    return NextResponse.redirect(new URL('/dashboard/seller/settings?error=tiktok_auth_failed', request.url));
  }

  if (!code) {
    return NextResponse.json({ message: 'Authorization code not found.' }, { status: 400 });
  }

  // In a real app, you would verify that the `state` parameter matches the one you saved
  // before the redirect to prevent CSRF attacks.

  try {
    const tokenData = await getTikTokAccessToken(code);

    // CRITICAL: Save the access_token and refresh_token securely.
    // The `open_id` uniquely identifies the TikTok user. You must associate this
    // with the currently logged-in Go Earn seller in your database.
    
    initializeAdminApp();
    const { getAuth } = await import('firebase-admin/auth');
    
    // For this example, we'll assume the logged-in user's ID is available.
    // In a real scenario, you'd get this from a secure session or token.
    const goEarnUserId = 'PLACEHOLDER_CURRENT_USER_ID'; 
    
    console.log(`--- TikTok Tokens Received for open_id: ${tokenData.open_id} ---`);
    console.log(`- Go Earn User ID to associate with: ${goEarnUserId}`);
    console.log(`- Access Token: ${tokenData.access_token}`);
    console.log(`- Refresh Token: ${tokenData.refresh_token}`);
    console.log('--- SAVING TO DATABASE (SIMULATED) ---');

    // Here you would find the user in your database (e.g., in userProfiles) and
    // add a new field like `tiktokIntegration` with the encrypted tokens.
    // const userRef = db.collection('userProfiles').doc(goEarnUserId);
    // await userRef.update({
    //   'connections.tiktok': {
    //     openId: tokenData.open_id,
    //     accessToken: encrypt(tokenData.access_token), // IMPORTANT: Always encrypt tokens
    //     refreshToken: encrypt(tokenData.refresh_token),
    //     expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    //   }
    // });


    // Redirect the user back to the settings page with a success message
    return NextResponse.redirect(new URL('/dashboard/seller/settings?success=tiktok_connected', request.url));

  } catch (apiError: any) {
    console.error('Failed to exchange TikTok code for token:', apiError);
    return NextResponse.redirect(new URL('/dashboard/seller/settings?error=tiktok_token_exchange_failed', request.url));
  }
}
