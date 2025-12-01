
'use server';

/**
 * Server Action to log when a reseller shares a product.
 * This creates a record in the `resellActivities` collection.
 */

import { initializeAdminApp } from '@/firebase/admin';
// Do not import from 'firebase-admin' at the top level

export async function logResellerShare(resellerId: string, productId: string, sellerId: string) {
  try {
    initializeAdminApp();
    const { getFirestore, serverTimestamp } = await import('firebase-admin/firestore');
    const db = getFirestore();
    
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
