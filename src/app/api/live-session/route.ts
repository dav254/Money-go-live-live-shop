
import { NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp, doc, setDoc, updateDoc } from 'firebase-admin/firestore';

// Helper to verify user token and get UID
async function verifyUser(request: Request) {
  const adminApp = initializeAdminApp();
  const auth = getAuth(adminApp);
  
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized: Missing or malformed token.', status: 401 };
  }
  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(token);
    return { uid: decodedToken.uid };
  } catch (error) {
    return { error: 'Unauthorized: Invalid token.', status: 403 };
  }
}


/**
 * POST handler to create a new live session.
 */
export async function POST(request: Request) {
  const verification = await verifyUser(request);
  if ('error' in verification) {
    return NextResponse.json({ error: verification.error }, { status: verification.status });
  }
  const sellerId = verification.uid;

  try {
    const adminApp = initializeAdminApp();
    const db = getFirestore(adminApp);

    const userProfileDoc = await db.collection('userProfiles').doc(sellerId).get();
    if (!userProfileDoc.exists) {
        return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }
    const userProfile = userProfileDoc.data();
    const sellerName = userProfile?.shopName || userProfile?.fullName || 'Seller';

    const newSessionRef = doc(db, 'liveSessions', sellerId);

    await setDoc(newSessionRef, {
      id: sellerId,
      sellerId: sellerId,
      title: `${sellerName}'s Live Show`,
      status: 'live',
      productIds: [],
      viewerCount: 0,
      startTime: Timestamp.now(),
    }, { merge: true });

    return NextResponse.json({ success: true, liveSessionId: newSessionRef.id });

  } catch (error: any) {
    console.error('Error creating live session:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

/**
 * PUT handler to end a live session.
 */
export async function PUT(request: Request) {
  const verification = await verifyUser(request);
  if ('error' in verification) {
    return NextResponse.json({ error: verification.error }, { status: verification.status });
  }
  const sellerId = verification.uid;

  const { liveSessionId } = await request.json();

  if (!liveSessionId) {
    return NextResponse.json({ error: 'Live Session ID is required.' }, { status: 400 });
  }

  try {
    const adminApp = initializeAdminApp();
    const db = getFirestore(adminApp);
    const sessionRef = doc(db, 'liveSessions', liveSessionId);

    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists() || sessionDoc.data()?.sellerId !== sellerId) {
        return NextResponse.json({ error: 'Forbidden: You do not own this live session.' }, { status: 403 });
    }

    await updateDoc(sessionRef, {
      status: 'ended',
      endTime: Timestamp.now(),
    });

    return NextResponse.json({ success: true, message: 'Live session ended.' });

  } catch (error: any) {
    console.error('Error ending live session:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
