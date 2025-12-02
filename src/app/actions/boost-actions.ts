'use server';

import { initializeAdminApp } from '@/firebase/admin';
import type { BoostRequest, UserProfile } from '@/lib/types';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { headers } from 'next/headers';

interface CreateBoostRequestPayload {
  productId: string;
  videoUrl: string;
  caption: string;
  durationDays: number;
  pointsCost: number;
  target: {
    counties: string[];
    age: string;
    interests: string[];
  };
}

export async function createBoostRequest(payload: CreateBoostRequestPayload, authToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const adminApp = initializeAdminApp();
    const auth = getAuth(adminApp);
    const db = await import('firebase-admin/firestore').then(mod => mod.getFirestore(adminApp));

    if (!authToken) {
      throw new Error('Unauthorized: No authentication token provided.');
    }

    const decodedToken = await auth.verifyIdToken(authToken);
    const sellerId = decodedToken.uid;

    const userProfileRef = db.collection('userProfiles').doc(sellerId);
    const newBoostRef = db.collection('boost_requests').doc();

    await db.runTransaction(async (transaction) => {
      const userProfileSnap = await transaction.get(userProfileRef);
      if (!userProfileSnap.exists) {
        throw new Error('User profile not found.');
      }
      const userProfile = userProfileSnap.data() as UserProfile;

      const currentPoints = userProfile.aiPoints || 0;
      if (currentPoints < payload.pointsCost) {
        throw new Error(`Insufficient points. You need ${payload.pointsCost}, but have ${currentPoints}.`);
      }

      const newBoostData: Omit<BoostRequest, 'id'> = {
        sellerId: sellerId,
        productId: payload.productId, // Make sure to save the productId
        videoUrl: payload.videoUrl,
        caption: payload.caption,
        durationDays: payload.durationDays,
        pointsPaid: payload.pointsCost,
        target: payload.target,
        status: 'pending', // Campaigns start as 'pending' for admin review
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        analytics: { views: 0, likes: 0, clicks: 0, shares: 0, conversions: 0 },
      };

      transaction.update(userProfileRef, { aiPoints: FieldValue.increment(-payload.pointsCost) });
      transaction.set(newBoostRef, newBoostData);
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error creating boost request:', error);
    return { success: false, error: error.message || 'An unknown server error occurred.' };
  }
}
