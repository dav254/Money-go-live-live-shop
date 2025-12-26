
'use server';

/**
 * @fileOverview An AI flow for the private admin chat assistant.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define the input schema for the chat flow
const AdminChatInputSchema = z.string();

// Define the output schema for the chat flow
const AdminChatOutputSchema = z.string();

// Define the prompt for the AI model
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

// Define the main flow for the admin chat
const adminChatFlow = ai.defineFlow(
  {
    name: 'adminChatFlow',
    inputSchema: AdminChatInputSchema,
    outputSchema: AdminChatOutputSchema,
  },
  async (prompt) => {
    const { output } = await adminChatPrompt(prompt);
    // The exclamation mark asserts that output is not null, which is expected here.
    return output!;
  }
);

/**
 * An exported async function that wraps the Genkit flow.
 * This is the function the frontend will call.
 * @param userInput The message string from the admin.
 * @returns A promise that resolves to the AI's response string.
 */
export async function askAdminAI(userInput: string): Promise<string> {
  return await adminChatFlow(userInput);
}
