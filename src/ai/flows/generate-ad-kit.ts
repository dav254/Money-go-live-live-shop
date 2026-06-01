'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

const AD_KIT_COST = 50;

const AdKitInputSchema = z.object({
  productName: z.string(),
  productDescription: z.string(),
  productId: z.string(),
  platform: z.enum(['youtube', 'tiktok']),
  userId: z.string(),
  location: z.string().optional(),
});
export type AdKitInput = z.infer<typeof AdKitInputSchema>;

export const AdKitOutputSchema = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  instructions: z.array(z.string()),
});
export type AdKitOutput = z.infer<typeof AdKitOutputSchema>;

export async function generateAdKit(input: AdKitInput): Promise<AdKitOutput> {
  const userRef = db.collection('userProfiles').doc(input.userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new Error('User not found.');
  }

  const currentPoints = userSnap.data()?.aiPoints || 0;
  if (currentPoints < AD_KIT_COST) {
    throw new Error(`Insufficient points. You need ${AD_KIT_COST} points, but have ${currentPoints}.`);
  }

  await userRef.update({
    aiPoints: FieldValue.increment(-AD_KIT_COST),
  });

  try {
    const result = await generateAdKitFlow(input);
    return result;
  } catch (error) {
    await userRef.update({
      aiPoints: FieldValue.increment(AD_KIT_COST),
    });
    console.error("AI ad kit generation failed, points refunded.", error);
    throw new Error('Failed to generate ad kit from the AI model.');
  }
}

const prompt = ai.definePrompt({
  name: 'generateAdKitPrompt',
  input: { schema: AdKitInputSchema },
  output: { schema: AdKitOutputSchema },
  prompt: `You are an expert digital marketing assistant for an e-commerce platform called GoEarnvid. A seller wants to promote a product video on {{platform}}. Your task is to generate a complete "Ad Kit" for them.

Product Information:
- Name: {{{productName}}}
- Description: {{{productDescription}}}
- Seller Location: {{{location}}}
- Product Link: https://goearnvid.shop/products/{{{productId}}}

Generate the following:
1.  **title**: A catchy, SEO-friendly title for the YouTube video or TikTok post.
2.  **description**: A compelling description. It MUST include the product link. It should use emojis and be formatted for high readability.
3.  **tags**: A list of 5-7 relevant tags or keywords.
4.  **instructions**: A simple, 4-step guide for the seller on how to use this content to run a promotion on YouTube. Address the seller directly.
`,
});

const generateAdKitFlow = ai.defineFlow(
  {
    name: 'generateAdKitFlow',
    inputSchema: AdKitInputSchema,
    outputSchema: AdKitOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to generate ad kit from the AI model.');
    }
    return output;
  }
);
