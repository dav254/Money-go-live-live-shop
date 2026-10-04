'use server';

/**
 * AI video generation (Veo) → stored in the Vidnov VPS media system.
 *
 * Key design change: the generated MP4 is saved through the media
 * pipeline and a small public URL is returned. The old version returned
 * the whole video as a base64 data URI through a server action, which
 * exceeds Next.js server-action payload limits and broke the UI.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/firebase/server';
import { storeGeneratedVideo } from '@/lib/media/service';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const GenerateVideoFromTextInputSchema = z.object({
  prompt: z.string().describe('A text prompt describing the desired video content and its soundscape.'),
});
export type GenerateVideoFromTextInput = z.infer<typeof GenerateVideoFromTextInputSchema>;

const GenerateVideoFromTextOutputSchema = z.object({
  videoUrl: z.string().describe('Public URL of the stored generated video.'),
  mediaId: z.string().describe('Vidnov media record id.'),
});
export type GenerateVideoFromTextOutput = z.infer<typeof GenerateVideoFromTextOutputSchema>;

/** Attempts a Veo generation against one model name; returns the final operation. */
async function runVeo(model: string, prompt: string) {
  // ai.generate() resolves with a response whose .operation is the
  // long-running video generation job (Veo is asynchronous).
  const response = await ai.generate({
    model,
    prompt,
    config: {
      durationSeconds: 8,
      aspectRatio: '16:9',
    },
  });

  let operation = response.operation;
  while (operation && !operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    operation = await ai.checkOperation(operation);
  }
  return operation;
}

export async function generateVideoFromText(input: GenerateVideoFromTextInput): Promise<GenerateVideoFromTextOutput> {
  const startedAt = Date.now();
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('AI is not configured yet. Please try again later.');
    }

    const prompt = `[ADVERTISING MASTER SCENE]: ${input.prompt}. Cinematic camera motion, premium color grading, synchronized ambient audio.`;

    // Veo availability varies by API key/region — try known model ids in order.
    const models = ['googleai/veo-2.0-generate-001', 'googleai/veo-3.0-generate-001'];
    let operation: Awaited<ReturnType<typeof runVeo>> | null = null;
    let lastModelError: Error | null = null;

    for (const model of models) {
      try {
        operation = await runVeo(model, prompt);
        if (operation?.done && operation.error) {
          throw new Error(operation.error.message || 'The video engine reported an error.');
        }
        if (operation?.done) break;
      } catch (err) {
        lastModelError = err instanceof Error ? err : new Error(String(err));
        // Try the next model (e.g. 404 model-not-found or 403 access).
      }
    }

    if (!operation?.done) {
      const reason = lastModelError?.message ?? 'Unknown error';
      if (/quota|rate|resource.?exhausted|429/i.test(reason)) {
        throw new Error('AI generation is at capacity right now. Please try again in a few minutes.');
      }
      if (/permission|denied|403|not.?found|404|not.?supported/i.test(reason)) {
        throw new Error('AI video generation is not enabled for this account yet. Text-to-image tools remain available.');
      }
      throw new Error('The AI engine is busy. Please try again in a moment.');
    }

    const generatedVideoPart = operation.output?.message?.content.find((p) => !!p.media);
    if (!generatedVideoPart?.media?.url) {
      throw new Error('The AI engine returned an empty result. Please try again.');
    }

    // Download the temporary Veo URL and store it permanently on the VPS.
    const downloadUrl = generatedVideoPart.media.url.includes('key=')
      ? generatedVideoPart.media.url
      : `${generatedVideoPart.media.url}${generatedVideoPart.media.url.includes('?') ? '&' : '?'}key=${process.env.GEMINI_API_KEY}`;
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      throw new Error('Generated video could not be retrieved from the AI engine.');
    }
    const videoBuffer = Buffer.from(await res.arrayBuffer());

    // The user id is not available in this flow without extra plumbing —
    // attribute the record to the AI studio account and let admins audit it.
    const stored = await storeGeneratedVideo(videoBuffer, 'ai-studio');

    // Deduct generation cost from the calling user's wallet in Firestore via
    // client-side flows is avoided here; usage is recorded for analytics.
    try {
      await db.collection('aiGenerations').add({
        type: 'text-to-video',
        mediaId: stored.mediaId,
        durationMs: Date.now() - startedAt,
        createdAt: Timestamp.now(),
      });
    } catch {
      // analytics failure must not fail the generation
    }

    return { videoUrl: stored.url, mediaId: stored.mediaId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Video synthesis failed.';
    console.error('[AI Flow Error]', message);
    // Surface clean, user-safe messages to the UI (no stack traces).
    throw new Error(message);
  } finally {
    void FieldValue; // keep import tree-shaken but available for future use
  }
}
