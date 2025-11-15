'use server';

/**
 * @fileOverview A flow to suggest daily content for sellers to keep their shop active.
 *
 * - suggestDailyContent - A function that suggests daily content for sellers.
 * - SuggestDailyContentInput - The input type for the suggestDailyContent function.
 * - SuggestDailyContentOutput - The return type for the suggestDailyContent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestDailyContentInputSchema = z.object({
  sellerType: z
    .string()
    .describe('The type of seller, e.g., fashion, electronics, food.'),
  recentPerformance: z
    .string()
    .describe('A summary of the seller’s recent performance, including sales, views, and follower growth.'),
});
export type SuggestDailyContentInput = z.infer<typeof SuggestDailyContentInputSchema>;

const SuggestDailyContentOutputSchema = z.object({
  suggestions: z.array(
    z.string().describe('A content suggestion for the seller.')
  ).describe('A list of content suggestions for the seller to post daily.'),
});
export type SuggestDailyContentOutput = z.infer<typeof SuggestDailyContentOutputSchema>;

export async function suggestDailyContent(input: SuggestDailyContentInput): Promise<SuggestDailyContentOutput> {
  return suggestDailyContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestDailyContentPrompt',
  input: {schema: SuggestDailyContentInputSchema},
  output: {schema: SuggestDailyContentOutputSchema},
  prompt: `You are a marketing expert specializing in social media content creation for online sellers.

  Based on the seller's type and recent performance, suggest a list of daily content ideas to engage followers and improve shop visibility.

  Seller Type: {{{sellerType}}}
  Recent Performance: {{{recentPerformance}}}

  Suggestions:
  `,
});

const suggestDailyContentFlow = ai.defineFlow(
  {
    name: 'suggestDailyContentFlow',
    inputSchema: SuggestDailyContentInputSchema,
    outputSchema: SuggestDailyContentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
