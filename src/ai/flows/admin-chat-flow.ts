
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
    // **RADICAL FIX:** We are abandoning ai.definePrompt as it is the source of the crash.
    // We will now use the more fundamental ai.generate() which allows for proper error handling.
    try {
      const prompt = `You are a helpful and friendly AI assistant embedded within the admin dashboard of an e-commerce platform called Go Earn. The administrator of the platform is talking to you.

      Your role is to:
      1.  Acknowledge the user's message.
      2.  Offer assistance, guidance, or analysis based on their request.
      3.  Keep your responses concise and actionable.
      4.  Maintain a supportive and collaborative tone.
      
      Admin's message:
      "${input.prompt}"
      
      Your response:
      `;

      const llmResponse = await ai.generate({
        // The default model from the global `ai` object is used here.
        prompt: prompt,
        config: { temperature: 0.5 },
      });

      const outputText = llmResponse.text;

      // Safely handle cases where the model returns an empty response, preventing a crash.
      if (!outputText || outputText.trim() === '') {
        return "I'm sorry, I could not generate a response. The model returned an empty answer, possibly due to safety filters.";
      }

      return outputText;

    } catch (error) {
      console.error("A critical error occurred in the AI chat flow:", error);
      // If the entire generation fails, we catch it here and return a safe response.
      return "I'm sorry, a critical error occurred while communicating with the AI model. This issue has been logged.";
    }
  }
);

export async function askAdminAI(userInput: string): Promise<string> {
  return await adminChatFlow({ prompt: userInput });
}
