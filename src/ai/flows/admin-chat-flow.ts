
'use server';

/**
 * @fileOverview An AI flow for the private admin chat assistant.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AdminChatInputSchema = z.object({
  prompt: z.string(),
});
export type AdminChatInput = z.infer<typeof AdminChatInputSchema>;

const AdminChatOutputSchema = z.string();
export type AdminChatOutput = z.infer<typeof AdminChatOutputSchema>;


const adminChatPrompt = ai.definePrompt({
  name: 'adminChatPrompt',
  input: { schema: AdminChatInputSchema },
  output: { schema: AdminChatOutputSchema },
  prompt: `You are a helpful and friendly AI assistant embedded within the admin dashboard of an e-commerce platform called Go Earn. The administrator of the platform is talking to you.

Your role is to:
1.  Acknowledge the user's message.
2.  Offer assistance, guidance, or analysis based on their request.
3.  Keep your responses concise and actionable.
4.  Maintain a supportive and collaborative tone.

Admin's message:
"{{{prompt}}}"

Your response:
`,
});

const adminChatFlow = ai.defineFlow(
  {
    name: 'adminChatFlow',
    inputSchema: AdminChatInputSchema,
    outputSchema: AdminChatOutputSchema,
  },
  async (input) => {
    const { output } = await adminChatPrompt(input);
    return output!;
  }
);


export async function askAdminAI(userInput: string): Promise<string> {
  return await adminChatFlow({ prompt: userInput });
}

