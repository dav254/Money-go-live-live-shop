import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { BoostRequest } from '@/lib/types';
import { getAuth } from 'firebase-admin/auth';
import { uploadVideoToTikTok } from '@/lib/tiktok';

async function verifyAdmin(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
        return { error: 'Unauthorized: No token provided.', status: 401 };
    }
    const token = authHeader.split('Bearer ')[1];
    
    try {
        const decodedToken = await getAuth().verifyIdToken(token);
        const userProfileSnap = await db.collection('userProfiles').doc(decodedToken.uid).get();

        if (!userProfileSnap.exists || userProfileSnap.data()?.userRole !== 'admin') {
            return { error: 'Forbidden: User is not an admin.', status: 403 };
        }
        return { success: true, uid: decodedToken.uid };
    } catch (error: any) {
        return { error: 'Unauthorized: Invalid token.', status: 401, details: error.message };
    }
}

export async function GET(request: NextRequest) {
  const adminVerification = await verifyAdmin(request);
  if (adminVerification.error) {
      return NextResponse.json({ message: adminVerification.error, details: adminVerification.details }, { status: adminVerification.status });
  }

  try {
    const campaignsSnapshot = await db.collection('boost_requests').orderBy('createdAt', 'desc').get();
    
    const campaigns = campaignsSnapshot.docs.map(doc => {
        const data = doc.data() as BoostRequest;
        return {
            ...data,
            id: doc.id,
            createdAt: (data.createdAt as any)?.toDate()?.toISOString(),
            updatedAt: (data.updatedAt as any)?.toDate()?.toISOString(),
        };
    });

    return NextResponse.json(campaigns);

  } catch (error: any) {
    console.error('Error fetching admin campaigns:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}


export async function PUT(request: NextRequest) {
    const adminVerification = await verifyAdmin(request);
    if (adminVerification.error) {
        return NextResponse.json({ message: adminVerification.error }, { status: adminVerification.status });
    }

    try {
        const { boostId, action, rejectionReason } = await request.json();
        if (!boostId || !action || !['approved', 'rejected', 'post_to_tiktok', 're-queue'].includes(action)) {
            return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
        }
        
        const boostRef = db.collection('boost_requests').doc(boostId);
        const boostSnap = await boostRef.get();

        if (!boostSnap.exists) {
            return NextResponse.json({ message: 'Boost request not found' }, { status: 404 });
        }

        const boostData = boostSnap.data() as BoostRequest;

        if (action === 'rejected') {
            await boostRef.update({ 
                status: 'rejected', 
                rejectionReason: rejectionReason || 'Content did not meet guidelines.',
                updatedAt: FieldValue.serverTimestamp()
            });
            // Refund points to the seller
            const sellerRef = db.collection('userProfiles').doc(boostData.sellerId);
            await sellerRef.update({ aiPoints: FieldValue.increment(boostData.pointsPaid) });

            return NextResponse.json({ success: true, message: 'Boost rejected and points refunded.' });
        }
        
        if (action === 'approved') {
            await boostRef.update({
                status: 'approved',
                updatedAt: FieldValue.serverTimestamp()
            });
            
            return NextResponse.json({ success: true, message: 'Boost approved and is ready to be posted.' });
        }

        if (action === 're-queue') {
            await boostRef.update({
                status: 'pending',
                rejectionReason: null, // Clear rejection reason
                updatedAt: FieldValue.serverTimestamp()
            });
            return NextResponse.json({ success: true, message: 'Boost has been moved back to the pending queue.' });
        }
        
        if (action === 'post_to_tiktok') {
            if (boostData.status !== 'approved') {
                return NextResponse.json({ message: 'Boost must be approved before posting.' }, { status: 400 });
            }
            
            const goEarnTikTokToken = process.env.GOEARN_TIKTOK_ACCESS_TOKEN;
            const goEarnTikTokOpenId = process.env.GOEARN_TIKTOK_OPEN_ID;

            if (!goEarnTikTokToken || !goEarnTikTokOpenId) {
                 await boostRef.update({ status: 'rejected', rejectionReason: 'Platform TikTok account not configured.', updatedAt: FieldValue.serverTimestamp() });
                 const sellerRef = db.collection('userProfiles').doc(boostData.sellerId);
                 await sellerRef.update({ aiPoints: FieldValue.increment(boostData.pointsPaid) });
                 console.error('CRITICAL: GOEARN_TIKTOK_ACCESS_TOKEN or GOEARN_TIKTOK_OPEN_ID is not set in environment variables.');
                 return NextResponse.json({ message: 'Boost rejected: Platform TikTok account not configured.' }, { status: 500 });
            }

            const uploadResult = await uploadVideoToTikTok(boostData, goEarnTikTokToken, goEarnTikTokOpenId);

            if (!uploadResult.success) {
                 await boostRef.update({ status: 'rejected', rejectionReason: `TikTok API Error: ${uploadResult.message}`, updatedAt: FieldValue.serverTimestamp() });
                 const sellerRef = db.collection('userProfiles').doc(boostData.sellerId);
                 await sellerRef.update({ aiPoints: FieldValue.increment(boostData.pointsPaid) });
                return NextResponse.json({ message: `Boost rejected due to TikTok API error: ${uploadResult.message}` }, { status: 500 });
            }
            
            await boostRef.update({
                status: 'active',
                tiktokVideoId: uploadResult.videoId,
                updatedAt: FieldValue.serverTimestamp()
            });

            return NextResponse.json({ success: true, message: 'Boost approved and posted to the official Vidnov TikTok account.' });
        }

    } catch (error: any) {
        console.error('Error processing boost action:', error);
        return NextResponse.json({ message: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
