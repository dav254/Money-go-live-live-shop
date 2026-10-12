'use server';

/**
 * @fileOverview An AI flow to generate a new image from a text prompt.
 * Supports both standalone generation and product-associated generation.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { MEDIA_ROOT } from '@/lib/media/config';
import { generateMediaId } from '@/lib/media/image';
import { getStorageAdapter } from '@/lib/media/storage-adapter';
import * as fs from 'fs';
import * as path from 'path';

const GenerateVideoFromImageInputSchema = z.object({
  productId: z.string().optional().describe('The ID of the product to associate the image with (optional).'),
  prompt: z.string().describe('A text prompt describing the new image to generate.'),
});
export type GenerateVideoFromImageInput = z.infer<typeof GenerateVideoFromImageInputSchema>;

const GenerateVideoFromImageOutputSchema = z.object({
  videoUrl: z.string().describe('The URL or Data URI of the generated image.'),
});
export type GenerateVideoFromImageOutput = z.infer<typeof GenerateVideoFromImageOutputSchema>;

async function uploadToLocal(imageDataUri: string, productId: string): Promise<string> {
    const filename = `products/${productId}/image_${generateMediaId()}.png`;
    const base64Data = imageDataUri.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    const abs = path.join(MEDIA_ROOT, filename);
    await getStorageAdapter().ensureDir(path.dirname(abs));
    await fs.promises.writeFile(abs, buffer);

    return `${process.env.VIDNOV_MEDIA_URL || ''}/api/media/file/${filename}`;
}

export async function generateVideoFromImage(input: GenerateVideoFromImageInput): Promise<GenerateVideoFromImageOutput> {
  const { media } = await ai.generate({
    model: googleAI.model('imagen-4.0-fast-generate-001'),
    prompt: input.prompt,
  });

  if (!media?.url) {
    throw new Error('Failed to generate a new image from the model.');
  }

  // If a product ID is provided, save it to the gallery
  if (input.productId && input.productId !== 'standalone') {
      const permanentImageUrl = await uploadToLocal(media.url, input.productId);
      
      const productRef = db.collection('products').doc(input.productId);
      await productRef.update({
        imageUrls: FieldValue.arrayUnion(permanentImageUrl),
      });

      return { videoUrl: permanentImageUrl };
  }

  // Otherwise, return the raw data URI for immediate download/preview
  return { videoUrl: media.url };
}
