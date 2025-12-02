
import { db } from '@/firebase/server';
import type { BoostRequest } from './types';

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;

// NOTE: You must configure this in your TikTok Developer App settings.
const REDIRECT_URI = 'https://your-app-url.com/api/tiktok/callback';

/**
 * Generates the URL to which we redirect the user for TikTok authentication.
 * @returns The TikTok OAuth URL.
 */
export function getTikTokAuthUrl(): string {
    if (!TIKTOK_CLIENT_KEY) {
        throw new Error("TikTok client key is not configured.");
    }
    const csrfState = Math.random().toString(36).substring(2);
    // In a real app, you would save this `csrfState` to the user's session or a temporary store
    // to verify it in the callback.

    const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
    url.searchParams.append('client_key', TIKTOK_CLIENT_KEY);
    url.searchParams.append('scope', 'video.upload,user.info.basic');
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('redirect_uri', REDIRECT_URI);
    url.searchParams.append('state', csrfState);

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

    // Placeholder for the actual API call.
    // In a real implementation, you would use `fetch` to make this POST request.
    console.log('--- MOCK TIKTOK API CALL ---');
    console.log('POST to', url.toString());
    console.log('Body:', body.toString());
    console.log('--- END MOCK --');

    // Mock response
    return {
        access_token: 'mock_access_token_for_' + code,
        expires_in: 3600,
        refresh_token: 'mock_refresh_token',
        open_id: 'mock_open_id',
        scope: 'video.upload,user.info.basic',
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

    // After a successful mock upload, update the boost request in Firestore
    await db.collection('boost_requests').doc(boost.id).update({
        tiktokVideoId: mockTikTokVideoId,
        status: 'approved', // Ensure status is correctly set
    });

    return {
        success: true,
        videoId: mockTikTokVideoId,
        message: "Video successfully uploaded to TikTok (simulated)."
    };
}
