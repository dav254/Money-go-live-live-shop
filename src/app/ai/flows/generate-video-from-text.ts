'use server';

/**
 * @fileOverview An AI flow to generate a video from a text prompt,
 * upload it to Firebase Storage, and save the URL to a product.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { db, bucket } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import fetch from 'node-fetch';

const GenerateVideoFromTextInputSchema = z.object({
  productId: z.string().describe('The ID of the product to associate the video with.'),
  prompt: z.string().describe('A text prompt describing the desired video content.'),
});
export type GenerateVideoFromTextInput = z.infer<typeof GenerateVideoFromTextInputSchema>;

async function uploadToFirebase(sourceUrl: string, productId: string): Promise<string> {
    const filename = `products/${productId}/video_${Date.now()}.mp4`;
    const file = bucket.file(filename);
    
    const response = await fetch(sourceUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    await file.save(buffer, {
        contentType: 'video/mp4',
        metadata: { firebaseStorageDownloadTokens: crypto.randomUUID() }
    });

    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media`;
}

export async function generateVideoFromText(input: GenerateVideoFromTextInput): Promise<{ videoUrl: string }> {
  let { operation } = await ai.generate({
    model: googleAI.model('veo-2.0-generate-001'),
    prompt: input.prompt,
    config: { durationSeconds: 5, aspectRatio: '16:9' },
  });

  if (!operation) throw new Error('Expected operation.');

  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    operation = await ai.checkOperation(operation);
  }

  const generatedVideoPart = operation.output?.message?.content.find((p) => !!p.media);
  if (!generatedVideoPart?.media?.url) throw new Error('No video URL.');
  
  const videoUrlWithKey = `${generatedVideoPart.media.url}&key=${process.env.GEMINI_API_KEY}`;
  const permanentVideoUrl = await uploadToFirebase(videoUrlWithKey, input.productId);
  
  await db.collection('products').doc(input.productId).update({
    videoUrls: FieldValue.arrayUnion(permanentVideoUrl),
    videoUrl: permanentVideoUrl,
    hasVideo: true
  });

  return { videoUrl: permanentVideoUrl };
}
