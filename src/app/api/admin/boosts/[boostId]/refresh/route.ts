
import { NextRequest, NextResponse } from 'next/server';
import { db, auth as adminAuth } from '@/firebase/server';
import { getTikTokVideoAnalytics } from '@/lib/tiktok';
import type { BoostRequest, UserProfile } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Endpoint to refresh the analytics of a specific boost campaign from TikTok.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { boostId: string } }
) {
  const boostId = params.boostId;

  // 1. Verify the user is authenticated (can be an admin or the seller themselves)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch (error) {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  // 2. Fetch the boost request and seller's profile
  const boostRef = db.collection('boost_requests').doc(boostId);
  const boostSnap = await boostRef.get();

  if (!boostSnap.exists) {
    return NextResponse.json({ message: 'Boost request not found' }, { status: 404 });
  }

  const boostData = boostSnap.data() as BoostRequest;

  // 3. Authorization check: only the seller or an admin can refresh
  const userProfileSnap = await db.collection('userProfiles').doc(decodedToken.uid).get();
  const isSellerOwner = boostData.sellerId === decodedToken.uid;
  const isAdmin = userProfileSnap.data()?.userRole === 'admin';

  if (!isSellerOwner && !isAdmin) {
    return NextResponse.json({ message: 'Forbidden: You do not have permission to refresh this campaign.' }, { status: 403 });
  }

  // 4. Ensure the boost is active and has a TikTok video ID
  if (boostData.status !== 'active' || !boostData.tiktokVideoId) {
    return NextResponse.json({ message: 'This boost is not active on TikTok or has no video ID.' }, { status: 400 });
  }

  // 5. Fetch seller's TikTok access token
  const sellerProfileRef = db.collection('userProfiles').doc(boostData.sellerId);
  const sellerProfileSnap = await sellerProfileRef.get();
  const sellerProfile = sellerProfileSnap.data() as UserProfile;
  const tiktokConnection = sellerProfile.connections?.tiktok;

  if (!tiktokConnection?.accessToken) {
    return NextResponse.json({ message: 'Seller TikTok connection not found or token is missing.' }, { status: 400 });
  }

  try {
    // 6. Fetch new analytics from TikTok
    const videoAnalytics = await getTikTokVideoAnalytics(tiktokConnection.accessToken, [boostData.tiktokVideoId]);
    
    if (videoAnalytics.length === 0) {
      throw new Error('Could not retrieve video analytics from TikTok.');
    }

    const newStats = videoAnalytics[0];

    // 7. Update the boost document in Firestore
    const updatedAnalytics = {
      views: newStats.view_count || boostData.analytics.views,
      likes: newStats.like_count || boostData.analytics.likes,
      shares: newStats.share_count || boostData.analytics.shares,
      clicks: boostData.analytics.clicks, // Clicks are tracked separately, not from this API
      conversions: boostData.analytics.conversions,
    };
    
    await boostRef.update({
      'analytics': updatedAnalytics,
      'updatedAt': FieldValue.serverTimestamp(),
    });

    const updatedBoostData = { ...boostData, analytics: updatedAnalytics, id: boostId };

    return NextResponse.json(updatedBoostData);

  } catch (error: any) {
    console.error(`Error refreshing boost ${boostId}:`, error);
    return NextResponse.json({ message: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
