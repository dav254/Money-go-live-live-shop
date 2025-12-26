
'use server';

/**
 * @fileOverview An AI flow to enhance an existing video based on a text prompt.
 *
 * - enhanceVideo - Generates a new video, uploads it, and updates Firestore.
 * - EnhanceVideoInput - Input type for the flow.
 * - EnhanceVideoOutput - Output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { v2 as cloudinary } from 'cloudinary';
import fetch from 'node-fetch';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const EnhanceVideoInputSchema = z.object({
  productId: z.string().describe('The ID of the product to associate the video with.'),
  videoDataUri: z.string().describe("The source video as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  prompt: z.string().describe('A text prompt describing the edits to make.'),
});
export type EnhanceVideoInput = z.infer<typeof EnhanceVideoInputSchema>;

const EnhanceVideoOutputSchema = z.object({
  videoUrl: z.string().describe("The permanent URL of the generated and uploaded video."),
});
export type EnhanceVideoOutput = z.infer<typeof EnhanceVideoOutputSchema>;

async function uploadToCloudinary(videoDataUri: string, productId: string): Promise<string> {
    const uploadResponse = await cloudinary.uploader.upload(videoDataUri, {
      resource_type: 'video',
      public_id: `products/${productId}/video_enh_${Date.now()}`,
    });
    if (!uploadResponse || !uploadResponse.secure_url) {
      throw new Error('Cloudinary upload failed.');
    }
    return uploadResponse.secure_url;
}

export async function enhanceVideo(input: EnhanceVideoInput): Promise<EnhanceVideoOutput> {
  // 1. Generate new video using Veo with the existing video as a media input
  let { operation } = await ai.generate({
    model: googleAI.model('veo-2.0-generate-001'),
    prompt: [
        { media: { url: input.videoDataUri } },
        { text: input.prompt },
    ],
    config: {
      durationSeconds: 8, // Set a default duration, can be adjusted
      aspectRatio: '9:16', // Assume vertical video for now
    },
  });

  if (!operation) {
    throw new Error('Expected the model to return an operation.');
  }

  // 2. Poll for video generation completion
  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    operation = await ai.checkOperation(operation);
  }

  if (operation.error) {
    throw new Error(`Video enhancement failed: ${operation.error.message}`);
  }

  const generatedVideoPart = operation.output?.message?.content.find((p) => !!p.media);
  if (!generatedVideoPart?.media?.url) {
    throw new Error('Failed to find the generated video in the model output.');
  }
  
  // 3. Fetch the new video data
  const videoDownloadResponse = await fetch(`${generatedVideoPart.media.url}&key=${process.env.GEMINI_API_KEY}`);
  if (!videoDownloadResponse.ok) {
    throw new Error('Failed to download enhanced video from temporary URL.');
  }
  
  const videoBuffer = await videoDownloadResponse.arrayBuffer();
  const videoBase64 = Buffer.from(videoBuffer).toString('base64');
  const videoDataUri = `data:video/mp4;base64,${videoBase64}`;

  // 4. Upload to Cloudinary
  const permanentVideoUrl = await uploadToCloudinary(videoDataUri, input.productId);
  
  // 5. Update Firestore
  const productRef = db.collection('products').doc(input.productId);
  await productRef.update({
    videoUrls: FieldValue.arrayUnion(permanentVideoUrl),
  });

  // 6. Return the new URL
  return { videoUrl: permanentVideoUrl };
}
