import { NextRequest, NextResponse } from 'next/server';
import { db, auth as adminAuth } from '@/firebase/server';
import { getTikTokVideoAnalytics } from '@/lib/tiktok';
import { getFreshTikTokAccessToken } from '@/lib/tiktok/store';
import type { BoostRequest } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';
import { pbIsAdmin } from '@/lib/pocketbase/admins';
import { pbGetProfile } from '@/lib/pocketbase/profiles';
import { isAdminByEnv } from '@/lib/server/admin-env';

/**
 * Endpoint to refresh the analytics of a specific boost campaign from TikTok.
 * Updated for Next.js 15 Async Params.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boostId: string }> }
) {
  const { boostId } = await params;

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

  const boostRef = db.collection('boost_requests').doc(boostId);
  const boostSnap = await boostRef.get();

  if (!boostSnap.exists) {
    return NextResponse.json({ message: 'Boost request not found' }, { status: 404 });
  }

  const boostData = boostSnap.data() as BoostRequest;

  const isSellerOwner = boostData.sellerId === decodedToken.uid;
  // Env allowlist first (no database), then VPS stores, then Firestore.
  const isAdmin =
    isAdminByEnv(decodedToken.uid, decodedToken.email) ||
    (await pbIsAdmin(decodedToken.uid)) === true ||
    (await pbGetProfile(decodedToken.uid))?.userRole === 'admin' ||
    (await db
      .collection('userProfiles')
      .doc(decodedToken.uid)
      .get()
      .then((p) => p.data()?.userRole === 'admin')
      .catch(() => false));

  if (!isSellerOwner && !isAdmin) {
    return NextResponse.json({ message: 'Forbidden: You do not have permission to refresh this campaign.' }, { status: 403 });
  }

  if (boostData.status !== 'active' || !boostData.tiktokVideoId) {
    return NextResponse.json({ message: 'This boost is not active on TikTok or has no video ID.' }, { status: 400 });
  }

  // Secure store: tokens no longer live on the (publicly readable) profile.
  // getFreshTikTokAccessToken transparently refreshes near-expiry tokens and
  // falls back to the legacy profile location until migration is verified.
  const accessToken = await getFreshTikTokAccessToken(boostData.sellerId);

  if (!accessToken) {
    return NextResponse.json({ message: 'Seller TikTok connection not found or token is missing.' }, { status: 400 });
  }

  try {
    const videoAnalytics = await getTikTokVideoAnalytics(accessToken, [boostData.tiktokVideoId]);
    
    if (videoAnalytics.length === 0) {
      throw new Error('Could not retrieve video analytics from TikTok.');
    }

    const newStats = videoAnalytics[0];

    const priorAnalytics = boostData.analytics ?? {};
    const updatedAnalytics = {
      views: newStats.view_count || priorAnalytics.views,
      likes: newStats.like_count || priorAnalytics.likes,
      shares: newStats.share_count || priorAnalytics.shares,
      clicks: priorAnalytics.clicks,
      conversions: priorAnalytics.conversions,
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
