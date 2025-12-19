
'use server';

/**
 * Server Action to log when a reseller shares a product.
 * This creates a record in the `resellActivities` collection.
 */

import { db } from '@/firebase/server';
import { serverTimestamp } from 'firebase-admin/firestore';


export async function logResellerShare(resellerId: string, productId: string, sellerId: string) {
  try {
    await db.collection('resellActivities').add({
      resellerId,
      productId,
      sellerId,
      sharedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to log reseller share:", error);
    // This is a background task, so we don't need to throw an error to the user.
    // The primary action (copying the link) will still succeed.
  }
}
