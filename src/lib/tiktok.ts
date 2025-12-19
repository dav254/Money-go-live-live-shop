

import type { BoostRequest } from './types';
import fetch from 'node-fetch';

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
            // Add the required source_info object
            body: JSON.stringify({
                "source_info": {
                    "source": "FILE_UPLOAD",
                }
            })
        });

        // The response might not be JSON on failure, so we handle it carefully.
        if (!initResponse.ok) {
            try {
                const errorData = await initResponse.json();
                throw new Error(`TikTok API Error (Init): ${errorData.error.message}`);
            } catch (jsonError) {
                // If parsing as JSON fails, it's likely an HTML error page.
                const errorText = await initResponse.text();
                throw new Error(`TikTok API Error (Init): Received non-JSON response. Status: ${initResponse.status}. Body: ${errorText.substring(0, 100)}...`);
            }
        }
        
        const initData = await initResponse.json();
        const uploadUrl = initData.data.upload_url;
        const videoId = initData.data.video_id;


        // Step 2: Download our video from Cloudinary and upload it to TikTok's URL
        const videoResponse = await fetch(boost.videoUrl);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download video from Cloudinary. Status: ${videoResponse.status}`);
        }
        const videoBuffer = await videoResponse.buffer();


        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Length': String(videoBuffer.length)
            },
            body: videoBuffer,
        });

        if (uploadResponse.status !== 200) {
             const errorText = await uploadResponse.text();
             throw new Error(`TikTok API Error (Upload): Failed to upload video file. Status: ${uploadResponse.status}. Details: ${errorText}`);
        }

        // Step 3: Create the post on TikTok using the uploaded video
        const createResponse = await fetch('https://open.tiktokapis.com/v2/video/post/', {
            method: 'POST',
            headers: {
                 'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
            },
            body: JSON.stringify({
                video_id: videoId,
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
        // The final video ID to be stored is returned in the post creation step
        const finalVideoId = createData.data.video_id;

        return {
            success: true,
            videoId: finalVideoId,
            message: "Video successfully uploaded and posted to TikTok.",
        };

    } catch (error: any) {
        console.error('Full TikTok upload process failed:', error);
        return { success: false, message: error.message || 'An unknown error occurred during TikTok upload.' };
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
    
    const url = new URL('https://open.tiktokapis.com/v2/video/query/');
    url.searchParams.append('fields', 'id,view_count,like_count,comment_count,share_count');

    const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
            video_ids: videoIds,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("TikTok Analytics Error:", errorData);
        throw new Error(errorData.error.message || 'Failed to fetch video analytics from TikTok.');
    }

    const data = await response.json();
    return data.data.videos || [];
}
