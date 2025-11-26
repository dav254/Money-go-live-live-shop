
'use server';

/**
 * @fileOverview An AI flow to generate strategic deal suggestions for a product.
 *
 * - generateDealSuggestion - A function that suggests three types of deals for a product.
 * - GenerateDealSuggestionInput - The input type for the generateDealSuggestion function.
 * - GenerateDealSuggestionOutput - The return type for the generateDealSuggestion function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateDealSuggestionInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  productCategory: z.string().describe('The category of the product.'),
  currentPrice: z.number().describe('The current price of the product in USD.'),
  productDescription: z.string().describe('The detailed description of the product.'),
});
export type GenerateDealSuggestionInput = z.infer<typeof GenerateDealSuggestionInputSchema>;

const GenerateDealSuggestionOutputSchema = z.object({
  flashSale: z.object({
    newPrice: z.number().describe('The suggested discounted price for a limited-time flash sale.'),
    originalPrice: z.number().describe('The original price of the product.'),
    reason: z.string().describe('A compelling marketing reason for this flash sale (e.g., "to clear inventory for new stock").'),
  }),
  smartBundle: z.object({
    bundleWith: z.string().describe('A complementary product type to bundle with (e.g., "a protective case" or "matching socks").'),
    bundlePrice: z.number().describe('The attractive price for the entire bundle.'),
    reason: z.string().describe('Why this bundle is a great deal for the customer (e.g., "saves them $15 and provides a complete solution").'),
  }),
  tieredOffer: z.object({
    offer: z.string().describe('The tiered offer proposition, formatted as "Buy X, Get Y..." (e.g., "Buy 2, Get 1 Free" or "Buy 3, get 20% off the total").'),
    reason: z.string().describe('The strategic benefit of this offer (e.g., "to increase average order value").'),
  }),
});
export type GenerateDealSuggestionOutput = z.infer<typeof GenerateDealSuggestionOutputSchema>;

export async function generateDealSuggestion(input: GenerateDealSuggestionInput): Promise<GenerateDealSuggestionOutput> {
  return generateDealSuggestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDealSuggestionPrompt',
  input: { schema: GenerateDealSuggestionInputSchema },
  output: { schema: GenerateDealSuggestionOutputSchema },
  prompt: `You are an expert e-commerce sales strategist. Your goal is to create three distinct and actionable deal suggestions for the following product to help the seller increase revenue.

Product Information:
- Name: {{{productName}}}
- Category: {{{productCategory}}}
- Current Price: \${{{currentPrice}}}
- Description: {{{productDescription}}}

Based on this information, generate three types of deals. Be creative and strategic.

1.  **Flash Sale**: A simple, time-sensitive discount.
2.  **Smart Bundle**: A deal that combines this product with another complementary item.
3.  **Tiered Offer**: A deal that encourages buying in bulk or a higher quantity.

Provide your response in the structured format requested.
`,
});

const generateDealSuggestionFlow = ai.defineFlow(
  {
    name: 'generateDealSuggestionFlow',
    inputSchema: GenerateDealSuggestionInputSchema,
    outputSchema: GenerateDealSuggestionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to generate deal suggestions from the AI model.');
    }
    // Pass the original price through for the flash sale object
    output.flashSale.originalPrice = input.currentPrice;
    return output;
  }
);
