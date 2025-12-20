
'use server';

/**
 * @fileOverview Generates viral social media captions for products.
 *
 * - generateCaption - A function that handles the caption generation process.
 * - GenerateCaptionInput - The input type for the generateCaption function.
 * - GenerateCaptionOutput - The return type for the generateCaption function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

const GenerateCaptionInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  keyFeatures: z.string().describe('Key features of the product, separated by commas.'),
  platform: z.enum(['TikTok', 'Instagram', 'Facebook']).describe('The social media platform for the caption.'),
  userId: z.string().describe('The ID of the user requesting the caption.'),
});

export type GenerateCaptionInput = z.infer<typeof GenerateCaptionInputSchema>;

const GenerateCaptionOutputSchema = z.object({
  caption: z.string().describe('The generated social media caption, including relevant hashtags.'),
});

export type GenerateCaptionOutput = z.infer<typeof GenerateCaptionOutputSchema>;

const CAPTION_COST = 50;

export async function generateCaption(input: GenerateCaptionInput): Promise<GenerateCaptionOutput> {
  const userRef = db.collection('userProfiles').doc(input.userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new Error('User not found.');
  }

  const userData = userSnap.data();
  const currentPoints = userData?.aiPoints || 0;

  if (currentPoints < CAPTION_COST) {
    throw new Error(`Insufficient points. You need ${CAPTION_COST} points, but you have ${currentPoints}.`);
  }

  // Deduct points before generating
  await userRef.update({
    aiPoints: FieldValue.increment(-CAPTION_COST),
  });

  try {
    const result = await generateCaptionFlow(input);
    return result;
  } catch (error) {
    // If AI generation fails, refund the points
    await userRef.update({
      aiPoints: FieldValue.increment(CAPTION_COST),
    });
    console.error('AI caption generation failed, points refunded.', error);
    throw new Error('Failed to generate caption from the AI model.');
  }
}

const prompt = ai.definePrompt({
  name: 'generateCaptionPrompt',
  input: { schema: GenerateCaptionInputSchema },
  output: { schema: GenerateCaptionOutputSchema },
  prompt: `You are an expert social media marketer specializing in creating viral content. Generate a short, engaging, and effective caption for the following product for the {{platform}} platform.

Product Name: {{{productName}}}
Key Features: {{{keyFeatures}}}

The caption should be exciting, use relevant emojis, and include a strong call-to-action. End with 3-5 trending and relevant hashtags for discovery on {{platform}}.

Caption:`,
});

const generateCaptionFlow = ai.defineFlow(
  {
    name: 'generateCaptionFlow',
    inputSchema: GenerateCaptionInputSchema,
    outputSchema: GenerateCaptionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
        throw new Error('Failed to generate caption from the AI model.');
    }
    return output;
  }
);
