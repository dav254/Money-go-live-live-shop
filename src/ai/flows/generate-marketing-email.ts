'use server';

/**
 * @fileOverview An AI flow to generate professional marketing emails for sellers.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

const EMAIL_GEN_COST = 40;

const GenerateEmailInputSchema = z.object({
  sellerName: z.string(),
  productName: z.string().optional(),
  goal: z.enum(['Product Launch', 'Sale Announcement', 'Thank You / Follow-up', 'Customer Win-back']),
  tone: z.string().describe('e.g., Professional, Friendly, Urgent'),
  userId: z.string(),
});
export type GenerateEmailInput = z.infer<typeof GenerateEmailInputSchema>;

const GenerateEmailOutputSchema = z.object({
  subject: z.string().describe('A catchy subject line for the email.'),
  body: z.string().describe('The full HTML/Text body of the marketing email.'),
});
export type GenerateEmailOutput = z.infer<typeof GenerateEmailOutputSchema>;

export async function generateMarketingEmail(input: GenerateEmailInput): Promise<GenerateEmailOutput> {
  const userRef = db.collection('userProfiles').doc(input.userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new Error('User not found.');
  }

  const currentPoints = userSnap.data()?.aiPoints || 0;
  if (currentPoints < EMAIL_GEN_COST) {
    throw new Error(`Insufficient points. You need ${EMAIL_GEN_COST} points, but have ${currentPoints}.`);
  }

  await userRef.update({
    aiPoints: FieldValue.increment(-EMAIL_GEN_COST),
  });

  try {
    const result = await generateMarketingEmailFlow(input);
    return result;
  } catch (error) {
    await userRef.update({
      aiPoints: FieldValue.increment(EMAIL_GEN_COST),
    });
    console.error("AI email generation failed, points refunded.", error);
    throw new Error('Failed to generate email from the AI model.');
  }
}

const prompt = ai.definePrompt({
  name: 'generateMarketingEmailPrompt',
  input: { schema: GenerateEmailInputSchema },
  output: { schema: GenerateEmailOutputSchema },
  prompt: `You are a high-conversion email marketing expert for the "Go Earn" e-commerce platform. Your task is to write a professional marketing email for a seller named {{sellerName}}.

Goal: {{goal}}
Tone: {{tone}}
Product: {{#if productName}}{{{productName}}}{{else}}General Shop Items{{/if}}

Requirements:
1. Write a subject line that encourages high open rates.
2. The body should be engaging, structured with paragraphs, and include clear placeholders like [Link to Product] or [Discount Code] where appropriate.
3. Keep the content focused on driving sales or building customer loyalty.
4. End the email with a professional sign-off from {{sellerName}}.
`,
});

const generateMarketingEmailFlow = ai.defineFlow(
  {
    name: 'generateMarketingEmailFlow',
    inputSchema: GenerateEmailInputSchema,
    outputSchema: GenerateEmailOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to generate marketing email.');
    }
    return output;
  }
);
