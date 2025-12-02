
'use server';

import { initializeAdminApp } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { headers } from 'next/headers';

interface CreateAdCampaignPayload {
  productId: string;
  productName: string;
  productImageUrl: string;
  budget: number;
}

export async function createAdCampaign(payload: CreateAdCampaignPayload): Promise<{ success: boolean; error?: string }> {
  try {
    // Initialize Firebase Admin SDK at the beginning of the server action
    initializeAdminApp();
    const firestore = getFirestore();
    const auth = getAuth();

    const authToken = headers().get('Authorization')?.split('Bearer ')[1];
    if (!authToken) {
      throw new Error('User is not authenticated.');
    }

    const decodedToken = await auth.verifyIdToken(authToken);
    const userId = decodedToken.uid;

    const userProfileRef = firestore.collection('userProfiles').doc(userId);
    const userProfileSnap = await userProfileRef.get();

    if (!userProfileSnap.exists) {
      throw new Error('User profile not found.');
    }

    const userProfile = userProfileSnap.data();
    if (userProfile?.userRole !== 'seller') {
      throw new Error('Only sellers can create ad campaigns.');
    }

    const currentPoints = userProfile?.aiPoints || 0;
    if (currentPoints < payload.budget) {
      throw new Error(`Insufficient points. You need ${payload.budget} points, but have ${currentPoints}.`);
    }

    // Deduct points and create campaign in a single transaction
    const campaignRef = firestore.collection('adCampaigns').doc();
    
    const newCampaignData = {
      id: campaignRef.id,
      sellerId: userId,
      productId: payload.productId,
      productName: payload.productName,
      productImageUrl: payload.productImageUrl,
      status: 'draft',
      budget: payload.budget,
      spend: 0,
      clicks: 0,
      conversions: 0,
      startDate: Timestamp.now(),
    };

    await firestore.runTransaction(async (transaction) => {
      transaction.update(userProfileRef, {
        aiPoints: FieldValue.increment(-payload.budget),
      });
      transaction.set(campaignRef, newCampaignData);
    });

    return { success: true };

  } catch (error: any) {
    console.error("Error creating ad campaign:", error);
    // Return the specific error message to the frontend
    return { success: false, error: error.message || 'An unknown error occurred.' };
  }
}
