
'use server';

/**
 * @fileOverview An AI flow to generate a video from a text prompt.
 * This flow now ONLY generates the video and returns a temporary URL.
 * It does not interact with the database.
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
  prompt: z.string().describe('A text prompt describing the desired video content.'),
});
export type GenerateVideoFromTextInput = z.infer<typeof GenerateVideoFromTextInputSchema>;

const GenerateVideoFromTextOutputSchema = z.object({
  videoUrl: z.string().describe("A data URI of the generated video."),
});
export type GenerateVideoFromTextOutput = z.infer<typeof GenerateVideoFromTextOutputSchema>;


export async function generateVideoFromText(input: GenerateVideoFromTextInput): Promise<GenerateVideoFromTextOutput> {
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

  // 4. Return the data URI for preview on the frontend
  return { videoUrl: videoDataUri };
}
