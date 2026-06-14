'use server';

/**
 * @fileOverview An AI flow to generate high-fidelity cinematic video with synchronized audio.
 * Optimized for professional advertising and commercial production.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import fetch from 'node-fetch';

const GenerateVideoFromTextInputSchema = z.object({
  prompt: z.string().describe('A text prompt describing the desired video content and its synchronized soundscape.'),
});
export type GenerateVideoFromTextInput = z.infer<typeof GenerateVideoFromTextInputSchema>;

const GenerateVideoFromTextOutputSchema = z.object({
  videoUrl: z.string().describe("A data URI of the generated video including audio."),
});
export type GenerateVideoFromTextOutput = z.infer<typeof GenerateVideoFromTextOutputSchema>;


export async function generateVideoFromText(input: GenerateVideoFromTextInput): Promise<GenerateVideoFromTextOutput> {
  // 1. Generate video using maximized Veo 2.0 parameters
  // We request 'audio' via the prompt as the model supports multi-modal synthesis.
  let { operation } = await ai.generate({
    model: googleAI.model('veo-2.0-generate-001'),
    prompt: `[ADVERTISING MASTER SCENE]: ${input.prompt}. 
    This generation MUST include a synchronized, high-fidelity professional stereo audio track including ambient textures and a cinematic rhythm. 
    The visual MUST feature ultra-smooth professional camera motion (e.g. cinematic drone, crane, or slow-motion dolly), 4K textures, perfect temporal consistency, and vibrant color grading suitable for a premium marketplace commercial.`,
    config: {
      durationSeconds: 8, // MAX PHYSICAL LIMIT for the current stable API
      aspectRatio: '16:9',
    },
  });

  if (!operation) {
    throw new Error('Expected the model to return a long-running operation.');
  }

  // 2. Poll for video generation completion (usually 45-90 seconds)
  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    operation = await ai.checkOperation(operation);
  }

  if (operation.error) {
    throw new Error(`AI Video Engine reported an error: ${operation.error.message}`);
  }

  const generatedVideoPart = operation.output?.message?.content.find((p) => !!p.media);
  if (!generatedVideoPart?.media?.url) {
    throw new Error('Failed to locate the generated video signal in the model output.');
  }
  
  // 3. The media URL from Veo is temporary. We must fetch and encode the data.
  const videoDownloadResponse = await fetch(`${generatedVideoPart.media.url}&key=${process.env.GEMINI_API_KEY}`);
  if (!videoDownloadResponse.ok) {
    throw new Error('Protocol Error: Failed to download generated video from the temporary storage node.');
  }
  
  const videoBuffer = await videoDownloadResponse.arrayBuffer();
  const videoBase64 = Buffer.from(videoBuffer).toString('base64');
  const videoDataUri = `data:video/mp4;base64,${videoBase64}`;

  return { videoUrl: videoDataUri };
}
