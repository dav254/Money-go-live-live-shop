
'use server';

/**
 * @fileOverview An AI flow that acts as a co-pilot for live sellers,
 * analyzing viewer comments and providing real-time strategic advice.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const LiveCommentInputSchema = z.object({
  comment: z.string().describe('A single comment from a viewer in a live shopping stream.'),
});
type LiveCommentInput = z.infer<typeof LiveCommentInputSchema>;

const classificationEnum = z.enum([
    "Buying Signal", 
    "Price Objection", 
    "Question", 
    "Positive Feedback", 
    "Negative Feedback",
    "Spam/Irrelevant",
]);

const LiveCommentOutputSchema = z.object({
    classification: classificationEnum.describe('The classification of the viewer comment.'),
    sellerWhisper: z.string().describe('A private, strategic suggestion for the seller on how to respond or what to do next. This is not shown to the public.'),
    suggestedAction: z.string().describe('A short, actionable button label for the seller (e.g., "Announce Discount", "Pin Comment", "Answer Question").'),
});
type LiveCommentOutput = z.infer<typeof LiveCommentOutputSchema>;


const prompt = ai.definePrompt({
  name: 'liveSellingCopilotPrompt',
  input: { schema: LiveCommentInputSchema },
  output: { schema: LiveCommentOutputSchema },
  prompt: `You are an expert live selling co-pilot. Your job is to analyze incoming viewer comments during a live stream and provide real-time, private strategic advice to the seller.

Analyze the following comment:
"{{{comment}}}"

1.  **Classify the comment's intent.** Is it a clear signal someone wants to buy? A question about the product? A complaint about price? Or just spam?
2.  **Generate a "Seller Whisper."** This is a concise, private coaching tip for the seller. Give them a suggestion on what to say or do to capitalize on the comment or mitigate a problem.
3.  **Suggest a one-click action.** Provide a short, actionable label for a button the seller could press.

Provide your response in the structured format requested.
`,
});


const liveSellingCopilotFlow = ai.defineFlow(
  {
    name: 'liveSellingCopilotFlow',
    inputSchema: LiveCommentInputSchema,
    outputSchema: LiveCommentOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to get analysis from the AI model.');
    }
    return output;
  }
);


export async function analyzeLiveComment(input: LiveCommentInput): Promise<LiveCommentOutput> {
  return liveSellingCopilotFlow(input);
}
