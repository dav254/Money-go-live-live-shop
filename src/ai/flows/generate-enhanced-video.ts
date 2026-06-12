
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import fetch from 'node-fetch';

const GenerateEnhancedVideoInputSchema = z.object({
  imageDataUri: z.string().describe("The source image as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  prompt: z.string().describe('A text prompt describing how to animate the image.'),
});
export type GenerateEnhancedVideoInput = z.infer<typeof GenerateEnhancedVideoInputSchema>;

const GenerateEnhancedVideoOutputSchema = z.object({
  videoUrl: z.string().describe("A data URI of the generated video."),
});
export type GenerateEnhancedVideoOutput = z.infer<typeof GenerateEnhancedVideoOutputSchema>;

export async function generateEnhancedVideo(input: GenerateEnhancedVideoInput): Promise<GenerateEnhancedVideoOutput> {
  // 1. Generate video using Veo 3.0 with an image prompt for animation and sound
  let { operation } = await ai.generate({
    model: googleAI.model('veo-3.0-generate-preview'),
    prompt: [
        { media: { url: input.imageDataUri, contentType: input.imageDataUri.split(';')[0].split(':')[1] } },
        { text: `${input.prompt}. Animate this image and generate immersive cinematic sound and environmental audio to match the motion.` },
    ],
    config: {
      aspectRatio: '16:9',
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
    throw new Error(`Video generation failed: ${operation.error.message}`);
  }

  const generatedVideoPart = operation.output?.message?.content.find((p) => !!p.media);
  if (!generatedVideoPart?.media?.url) {
    throw new Error('Failed to find the generated video in the model output.');
  }
  
  // 3. Fetch the video data as the URL is temporary
  const videoDownloadResponse = await fetch(`${generatedVideoPart.media.url}&key=${process.env.GEMINI_API_KEY}`);
  if (!videoDownloadResponse.ok) {
    throw new Error('Failed to download generated video from temporary URL.');
  }
  
  const videoBuffer = await videoDownloadResponse.arrayBuffer();
  const videoBase64 = Buffer.from(videoBuffer).toString('base64');
  const videoDataUri = `data:video/mp4;base64,${videoBase64}`;

  // 4. Return the data URI
  return { videoUrl: videoDataUri };
}
