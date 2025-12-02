import { NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/admin';
import type { AdCampaign } from '@/lib/types';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';


export async function GET(request: Request) {
  try {
    const adminApp = initializeAdminApp();
    const auth = getAuth(adminApp);
    const db = getFirestore(adminApp);

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);

    const userProfileSnap = await db.collection('userProfiles').doc(decodedToken.uid).get();

    if (!userProfileSnap.exists() || userProfileSnap.data()?.userRole !== 'admin') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const campaignsSnapshot = await db.collection('adCampaigns').orderBy('startDate', 'desc').get();
    
    const campaigns = campaignsSnapshot.docs.map(doc => {
        const data = doc.data() as AdCampaign;
        return {
            ...data,
            id: doc.id,
            startDate: data.startDate?.toDate().toISOString(),
        };
    });

    return NextResponse.json(campaigns);

  } catch (error: any) {
    console.error('Error fetching admin campaigns:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
