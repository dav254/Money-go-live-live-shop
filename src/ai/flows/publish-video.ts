
'use server';

/**
 * @fileOverview An AI flow to publish a video to a product.
 * This flow takes a video URL (potentially a data URI) and a product ID,
 * uploads the video to Cloudinary, and saves the permanent URL to the product.
 */

import { z } from 'genkit';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PublishVideoToProductInputSchema = z.object({
  productId: z.string().describe('The ID of the product to associate the video with.'),
  videoUrl: z.string().describe("The video data URI to be uploaded."),
});
export type PublishVideoToProductInput = z.infer<typeof PublishVideoToProductInputSchema>;

async function uploadToCloudinary(videoDataUri: string, productId: string): Promise<string> {
    const uploadResponse = await cloudinary.uploader.upload(videoDataUri, {
      resource_type: 'video',
      public_id: `products/${productId}/video_${Date.now()}`,
    });
    if (!uploadResponse || !uploadResponse.secure_url) {
      throw new Error('Cloudinary upload failed.');
    }
    return uploadResponse.secure_url;
}


export async function publishVideoToProduct(input: PublishVideoToProductInput): Promise<{ success: boolean; permanentUrl?: string; error?: string }> {
  try {
    // 1. Upload the video data URI to Cloudinary
    const permanentVideoUrl = await uploadToCloudinary(input.videoUrl, input.productId);
    
    // 2. Update the product document in Firestore
    const productRef = db.collection('products').doc(input.productId);
    await productRef.update({
      videoUrls: FieldValue.arrayUnion(permanentVideoUrl),
    });

    // 3. Return success
    return { success: true, permanentUrl: permanentVideoUrl };
  } catch (error: any) {
    console.error("Failed to publish video:", error);
    return { success: false, error: error.message };
  }
}
