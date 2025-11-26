'use server';

/**
 * @fileOverview An AI flow to generate a video from an image and a prompt,
 * upload it to Cloudinary, and save the URL to the product.
 *
 * - generateVideoFromImage - Generates a video, uploads it, and updates Firestore.
 * - GenerateVideoFromImageInput - Input type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { initializeAdminApp } from '@/firebase/admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const GenerateVideoFromImageInputSchema = z.object({
  productId: z.string().describe('The ID of the product to associate the video with.'),
  imageDataUri: z.string().describe("The source image as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  prompt: z.string().describe('A text prompt describing how to animate the image.'),
});
export type GenerateVideoFromImageInput = z.infer<typeof GenerateVideoFromImageInputSchema>;

const GenerateVideoFromImageOutputSchema = z.object({
  videoUrl: z.string().describe('The permanent URL of the generated and uploaded video.'),
});
export type GenerateVideoFromImageOutput = z.infer<typeof GenerateVideoFromImageOutputSchema>;

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


export async function generateVideoFromImage(input: GenerateVideoFromImageInput): Promise<GenerateVideoFromImageOutput> {
  // Initialize Firebase Admin for server-side operations
  initializeAdminApp();
  const firestore = getFirestore();

  // 1. Generate video using Veo
  let { operation } = await ai.generate({
    model: googleAI.model('veo-2.0-generate-001'),
    prompt: [
      { text: input.prompt },
      { media: { url: input.imageDataUri } },
    ],
    config: {
      durationSeconds: 5,
      aspectRatio: '9:16', // TikTok/Reels format
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
  
  // The media URL from Veo is temporary. We need to fetch the data.
  const videoDownloadResponse = await fetch(`${generatedVideoPart.media.url}&key=${process.env.GEMINI_API_KEY}`);
  if (!videoDownloadResponse.ok) {
    throw new Error('Failed to download generated video from temporary URL.');
  }
  
  const videoBuffer = await videoDownloadResponse.arrayBuffer();
  const videoBase64 = Buffer.from(videoBuffer).toString('base64');
  const videoDataUri = `data:video/mp4;base64,${videoBase64}`;


  // 3. Upload the video data URI to Cloudinary
  const permanentVideoUrl = await uploadToCloudinary(videoDataUri, input.productId);
  
  // 4. Update the product document in Firestore
  const productRef = firestore.collection('products').doc(input.productId);
  await productRef.update({
    videoUrls: FieldValue.arrayUnion(permanentVideoUrl),
  });

  // 5. Return the permanent URL
  return { videoUrl: permanentVideoUrl };
}
