'use server';

/**
 * @fileOverview An AI flow to generate cinematic video scripts based on web context (products or platform info).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateVideoScriptInputSchema = z.object({
  contextType: z.enum(['product', 'platform']),
  data: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    price: z.number().optional(),
  }),
});
export type GenerateVideoScriptInput = z.infer<typeof GenerateVideoScriptInputSchema>;

const GenerateVideoScriptOutputSchema = z.object({
  script: z.string().describe('A high-fidelity cinematic prompt for a video generation model.'),
  reasoning: z.string().describe('The strategy behind this script.'),
});
export type GenerateVideoScriptOutput = z.infer<typeof GenerateVideoScriptOutputSchema>;

export async function generateVideoScript(input: GenerateVideoScriptInput): Promise<GenerateVideoScriptOutput> {
  const result = await generateVideoScriptFlow(input);
  return result;
}

const prompt = ai.definePrompt({
  name: 'generateVideoScriptPrompt',
  input: { schema: GenerateVideoScriptInputSchema },
  output: { schema: GenerateVideoScriptOutputSchema },
  prompt: `You are a professional commercial director for Vidnov, a video-first social commerce platform.
  
Your task is to write a high-fidelity cinematic prompt for an AI video model (Veo 2.0).
The prompt should be 1-2 sentences, highly descriptive, and optimized for professional advertising.

{{#if data.name}}
[PRODUCT CONTEXT]
Name: {{{data.name}}}
Category: {{{data.category}}}
Price: \${{{data.price}}}
Description: {{{data.description}}}

Objective: Create a script that showcases this specific product in a luxury or high-energy commercial setting. Focus on textures, lighting, and "Post-Earn-Repeat" energy.
{{else}}
[PLATFORM CONTEXT]
Vidnov is a global social commerce protocol where creators upload videos to earn yield.

Objective: Create a brand-level advertisement scene showing the "Post, Earn, Repeat" loop, successful entrepreneurs, or the global discovery feed in a cinematic, futuristic way.
{{/if}}

Include audio directives like "cinematic soundscape", "uplifting audio", or "rhythmic bass".
Output a single optimized script string and a brief reasoning.`,
});

const generateVideoScriptFlow = ai.defineFlow(
  {
    name: 'generateVideoScriptFlow',
    inputSchema: GenerateVideoScriptInputSchema,
    outputSchema: GenerateVideoScriptOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error('Failed to architect script.');
    return output;
  }
);
