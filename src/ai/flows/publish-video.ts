'use server';

/**
 * @fileOverview An AI flow to publish a video to a product.
 * This flow takes a video URL (potentially a data URI) and a product ID,
 * uploads the video to Firebase Storage, and saves the permanent URL to the product.
 */

import { z } from 'genkit';
import { db, bucket } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

const PublishVideoToProductInputSchema = z.object({
  productId: z.string().describe('The ID of the product to associate the video with.'),
  videoUrl: z.string().describe("The video data URI or source URL to be uploaded."),
});
export type PublishVideoToProductInput = z.infer<typeof PublishVideoToProductInputSchema>;

async function uploadToFirebase(sourceUrl: string, productId: string): Promise<string> {
    const filename = `products/${productId}/video_${Date.now()}.mp4`;
    const file = bucket.file(filename);

    if (sourceUrl.startsWith('data:')) {
        const base64Data = sourceUrl.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        await file.save(buffer, {
            contentType: 'video/mp4',
            metadata: { firebaseStorageDownloadTokens: crypto.randomUUID() }
        });
    } else {
        // Simple copy if it's already a URL
        const response = await fetch(sourceUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        await file.save(buffer, {
            contentType: 'video/mp4'
        });
    }

    // Make the file public or get a signed URL (for simplicity using public-like access via direct link)
    // In production, use getDownloadURL equivalent or make the bucket public read.
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media`;
}


export async function publishVideoToProduct(input: PublishVideoToProductInput): Promise<{ success: boolean; permanentUrl?: string; error?: string }> {
  try {
    // 1. Upload the video to Firebase Storage
    const permanentVideoUrl = await uploadToFirebase(input.videoUrl, input.productId);
    
    // 2. Update the product document in Firestore
    const productRef = db.collection('products').doc(input.productId);
    await productRef.update({
      videoUrls: FieldValue.arrayUnion(permanentVideoUrl),
      videoUrl: permanentVideoUrl,
      hasVideo: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, permanentUrl: permanentVideoUrl };
  } catch (error: any) {
    console.error("Failed to publish video:", error);
    return { success: false, error: error.message };
  }
}
