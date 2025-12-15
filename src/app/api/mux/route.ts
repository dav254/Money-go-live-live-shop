
import { NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase-admin/firestore';
import Mux from '@mux/mux-node';
import type { LiveSession } from '@/lib/types';

// Initialize Mux with credentials from environment variables
if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
    console.error("Mux environment variables MUX_TOKEN_ID and MUX_TOKEN_SECRET must be set.");
}
const { Video } = new Mux();


// This handler should only be callable by authenticated sellers.
export async function POST(request: Request) {
  try {
    const adminApp = initializeAdminApp();
    const auth = getAuth(adminApp);
    const db = getFirestore(adminApp);

    // 1. Authenticate the user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const sellerId = decodedToken.uid;

    // 2. Verify the user has a 'seller' role
    const userProfileSnap = await db.collection('userProfiles').doc(sellerId).get();
    if (!userProfileSnap.exists() || userProfileSnap.data()?.userRole !== 'seller') {
        return NextResponse.json({ error: 'Forbidden: Only sellers can create live streams.' }, { status: 403 });
    }
    const { title } = await request.json();

    // 3. Create a new Live Stream in Mux
    const liveStream = await Video.LiveStreams.create({
      playback_policy: ['public'],
      new_asset_settings: { playback_policy: ['public'] }
    });

    if (!liveStream.stream_key || !liveStream.playback_ids?.[0]?.id) {
        throw new Error("Mux did not return a stream key or playback ID.");
    }
    
    // 4. Save the Live Session details to Firestore
    // Using sellerId as the document ID makes it easy to find a seller's active stream.
    const liveSessionRef = doc(db, 'liveSessions', sellerId);
    const sessionData: Partial<LiveSession> = {
        id: sellerId, 
        sellerId: sellerId,
        title: title || `${userProfileSnap.data()?.fullName || 'Seller'}'s Live Show`,
        status: 'live', // The stream is immediately ready to be broadcast to
        startTime: serverTimestamp(),
        muxStreamId: liveStream.id,
        muxStreamKey: liveStream.stream_key,
        muxPlaybackId: liveStream.playback_ids[0].id,
    };
    await setDoc(liveSessionRef, sessionData, { merge: true });

    // 5. Return the necessary details to the client
    return NextResponse.json({ 
        streamKey: liveStream.stream_key,
        playbackId: liveStream.playback_ids[0].id
    });

  } catch (error: any) {
    console.error('Error creating Mux live stream:', error);
    // Provide a more structured error response
    return NextResponse.json({ 
        error: 'Internal Server Error', 
        details: error.message || 'An unexpected error occurred while setting up the live stream.' 
    }, { status: 500 });
  }
}
