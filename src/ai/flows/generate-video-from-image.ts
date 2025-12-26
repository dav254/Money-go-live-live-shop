
'use server';

/**
 * @fileOverview An AI flow to generate a new image from an existing image and a prompt,
 * upload it to Cloudinary, and save the URL to the product.
 *
 * - generateVideoFromImage - Generates a new image, uploads it, and updates Firestore.
 * - GenerateVideoFromImageInput - Input type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
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
  prompt: z.string().describe('A text prompt describing the new image to generate.'),
});
export type GenerateVideoFromImageInput = z.infer<typeof GenerateVideoFromImageInputSchema>;

const GenerateVideoFromImageOutputSchema = z.object({
  videoUrl: z.string().describe('The permanent URL of the generated and uploaded image.'),
});
export type GenerateVideoFromImageOutput = z.infer<typeof GenerateVideoFromImageOutputSchema>;

async function uploadToCloudinary(videoDataUri: string, productId: string): Promise<string> {
    const uploadResponse = await cloudinary.uploader.upload(videoDataUri, {
      resource_type: 'image', // Changed from 'video' to 'image'
      public_id: `products/${productId}/image_${Date.now()}`,
    });
    if (!uploadResponse || !uploadResponse.secure_url) {
      throw new Error('Cloudinary upload failed.');
    }
    return uploadResponse.secure_url;
}


export async function generateVideoFromImage(input: GenerateVideoFromImageInput): Promise<GenerateVideoFromImageOutput> {
  // 1. Generate new image using Gemini Flash
  const { media } = await ai.generate({
    model: googleAI.model('gemini-2.5-flash-image-preview'),
    prompt: [
      { media: { url: input.imageDataUri } },
      { text: input.prompt },
    ],
    config: {
        responseModalities: ['TEXT', 'IMAGE'],
    }
  });

  if (!media?.url) {
    throw new Error('Failed to generate a new image from the model.');
  }

  const generatedImageDataUri = media.url;


  // 2. Upload the new image data URI to Cloudinary
  const permanentImageUrl = await uploadToCloudinary(generatedImageDataUri, input.productId);
  
  // 3. Update the product document in Firestore
  const productRef = db.collection('products').doc(input.productId);
  await productRef.update({
    imageUrls: FieldValue.arrayUnion(permanentImageUrl), // Add to imageUrls instead of videoUrls
  });

  // 4. Return the permanent URL
  // The output key is still 'videoUrl' to avoid breaking the frontend component expecting this key.
  return { videoUrl: permanentImageUrl };
}
