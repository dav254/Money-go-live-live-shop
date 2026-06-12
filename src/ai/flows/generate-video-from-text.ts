
'use server';

/**
 * @fileOverview An AI flow to generate a video from a text prompt using Veo 2.0.
 * This model is the stable production engine for long-running video generation.
 *
 * - generateVideoFromText - Generates a video and returns its data URI.
 * - GenerateVideoFromTextInput - Input type for the flow.
 * - GenerateVideoFromTextOutput - Output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import fetch from 'node-fetch';

const GenerateVideoFromTextInputSchema = z.object({
  prompt: z.string().describe('A text prompt describing the desired video content. Include details about cinematic motion and lighting.'),
});
export type GenerateVideoFromTextInput = z.infer<typeof GenerateVideoFromTextInputSchema>;

const GenerateVideoFromTextOutputSchema = z.object({
  videoUrl: z.string().describe("A data URI of the generated video."),
});
export type GenerateVideoFromTextOutput = z.infer<typeof GenerateVideoFromTextOutputSchema>;


export async function generateVideoFromText(input: GenerateVideoFromTextInput): Promise<GenerateVideoFromTextOutput> {
  // 1. Generate video using stable Veo 2.0
  // Note: veo-3.0-preview currently has restricted regional availability causing 404s.
  let { operation } = await ai.generate({
    model: googleAI.model('veo-2.0-generate-001'),
    prompt: `${input.prompt}. Ensure the video features smooth cinematic camera work, professional lighting, and high-fidelity textures. Make the sequence as detailed as possible.`,
    config: {
      durationSeconds: 8, // Maximum allowed duration for the current API
      aspectRatio: '16:9',
    },
  });

  if (!operation) {
    throw new Error('Expected the model to return a long-running operation.');
  }

  // 2. Poll for video generation completion (this usually takes 30-60 seconds)
  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds between pings
    operation = await ai.checkOperation(operation);
  }

  if (operation.error) {
    throw new Error(`AI Video Engine reported an error: ${operation.error.message}`);
  }

  const generatedVideoPart = operation.output?.message?.content.find((p) => !!p.media);
  if (!generatedVideoPart?.media?.url) {
    throw new Error('Failed to locate the generated video signal in the model output.');
  }
  
  // 3. The media URL from Veo is temporary. We must fetch and encode the data for the frontend.
  const videoDownloadResponse = await fetch(`${generatedVideoPart.media.url}&key=${process.env.GEMINI_API_KEY}`);
  if (!videoDownloadResponse.ok) {
    throw new Error('Protocol Error: Failed to download generated video from the temporary storage node.');
  }
  
  const videoBuffer = await videoDownloadResponse.arrayBuffer();
  const videoBase64 = Buffer.from(videoBuffer).toString('base64');
  const videoDataUri = `data:video/mp4;base64,${videoBase64}`;

  // 4. Return the data URI for preview and immediate use
  return { videoUrl: videoDataUri };
}
