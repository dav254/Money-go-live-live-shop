
'use server';

/**
 * @fileOverview An AI flow to generate a video from a text prompt,
 * upload it to Cloudinary, and save the URL to a product.
 *
 * - generateVideoFromText - Generates a video and returns its permanent URL.
 * - GenerateVideoFromTextInput - Input type for the flow.
 * - GenerateVideoFromTextOutput - Output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { initializeAdminApp } from '@/firebase/admin';
// Do not import from 'firebase-admin' at the top level
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const GenerateVideoFromTextInputSchema = z.object({
  productId: z.string().describe('The ID of the product to associate the video with.'),
  prompt: z.string().describe('A text prompt describing the desired video content.'),
});
export type GenerateVideoFromTextInput = z.infer<typeof GenerateVideoFromTextInputSchema>;

const GenerateVideoFromTextOutputSchema = z.object({
  videoUrl: z.string().describe("The permanent URL of the generated video."),
});
export type GenerateVideoFromTextOutput = z.infer<typeof GenerateVideoFromTextOutputSchema>;

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

export async function generateVideoFromText(input: GenerateVideoFromTextInput): Promise<GenerateVideoFromTextOutput> {
  // Initialize Firebase Admin for server-side operations
  const adminApp = initializeAdminApp();
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  const firestore = getFirestore(adminApp);

  // 1. Generate video using Veo
  let { operation } = await ai.generate({
    model: googleAI.model('veo-2.0-generate-001'),
    prompt: input.prompt,
    config: {
      durationSeconds: 5,
      aspectRatio: '16:9', // Standard video format
    },
  });

  if (!operation) {
    throw new Error('Expected the model to return an operation.');
  }

  // 2. Poll for video generation completion (this can take a minute)
  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
    operation = await ai.checkOperation(operation);
  }

  if (operation.error) {
    throw new Error(`Video generation failed: ${operation.error.message}`);
  }

  const generatedVideoPart = operation.output?.message?.content.find((p) => !!p.media);
  if (!generatedVideoPart?.media?.url) {
    throw new Error('Failed to find the generated video in the model output.');
  }
  
  // 3. The media URL from Veo is temporary. We need to fetch the data.
  const videoDownloadResponse = await fetch(`${generatedVideoPart.media.url}&key=${process.env.GEMINI_API_KEY}`);
  if (!videoDownloadResponse.ok) {
    throw new Error('Failed to download generated video from temporary URL.');
  }
  
  const videoBuffer = await videoDownloadResponse.arrayBuffer();
  const videoBase64 = Buffer.from(videoBuffer).toString('base64');
  const videoDataUri = `data:video/mp4;base64,${videoBase64}`;

  // 4. Upload the video data URI to Cloudinary
  const permanentVideoUrl = await uploadToCloudinary(videoDataUri, input.productId);
  
  // 5. Update the product document in Firestore
  const productRef = firestore.collection('products').doc(input.productId);
  await productRef.update({
    videoUrls: FieldValue.arrayUnion(permanentVideoUrl),
  });

  // 6. Return the permanent URL
  return { videoUrl: permanentVideoUrl };
}
