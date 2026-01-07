
'use server';

/**
 * @fileOverview An AI flow to generate a promotional poster for a product.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { googleAI } from '@genkit-ai/google-genai';

const GeneratePosterInputSchema = z.object({
  userId: z.string().describe('The ID of the user requesting the poster.'),
  productName: z.string().describe('The name of the product.'),
  productDescription: z.string().describe('The description of the product.'),
  productImageUrl: z.string().describe("The source image of the product as a URL."),
  prompt: z.string().describe('A text prompt describing the desired poster style and content.'),
});
export type GeneratePosterInput = z.infer<typeof GeneratePosterInputSchema>;

const GeneratePosterOutputSchema = z.object({
  imageUrl: z.string().describe("The URL of the generated poster image."),
});
export type GeneratePosterOutput = z.infer<typeof GeneratePosterOutputSchema>;

const POSTER_COST = 150;

export async function generatePoster(input: GeneratePosterInput): Promise<GeneratePosterOutput> {
  const userRef = db.collection('userProfiles').doc(input.userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new Error('User not found.');
  }

  const userData = userSnap.data();
  const currentPoints = userData?.aiPoints || 0;

  if (currentPoints < POSTER_COST) {
    throw new Error(`Insufficient points. You need ${POSTER_COST} points, but you have ${currentPoints}.`);
  }

  // Deduct points before generating
  await userRef.update({
    aiPoints: FieldValue.increment(-POSTER_COST),
  });

  try {
    const result = await generatePosterFlow(input);
    return result;
  } catch (error) {
    // If AI generation fails, refund the points
    await userRef.update({
      aiPoints: FieldValue.increment(POSTER_COST),
    });
    console.error('AI poster generation failed, points refunded.', error);
    throw new Error('Failed to generate the poster from the AI model.');
  }
}

const prompt = ai.definePrompt({
  name: 'generatePosterPrompt',
  input: { schema: z.object({
      productName: z.string(),
      productDescription: z.string(),
      productImageUrl: z.string(),
      prompt: z.string(),
  }) },
  prompt: `You are an expert graphic designer specializing in e-commerce promotional posters. Your task is to create a visually stunning and effective poster based on the user's request and product information.

Product Information:
- Name: {{{productName}}}
- Description: {{{productDescription}}}
- Product Image: {{media url=productImageUrl}}

User's Request for the Poster:
"{{{prompt}}}"

Instructions:
1. Use the provided product image as the main subject.
2. Incorporate the user's prompt to guide the style, text, and overall theme.
3. Ensure the product name is clearly visible.
4. The poster should be eye-catching and suitable for social media promotion.
5. Generate only the image, no descriptive text.
`,
});

const generatePosterFlow = ai.defineFlow(
  {
    name: 'generatePosterFlow',
    inputSchema: GeneratePosterInputSchema,
    outputSchema: GeneratePosterOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
        model: googleAI.model('gemini-2.5-flash-image-preview'),
        prompt: [
            { media: { url: input.productImageUrl } },
            { text: `Generate a promotional poster. Product Name: ${input.productName}. User's request: ${input.prompt}`},
        ],
        config: {
            responseModalities: ['IMAGE'],
        }
    });

    if (!media?.url) {
      throw new Error('Failed to generate an image from the model.');
    }
    
    // The model returns a data URI, which is what we need.
    return { imageUrl: media.url };
  }
);
