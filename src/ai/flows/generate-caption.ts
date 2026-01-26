'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

const CAPTION_COST = 50;

const GenerateCaptionInputSchema = z.object({
  productName: z.string().min(2, { message: 'Product name is required.' }),
  keyFeatures: z.string().min(5, { message: 'Please list at least one feature.' }),
  platform: z.enum(['TikTok', 'Instagram', 'Facebook']),
  userId: z.string().describe('The ID of the user requesting the caption.'),
});

export type GenerateCaptionInput = z.infer<typeof GenerateCaptionInputSchema>;

const GenerateCaptionOutputSchema = z.object({
  caption: z.string().describe('The generated social media caption.'),
});

export type GenerateCaptionOutput = z.infer<typeof GenerateCaptionOutputSchema>;

export async function generateCaption(input: GenerateCaptionInput): Promise<GenerateCaptionOutput> {
  const userRef = db.collection('userProfiles').doc(input.userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new Error('User not found.');
  }

  const userData = userSnap.data();
  const currentPoints = userData?.aiPoints || 0;

  if (currentPoints < CAPTION_COST) {
    throw new Error(`Insufficient points. You need ${CAPTION_COST} points, but you only have ${currentPoints}.`);
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
  input: {schema: GenerateCaptionInputSchema},
  output: {schema: GenerateCaptionOutputSchema},
  prompt: `You are an expert social media marketer for an e-commerce platform called Go Earn. Your goal is to create a viral, engaging caption for a product to be posted on {{platform}}.

The caption should be exciting, use relevant emojis, and include strong calls to action. It must include hashtags.

Product Information:
- Name: {{{productName}}}
- Key Features: {{{keyFeatures}}}

Generate a caption for {{platform}}.
Caption:`, 
});

const generateCaptionFlow = ai.defineFlow(
  {
    name: 'generateCaptionFlow',
    inputSchema: GenerateCaptionInputSchema,
    outputSchema: GenerateCaptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
     if (!output) {
      throw new Error('Failed to generate caption from the AI model.');
    }
    return output;
  }
);
