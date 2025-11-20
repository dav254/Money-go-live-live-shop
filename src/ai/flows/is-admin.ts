'use server';

/**
 * @fileOverview A flow to check if a user has admin privileges.
 *
 * - isAdmin - A function that returns true if the user is an admin.
 * - IsAdminInput - The input type for the isAdmin function.
 * - IsAdminOutput - The return type for the isAdmin function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getFirestore } from 'firebase-admin/firestore';

const IsAdminInputSchema = z.object({
  uid: z.string().describe('The user ID to check for admin privileges.'),
});
export type IsAdminInput = z.infer<typeof IsAdminInputSchema>;

const IsAdminOutputSchema = z.object({
  isAdmin: z.boolean().describe('Whether or not the user is an admin.'),
});
export type IsAdminOutput = z.infer<typeof IsAdminOutputSchema>;

export async function isAdmin(input: IsAdminInput): Promise<IsAdminOutput> {
  return isAdminFlow(input);
}

const isAdminFlow = ai.defineFlow(
  {
    name: 'isAdminFlow',
    inputSchema: IsAdminInputSchema,
    outputSchema: IsAdminOutputSchema,
  },
  async ({uid}) => {
    const db = getFirestore();
    const adminRef = db.collection('admins').doc(uid);
    const doc = await adminRef.get();
    
    return {
        isAdmin: doc.exists,
    };
  }
);
