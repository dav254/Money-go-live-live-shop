
'use server';

import { db } from '@/firebase/server';
import { getAuth } from 'firebase-admin/auth';

interface UpdateResellerSettingsPayload {
  productId: string;
  isResellable: boolean;
  commissionRate: number;
}

export async function updateResellerSettings(payload: UpdateResellerSettingsPayload, authToken: string) {
  try {
    const decodedToken = await getAuth().verifyIdToken(authToken);
    const uid = decodedToken.uid;

    const productRef = db.collection('products').doc(payload.productId);
    const productSnap = await productRef.get();

    if (!productSnap.exists) {
      return { success: false, error: 'Product not found.' };
    }

    const productData = productSnap.data();
    if (productData?.sellerId !== uid) {
      return { success: false, error: 'You do not have permission to edit this product.' };
    }

    await productRef.update({
      isResellable: payload.isResellable,
      commissionRate: payload.commissionRate,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating reseller settings:', error);
    if (error.code === 'permission-denied') {
        return { success: false, error: 'Permission denied. Please check your security rules.' };
    }
    return { success: false, error: error.message || 'An unknown server error occurred.' };
  }
}
