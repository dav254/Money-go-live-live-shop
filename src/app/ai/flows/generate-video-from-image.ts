'use server';

/**
 * @fileOverview An AI flow to generate a new image from an existing image and a prompt,
 * upload it to Firebase Storage, and save the URL to the product.
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
  productId: z.string().describe('The ID of the product to associate the video with.'),
  imageDataUri: z.string().describe("The source image as a data URI."),
  prompt: z.string().describe('A text prompt describing the new image to generate.'),
});
export type GenerateVideoFromImageInput = z.infer<typeof GenerateVideoFromImageInputSchema>;

async function uploadToLocal(dataUri: string, productId: string): Promise<string> {
    const filename = `products/${productId}/image_${generateMediaId()}.png`;
    const buffer = Buffer.from(dataUri.split(',')[1], 'base64');
    const abs = path.join(MEDIA_ROOT, filename);
    await getStorageAdapter().ensureDir(path.dirname(abs));
    await fs.promises.writeFile(abs, buffer, 'binary');
    return `${process.env.VIDNOV_MEDIA_URL}/api/media/file/${filename}`;
}

export async function generateVideoFromImage(input: GenerateVideoFromImageInput): Promise<{ videoUrl: string }> {
  const { media } = await ai.generate({
    model: googleAI.model('gemini-2.5-flash-image-preview'),
    prompt: [
      { media: { url: input.imageDataUri } },
      { text: input.prompt },
    ],
    config: { responseModalities: ['TEXT', 'IMAGE'] }
  });

  if (!media?.url) throw new Error('Failed to generate image.');

  const permanentUrl = await uploadToLocal(media.url, input.productId);
  
  const productRef = db.collection('products').doc(input.productId);
  await productRef.update({ imageUrls: FieldValue.arrayUnion(permanentUrl) });

  return { videoUrl: permanentUrl };
}
