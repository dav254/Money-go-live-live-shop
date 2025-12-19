
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { BoostRequest, UserProfile } from '@/lib/types';
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
            createdAt: data.createdAt ? (data.createdAt as any).toDate().toISOString() : null,
            updatedAt: data.updatedAt ? (data.updatedAt as any).toDate().toISOString() : null,
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
        if (!boostId || !action || (action !== 'approved' && action !== 'rejected' && action !== 'post_to_tiktok')) {
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
                updatedAt: new Date()
            });
            // Refund points to the seller
            const sellerRef = db.collection('userProfiles').doc(boostData.sellerId);
            await sellerRef.update({ aiPoints: FieldValue.increment(boostData.pointsPaid) });

            return NextResponse.json({ success: true, message: 'Boost rejected and points refunded.' });
        }
        
        if (action === 'approved') {
            await boostRef.update({
                status: 'approved',
                updatedAt: new Date()
            });
            
            return NextResponse.json({ success: true, message: 'Boost approved and is ready to be posted.' });
        }
        
        if (action === 'post_to_tiktok') {
            if (boostData.status !== 'approved') {
                return NextResponse.json({ message: 'Boost must be approved before posting.' }, { status: 400 });
            }

            const sellerProfileRef = db.collection('userProfiles').doc(boostData.sellerId);
            const sellerProfileSnap = await sellerProfileRef.get();
            if (!sellerProfileSnap.exists()) {
                throw new Error("Seller profile not found for this boost request.");
            }
            const sellerProfile = sellerProfileSnap.data() as UserProfile;
            const tiktokConnection = sellerProfile.connections?.tiktok;

            if (!tiktokConnection || !tiktokConnection.accessToken) {
                 await boostRef.update({ status: 'rejected', rejectionReason: 'Seller has not connected their TikTok account.' });
                 const sellerRef = db.collection('userProfiles').doc(boostData.sellerId);
                 await sellerRef.update({ aiPoints: FieldValue.increment(boostData.pointsPaid) });
                 return NextResponse.json({ message: 'Boost rejected: Seller TikTok account not connected.' }, { status: 400 });
            }

            const uploadResult = await uploadVideoToTikTok(boostData, tiktokConnection.accessToken);

            if (!uploadResult.success) {
                 await boostRef.update({ status: 'rejected', rejectionReason: `TikTok API Error: ${uploadResult.message}` });
                 const sellerRef = db.collection('userProfiles').doc(boostData.sellerId);
                 await sellerRef.update({ aiPoints: FieldValue.increment(boostData.pointsPaid) });
                return NextResponse.json({ message: `Boost rejected due to TikTok API error: ${uploadResult.message}` }, { status: 500 });
            }
            
            await boostRef.update({
                status: 'active',
                tiktokVideoId: uploadResult.videoId,
                updatedAt: new Date()
            });

            return NextResponse.json({ success: true, message: 'Boost approved and posted to TikTok.' });
        }

    } catch (error: any) {
        console.error('Error processing boost action:', error);
        return NextResponse.json({ message: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
