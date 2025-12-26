
'use server';

/**
 * @fileOverview Generates compelling product descriptions using AI based on input details.
 *
 * - generateProductDescription - A function that handles the product description generation process.
 * - GenerateProductDescriptionInput - The input type for the generateProductDescription function.
 * - GenerateProductDescriptionOutput - The return type for the generateProductDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

const DESCRIPTION_COST = 25;

const GenerateProductDescriptionInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  productCategory: z.string().describe('The category of the product.'),
  keyFeatures: z.string().describe('Key features of the product, separated by commas.'),
  targetAudience: z.string().describe('The target audience for the product.'),
  tone: z.string().describe('The desired tone of the description (e.g., professional, funny, exciting).'),
  userId: z.string().describe('The ID of the user requesting the description.'),
});

export type GenerateProductDescriptionInput = z.infer<typeof GenerateProductDescriptionInputSchema>;

const GenerateProductDescriptionOutputSchema = z.object({
  description: z.string().describe('The generated product description.'),
});

export type GenerateProductDescriptionOutput = z.infer<typeof GenerateProductDescriptionOutputSchema>;

export async function generateProductDescription(input: GenerateProductDescriptionInput): Promise<GenerateProductDescriptionOutput> {
  const userRef = db.collection('userProfiles').doc(input.userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new Error('User not found.');
  }
  
  const userData = userSnap.data();
  const currentPoints = userData?.aiPoints || 0;

  if (currentPoints < DESCRIPTION_COST) {
    throw new Error(`Insufficient points. You need ${DESCRIPTION_COST} points, but you only have ${currentPoints}.`);
  }

  // Deduct points before generating
  await userRef.update({
    aiPoints: FieldValue.increment(-DESCRIPTION_COST),
  });

  try {
    const result = await generateProductDescriptionFlow(input);
    return result;
  } catch (error) {
    // If AI generation fails, refund the points
    await userRef.update({
      aiPoints: FieldValue.increment(DESCRIPTION_COST),
    });
    console.error('AI description generation failed, points refunded.', error);
    throw new Error('Failed to generate description from the AI model.');
  }
}

const prompt = ai.definePrompt({
  name: 'generateProductDescriptionPrompt',
  input: {schema: GenerateProductDescriptionInputSchema},
  output: {schema: GenerateProductDescriptionOutputSchema},
  prompt: `You are an expert marketing copywriter. Generate a compelling product description based on the following information:

Product Name: {{{productName}}}
Category: {{{productCategory}}}
Key Features: {{{keyFeatures}}}
Target Audience: {{{targetAudience}}}
Tone: {{{tone}}}

Description:`, 
});

const generateProductDescriptionFlow = ai.defineFlow(
  {
    name: 'generateProductDescriptionFlow',
    inputSchema: GenerateProductDescriptionInputSchema,
    outputSchema: GenerateProductDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
     if (!output) {
      throw new Error('Failed to generate description from the AI model.');
    }
    return output;
  }
);
