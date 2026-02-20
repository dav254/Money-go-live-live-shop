'use server';

/**
 * @fileOverview An AI flow to generate a new image from an existing image and a prompt,
 * upload it to Firebase Storage, and save the URL to the product.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { db, bucket } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

const GenerateVideoFromImageInputSchema = z.object({
  productId: z.string().describe('The ID of the product to associate the video with.'),
  imageDataUri: z.string().describe("The source image as a data URI."),
  prompt: z.string().describe('A text prompt describing the new image to generate.'),
});
export type GenerateVideoFromImageInput = z.infer<typeof GenerateVideoFromImageInputSchema>;

async function uploadToFirebase(dataUri: string, productId: string): Promise<string> {
    const filename = `products/${productId}/image_${Date.now()}.png`;
    const file = bucket.file(filename);
    const base64Data = dataUri.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    await file.save(buffer, {
        contentType: 'image/png',
        metadata: { firebaseStorageDownloadTokens: crypto.randomUUID() }
    });

    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media`;
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

  const permanentUrl = await uploadToFirebase(media.url, input.productId);
  
  const productRef = db.collection('products').doc(input.productId);
  await productRef.update({ imageUrls: FieldValue.arrayUnion(permanentUrl) });

  return { videoUrl: permanentUrl };
}
