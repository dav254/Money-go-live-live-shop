
import type { BoostRequest } from './types';

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;

// NOTE: You must configure this in your TikTok Developer App settings.
const REDIRECT_URI = process.env.NEXT_PUBLIC_TIKTOK_REDIRECT_URI || 'https://your-app-url.com/api/tiktok/callback';


/**
 * Generates the URL to which we redirect the user for TikTok authentication.
 * @param goEarnUserId The current user's ID to pass through the state parameter.
 * @returns The TikTok OAuth URL.
 */
export function getTikTokAuthUrl(goEarnUserId: string): string {
    if (!TIKTOK_CLIENT_KEY) {
        throw new Error("TikTok client key is not configured.");
    }
    
    const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
    url.searchParams.append('client_key', TIKTOK_CLIENT_KEY);
    // Request the necessary scopes for uploading video and getting user info
    url.searchParams.append('scope', 'video.upload,user.info.basic');
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('redirect_uri', REDIRECT_URI);
    // Pass the user's Go Earn ID in the state parameter to identify them in the callback
    url.searchParams.append('state', goEarnUserId);

    return url.toString();
}


/**
 * Exchanges an authorization code for an access token.
 * @param code The authorization code from the TikTok callback.
 * @returns The access token data.
 */
export async function getTikTokAccessToken(code: string): Promise<any> {
    if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
        throw new Error("TikTok credentials are not configured.");
    }

    const url = new URL('https://open.tiktokapis.com/v2/oauth/token/');
    const body = new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
    });

    // In a real implementation, you would use `fetch` to make this POST request.
    // For now, we continue to mock the response for demonstration.
    console.log('--- MOCK TIKTOK API CALL for Access Token ---');
    console.log('POST to', url.toString());
    console.log('Body:', body.toString());
    console.log('--- END MOCK --');

    // Mock response simulating a successful token exchange
    return {
        access_token: 'mock_access_token_for_' + code,
        expires_in: 86400, // 24 hours in seconds
        refresh_token: 'mock_refresh_token_for_' + code,
        refresh_expires_in: 31536000, // 1 year in seconds
        open_id: 'mock_open_id_' + Math.random().toString(36).substring(2),
        scope: 'video.upload,user.info.basic',
        token_type: 'Bearer',
    };
}


/**
 * Placeholder function to simulate uploading a video to TikTok.
 * In a real-world scenario, this would involve a multi-step process with the TikTok API:
 * 1. POST to /v2/video/upload/ to get an upload URL.
 * 2. PUT the video file to the signed upload URL.
 * 3. Check the upload status.
 * @param boost The boost request containing video details.
 * @param accessToken The TikTok access token for the user.
 */
export async function uploadVideoToTikTok(boost: BoostRequest, accessToken: string): Promise<{ success: boolean; videoId?: string; message: string }> {
    if (!accessToken) {
        return { success: false, message: "Missing TikTok access token." };
    }

    console.log(`--- MOCK TIKTOK VIDEO UPLOAD for Boost ID: ${boost.id} ---`);
    console.log(`- Using Access Token: ${accessToken}`);
    console.log(`- Video URL to upload: ${boost.videoUrl}`);
    console.log(`- Caption: ${boost.caption}`);
    console.log('--- END MOCK --');

    // This is where the actual multi-step upload logic would go.
    // For now, we simulate a successful upload and return a mock video ID.

    const mockTikTokVideoId = `tt_${new Date().getTime()}`;

    // The database update is now handled by the calling API route, not this library function.

    return {
        success: true,
        videoId: mockTikTokVideoId,
        message: "Video successfully uploaded to TikTok (simulated)."
    };
}
