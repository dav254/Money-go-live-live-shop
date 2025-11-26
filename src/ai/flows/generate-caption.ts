
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

const GenerateCaptionInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  keyFeatures: z.string().describe('Key features of the product, separated by commas.'),
  platform: z.enum(['TikTok', 'Instagram', 'Facebook']).describe('The social media platform for the caption.'),
});

export type GenerateCaptionInput = z.infer<typeof GenerateCaptionInputSchema>;

const GenerateCaptionOutputSchema = z.object({
  caption: z.string().describe('The generated social media caption, including relevant hashtags.'),
});

export type GenerateCaptionOutput = z.infer<typeof GenerateCaptionOutputSchema>;

export async function generateCaption(input: GenerateCaptionInput): Promise<GenerateCaptionOutput> {
  return generateCaptionFlow(input);
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
