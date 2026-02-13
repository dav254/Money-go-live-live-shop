import type { BoostRequest } from './types';
import axios from 'axios';

const TIKTOK_AUTH_BASE_URL = 'https://www.tiktok.com/v2/auth/authorize';

/**
 * Generates the authorization URL for TikTok's OAuth 2.0 flow.
 * @param state A unique string to prevent CSRF attacks. Should be stored in user's session.
 * @returns The full URL to redirect the user to for authorization.
 */
export function getTikTokAuthUrl(state: string): string {
    const clientKey = process.env.NEXT_PUBLIC_TIKTOK_CLIENT_KEY;
    if (!clientKey) {
        console.warn("TikTok client key is not configured in environment variables.");
        return "#";
    }
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/tiktok/callback`;
    
    const params = new URLSearchParams({
        client_key: clientKey,
        scope: 'video.publish',
        response_type: 'code',
        redirect_uri: redirectUri,
        state: state,
    });

    return `${TIKTOK_AUTH_BASE_URL}?${params.toString()}`;
}


/**
 * Uploads a video to TikTok using the official API.
 * This is a multi-step process.
 * @param boost The boost request containing video details.
 * @param accessToken The TikTok access token for the user.
 * @param openId The Open ID for the TikTok user.
 * @returns An object indicating success, the new video ID, and a message.
 */
export async function uploadVideoToTikTok(boost: BoostRequest, accessToken: string, openId: string): Promise<{ success: boolean; videoId?: string; message: string }> {
    if (!accessToken || !openId) {
        return { success: false, message: "Missing TikTok access token or Open ID." };
    }

    try {
        // Step 1: Initiate video upload to get an upload URL
        const initResponse = await axios.post(`https://open.tiktokapis.com/v2/post/publish/video/init/`, {
            post_info: {
                title: boost.caption,
                privacy_level: 'PUBLIC_TO_EVERYONE',
                // Add other post parameters as needed
            }
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
            },
        });

        if (initResponse.data?.error?.code !== 'ok') {
             throw new Error(`TikTok API Error (Init): ${initResponse.data.error.message}`);
        }
        
        const uploadUrl = initResponse.data.data.upload_url;
        
        // Step 2: Download our video from Cloudinary using Axios
        const videoResponse = await axios.get(boost.videoUrl, {
            responseType: 'arraybuffer' 
        });
        
        if (videoResponse.status !== 200) {
            throw new Error(`Failed to download video from Cloudinary. Status: ${videoResponse.status}`);
        }
        const videoBuffer = videoResponse.data;


        // Step 3: Upload the video buffer to TikTok's URL
        const uploadResponse = await axios.put(uploadUrl, videoBuffer, {
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Length': String(videoBuffer.length)
            },
        });

        if (uploadResponse.status !== 200) {
             const errorText = uploadResponse.data;
             throw new Error(`TikTok API Error (Upload): Failed to upload video file. Status: ${uploadResponse.status}. Details: ${errorText}`);
        }

        const publishId = initResponse.data.data.publish_id;

        return {
            success: true,
            videoId: publishId,
            message: "Video successfully uploaded and posted to TikTok.",
        };

    } catch (error: any) {
        console.error('Full TikTok upload process failed:', error.isAxiosError ? error.response?.data : error.message);
        return { success: false, message: error.response?.data?.error?.message || error.message || 'An unknown error occurred during TikTok upload.' };
    }
}


/**
 * Fetches video analytics from TikTok API.
 * @param accessToken The user's TikTok access token.
 * @param videoIds An array of video IDs to fetch analytics for.
 * @returns An array of video analytics objects.
 */
export async function getTikTokVideoAnalytics(accessToken: string, videoIds: string[]): Promise<any[]> {
    if (!videoIds || videoIds.length === 0) {
        return [];
    }
    
    try {
        const response = await axios.post('https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count', {
            video_ids: videoIds,
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
            },
        });

        if (response.data?.error?.code !== 'ok') {
            console.error("TikTok Analytics Error:", response.data.error);
            throw new Error(response.data.error.message || 'Failed to fetch video analytics from TikTok.');
        }

        return response.data.data.videos || [];
    } catch(error: any) {
        console.error('Full TikTok analytics process failed:', error.isAxiosError ? error.response?.data : error.message);
        throw new Error(error.response?.data?.error?.message || error.message || 'An unknown error occurred during TikTok analytics fetch.');
    }
}
