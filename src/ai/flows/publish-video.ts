'use server';

/**
 * Publishes a video to a product.
 *
 * Vidnov media system: AI-generated videos are already stored on the
 * VPS (via storeGeneratedVideo) and referenced by /api/media/file/...
 * URLs — those attach directly. Data URIs or external URLs are stored
 * through the media pipeline first. Nothing goes to Firebase Storage.
 */

import { z } from 'genkit';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { storeGeneratedVideo } from '@/lib/media/service';

const PublishVideoToProductInputSchema = z.object({
  productId: z.string().describe('The ID of the product to associate the video with.'),
  videoUrl: z.string().describe('Vidnov media URL, data URI, or external URL of the video.'),
});
export type PublishVideoToProductInput = z.infer<typeof PublishVideoToProductInputSchema>;

export async function publishVideoToProduct(input: PublishVideoToProductInput): Promise<{ success: boolean; permanentUrl?: string; error?: string }> {
  try {
    let permanentVideoUrl = input.videoUrl;

    // Already stored on the VPS media system — attach as-is.
    if (input.videoUrl.startsWith('/api/media/')) {
      // no-op: the media record exists and is served by /api/media/file
    } else if (input.videoUrl.startsWith('data:')) {
      const base64Data = input.videoUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const stored = await storeGeneratedVideo(buffer, 'publish-flow');
      permanentVideoUrl = stored.url;
    } else {
      // External URL — fetch and store a copy on the VPS.
      const res = await fetch(input.videoUrl);
      if (!res.ok) throw new Error('Could not retrieve the video for publishing.');
      const buffer = Buffer.from(await res.arrayBuffer());
      const stored = await storeGeneratedVideo(buffer, 'publish-flow');
      permanentVideoUrl = stored.url;
    }

    const productRef = db.collection('products').doc(input.productId);
    await productRef.update({
      videoUrls: FieldValue.arrayUnion(permanentVideoUrl),
      videoUrl: permanentVideoUrl,
      hasVideo: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, permanentUrl: permanentVideoUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publishing failed.';
    console.error('Failed to publish video:', message);
    return { success: false, error: message };
  }
}
