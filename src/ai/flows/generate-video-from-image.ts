'use server';

/**
 * @fileOverview An AI flow to generate a new image from a text prompt,
 * upload it to Firebase Storage, and save the URL to the product.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { db, bucket } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

const GenerateVideoFromImageInputSchema = z.object({
  productId: z.string().describe('The ID of the product to associate the image with.'),
  prompt: z.string().describe('A text prompt describing the new image to generate.'),
});
export type GenerateVideoFromImageInput = z.infer<typeof GenerateVideoFromImageInputSchema>;

const GenerateVideoFromImageOutputSchema = z.object({
  videoUrl: z.string().describe('The permanent URL of the generated and uploaded image.'),
});
export type GenerateVideoFromImageOutput = z.infer<typeof GenerateVideoFromImageOutputSchema>;

async function uploadToFirebase(imageDataUri: string, productId: string): Promise<string> {
    const filename = `products/${productId}/gen_img_${Date.now()}.png`;
    const file = bucket.file(filename);
    
    const base64Data = imageDataUri.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    await file.save(buffer, {
        contentType: 'image/png',
        metadata: { firebaseStorageDownloadTokens: crypto.randomUUID() }
    });

    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media`;
}

export async function generateVideoFromImage(input: GenerateVideoFromImageInput): Promise<GenerateVideoFromImageOutput> {
  const { media } = await ai.generate({
    model: googleAI.model('imagen-4.0-fast-generate-001'),
    prompt: input.prompt,
  });

  if (!media?.url) {
    throw new Error('Failed to generate a new image from the model.');
  }

  const permanentImageUrl = await uploadToFirebase(media.url, input.productId);
  
  const productRef = db.collection('products').doc(input.productId);
  await productRef.update({
    imageUrls: FieldValue.arrayUnion(permanentImageUrl),
  });

  return { videoUrl: permanentImageUrl };
}