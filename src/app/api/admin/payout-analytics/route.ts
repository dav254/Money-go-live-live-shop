
import { NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Payout } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const adminApp = initializeAdminApp();
    const auth = getAuth(adminApp);
    const db = getFirestore(adminApp);
    
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const userProfileDoc = await db.collection('userProfiles').doc(uid).get();

    if (!userProfileDoc.exists || userProfileDoc.data()?.userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const pendingPayoutsSnapshot = await db
      .collection('payouts')
      .where('status', '==', 'pending')
      .get();
      
    let totalPending = 0;
    pendingPayoutsSnapshot.forEach(doc => {
      const payout = doc.data() as Payout;
      totalPending += payout.amount;
    });

    return NextResponse.json({ totalPending });

  } catch (error: any) {
    console.error('API Payout Analytics Error:', error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
