
import { NextRequest, NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/admin';
import type { BoostRequest } from '@/lib/types';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, doc, updateDoc, getDoc, collection, getDocs, query, orderBy, increment } from 'firebase-admin/firestore';
import { uploadVideoToTikTok } from '@/lib/tiktok';

async function verifyAdmin(request: NextRequest) {
    const adminApp = initializeAdminApp();
    const auth = getAuth(adminApp);
    const db = getFirestore(adminApp);

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
        return { error: 'Unauthorized: No token provided.', status: 401 };
    }
    const token = authHeader.split('Bearer ')[1];
    
    try {
        const decodedToken = await auth.verifyIdToken(token);
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
    const db = getFirestore(initializeAdminApp());
    const campaignsSnapshot = await db.collection('boost_requests').orderBy('createdAt', 'desc').get();
    
    const campaigns = campaignsSnapshot.docs.map(doc => {
        const data = doc.data() as BoostRequest;
        return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt.toDate().toISOString(),
            updatedAt: data.updatedAt.toDate().toISOString(),
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
        if (!boostId || !action || (action !== 'approved' && action !== 'rejected')) {
            return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
        }
        
        const db = getFirestore(initializeAdminApp());
        const boostRef = doc(db, 'boost_requests', boostId);
        const boostSnap = await getDoc(boostRef);

        if (!boostSnap.exists()) {
            return NextResponse.json({ message: 'Boost request not found' }, { status: 404 });
        }

        const boostData = boostSnap.data() as BoostRequest;

        if (action === 'rejected') {
            await updateDoc(boostRef, { 
                status: 'rejected', 
                rejectionReason: rejectionReason || 'Content did not meet guidelines.',
                updatedAt: new Date()
            });
            // Refund points to the seller
            const sellerRef = doc(db, 'userProfiles', boostData.sellerId);
            await updateDoc(sellerRef, { aiPoints: increment(boostData.pointsPaid) });

            return NextResponse.json({ success: true, message: 'Boost rejected and points refunded.' });
        }
        
        if (action === 'approved') {
            // Placeholder for real upload logic
            // In a real scenario, you'd fetch the user's TikTok token and call the upload function
            // For now, we'll just simulate success.
            await new Promise(resolve => setTimeout(resolve, 1000));

            await updateDoc(boostRef, {
                status: 'active',
                tiktokVideoId: `simulated_${Date.now()}`,
                updatedAt: new Date()
            });

            return NextResponse.json({ success: true, message: 'Boost approved and marked as active.' });
        }

    } catch (error: any) {
        console.error('Error processing boost action:', error);
        return NextResponse.json({ message: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
