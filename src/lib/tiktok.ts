
import type { BoostRequest } from './types';
import fetch from 'node-fetch';

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;

// NOTE: You must configure this in your TikTok Developer App settings.
const REDIRECT_URI = process.env.NEXT_PUBLIC_TIKTOK_REDIRECT_URI || 'http://localhost:3000/api/tiktok/callback';


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
 * This now performs a real API call.
 * @param code The authorization code from the TikTok callback.
 * @returns The access token data from TikTok.
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

    const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body,
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("TikTok Access Token Error:", errorData);
        throw new Error(errorData.error_description || 'Failed to exchange authorization code for token.');
    }
    
    return await response.json();
}


/**
 * Uploads a video to TikTok using the official API.
 * This is a multi-step process.
 * @param boost The boost request containing video details.
 * @param accessToken The TikTok access token for the user.
 * @returns An object indicating success, the new video ID, and a message.
 */
export async function uploadVideoToTikTok(boost: BoostRequest, accessToken: string): Promise<{ success: boolean; videoId?: string; message: string }> {
    if (!accessToken) {
        return { success: false, message: "Missing TikTok access token." };
    }

    try {
        // Step 1: Initiate video upload to get an upload URL
        const initResponse = await fetch('https://open.tiktokapis.com/v2/video/upload/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
            },
        });

        if (!initResponse.ok) {
            const errorData = await initResponse.json();
            throw new Error(`TikTok API Error (Init): ${errorData.error.message}`);
        }
        
        const initData = await initResponse.json();
        const uploadUrl = initData.data.upload_url;

        // Step 2: Download our video from Cloudinary and upload it to TikTok's URL
        const videoResponse = await fetch(boost.videoUrl);
        const videoBlob = await videoResponse.blob();

        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'video/mp4',
            },
            body: videoBlob,
        });

        if (uploadResponse.status !== 200) {
             throw new Error(`TikTok API Error (Upload): Failed to upload video file. Status: ${uploadResponse.status}`);
        }

        // Step 3: Create the post on TikTok using the uploaded video
        const createResponse = await fetch('https://open.tiktokapis.com/v2/video/post/', {
            method: 'POST',
            headers: {
                 'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
            },
            body: JSON.stringify({
                video_id: initData.data.video_id,
                post_info: {
                    title: boost.caption,
                    privacy_level: 'PUBLIC_TO_EVERYONE',
                    // Add more options like brand content toggles, etc. here if needed
                }
            })
        });

        if (!createResponse.ok) {
            const errorData = await createResponse.json();
            throw new Error(`TikTok API Error (Post): ${errorData.error.message}`);
        }

        const createData = await createResponse.json();
        const videoId = createData.data.video_id;

        return {
            success: true,
            videoId: videoId,
            message: "Video successfully uploaded and posted to TikTok.",
        };

    } catch (error: any) {
        console.error('Full TikTok upload process failed:', error);
        return { success: false, message: error.message || 'An unknown error occurred during TikTok upload.' };
    }
}
