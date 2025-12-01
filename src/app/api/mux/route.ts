
import { NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/admin';
import Mux from '@mux/mux-node';
// Do NOT import firebase-admin services at the top level.

let mux: Mux | null = null;
if (process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET) {
    mux = new Mux({
        tokenId: process.env.MUX_TOKEN_ID,
        tokenSecret: process.env.MUX_TOKEN_SECRET,
    });
}

export async function POST(request: Request) {
  try {
    initializeAdminApp();
    const { getAuth } = await import('firebase-admin/auth');
    const { getFirestore } = await import('firebase-admin/firestore');
    
    if (!mux) {
        console.error('Mux API credentials are not configured.');
        return NextResponse.json({ error: 'Live streaming service is not configured.' }, { status: 503 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Malformed token' }, { status: 401 });
    }

    const decodedToken = await getAuth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const db = getFirestore();
    const userProfileDoc = await db.collection('userProfiles').doc(uid).get();

    if (!userProfileDoc.exists || userProfileDoc.data()?.userRole !== 'seller') {
      return NextResponse.json({ error: 'Forbidden: Only sellers can create live streams.' }, { status: 403 });
    }

    const stream = await mux.video.liveStreams.create({
      playback_policy: ['public'],
      new_asset_settings: { playback_policy: ['public'] },
      reconnect_window: 10,
    });

    if (!stream.id || !stream.stream_key || !stream.playback_ids?.[0]?.id) {
        throw new Error('Mux failed to return complete stream data.');
    }

    return NextResponse.json({
        streamId: stream.id,
        streamKey: stream.stream_key,
        playbackId: stream.playback_ids[0].id,
    });

  } catch (error: any) {
    console.error('Mux API Route Error:', error);
    if (error.code === 'auth/id-token-expired') {
        return NextResponse.json({ error: 'Authentication token has expired. Please log in again.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
