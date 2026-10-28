
import { NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import type { BoostRequest } from '@/lib/types';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { pbIsAdmin } from '@/lib/pocketbase/admins';
import { pbGetProfile } from '@/lib/pocketbase/profiles';


export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);

    // VPS stores first (works when Firestore is blocked), Firestore second.
    const isAdmin =
      (await pbIsAdmin(decodedToken.uid)) === true ||
      (await pbGetProfile(decodedToken.uid))?.userRole === 'admin' ||
      (await db
        .collection('userProfiles')
        .doc(decodedToken.uid)
        .get()
        .then((p) => p.exists && p.data()?.userRole === 'admin')
        .catch(() => false));
    if (!isAdmin) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const campaignsSnapshot = await db.collection('boost_requests').orderBy('createdAt', 'desc').get();
    
    const campaigns = campaignsSnapshot.docs.map(doc => {
        const data = doc.data() as BoostRequest;
        const createdAt = data.createdAt as any; // Cast to any to access toDate()
        const updatedAt = data.updatedAt as any; // Cast to any to access toDate()
        return {
            ...data,
            id: doc.id,
            // Safely convert Timestamp to ISO string
            createdAt: (createdAt && typeof createdAt.toDate === 'function')
                ? createdAt.toDate().toISOString()
                : new Date().toISOString(),
             updatedAt: (updatedAt && typeof updatedAt.toDate === 'function')
                ? updatedAt.toDate().toISOString()
                : new Date().toISOString(),
        };
    });

    return NextResponse.json(campaigns);

  } catch (error: any) {
    console.error('Error fetching admin campaigns:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
