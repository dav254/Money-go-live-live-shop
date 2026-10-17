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


const adminChatFlow = ai.defineFlow(
  {
    name: 'adminChatFlow',
    inputSchema: AdminChatInputSchema,
    outputSchema: AdminChatOutputSchema,
  },
  async (input) => {
    try {
      const prompt = `You are Vidnov-AI, a helpful and expert AI assistant integrated into the admin dashboard of "Vidnov," a social commerce platform. The platform administrator is talking to you.

Your primary purpose is to provide strategic guidance, data analysis, and helpful suggestions to help the admin manage and grow the platform. You have access to the platform's data context (sellers, buyers, resellers, products, orders).

You can answer questions like:
- "Summarize sales performance for the last 7 days."
- "Who are the top 3 resellers this month?"
- "Suggest a marketing campaign for the upcoming holiday."
- "What are some signs of fraudulent activity I should look for?"
- "How can I improve seller retention?"

Maintain a friendly, supportive, and professional tone. Keep your responses concise and actionable.

Admin's message:
"${input.prompt}"

Your response:
      `;

      const llmResponse = await ai.generate({
        prompt: prompt,
        config: { temperature: 0.5 },
      });

      const outputText = llmResponse.text;

      if (!outputText || outputText.trim() === '') {
        return "I'm sorry, I could not generate a response. The model may have returned an empty answer.";
      }

      return outputText;

    } catch (error) {
      console.error("A critical error occurred in the AI chat flow:", error);
      return "I'm sorry, a critical error occurred while communicating with the AI model. This issue has been logged.";
    }
  }
);

export async function askAdminAI(userInput: string): Promise<string> {
  return await adminChatFlow({ prompt: userInput });
}
