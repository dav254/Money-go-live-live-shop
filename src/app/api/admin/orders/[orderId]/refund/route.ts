import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { Order } from '@/lib/types';

async function verifyAdmin(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return { error: 'Unauthorized: Missing or malformed token' };
    }
    const token = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await auth.verifyIdToken(token);
        const userProfileSnap = await db.doc(`userProfiles/${decodedToken.uid}`).get();
        if (userProfileSnap.data()?.userRole !== 'admin') {
            return { error: 'Forbidden: User is not an admin.' };
        }
        return { uid: decodedToken.uid };
    } catch (error) {
        return { error: 'Unauthorized: Invalid token.' };
    }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const adminVerification = await verifyAdmin(request);
  if (adminVerification.error) {
    return NextResponse.json({ message: adminVerification.error }, { status: 403 });
  }

  const { orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ message: 'Order ID is required' }, { status: 400 });
  }

  const { reason } = await request.json();
  const orderRef = db.doc(`orders/${orderId}`);

  try {
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    const order = orderSnap.data() as Order;

    if (['refunded', 'cancelled'].includes(order.orderStatus)) {
        return NextResponse.json({ message: 'Order has already been refunded or cancelled.' }, { status: 400 });
    }

    const { sellerId, resellerId, buyerId, productPrice, shippingCost, totalAmount } = order;

    // --- Define Split Rates ---
    const PLATFORM_FEE_RATE = 0.10;
    const RESELLER_COMMISSION_RATE = 0.10;
    
    const price = productPrice || 0;
    const platformFee = price * PLATFORM_FEE_RATE;
    let resellerCommission = 0;
    if (resellerId) {
        resellerCommission = price * RESELLER_COMMISSION_RATE;
    }
    const sellerNetEarnings = price - platformFee - resellerCommission;

    const batch = db.batch();
    const timestamp = FieldValue.serverTimestamp();

    // 1. Update Order Status
    batch.update(orderRef, {
      orderStatus: 'refunded',
      disputeReason: `Refund issued by admin: ${reason || 'No reason provided.'}`,
      updatedAt: timestamp,
    });

    // 2. Credit Buyer (Full Refund)
    const buyerRefundRef = db.collection('walletTransactions').doc();
    batch.set(buyerRefundRef, {
        userId: buyerId,
        orderId: orderId,
        type: 'REFUND',
        amount: totalAmount,
        description: `Refund for order #${orderId.substring(0, 6)}`,
        timestamp: timestamp,
    });
    
    // 3. Debit Seller (Net Earnings + Shipping)
    const sellerDebitRef = db.collection('walletTransactions').doc();
    batch.set(sellerDebitRef, {
        userId: sellerId,
        orderId: orderId,
        type: 'REFUND',
        amount: -(sellerNetEarnings + (shippingCost || 0)),
        description: `Reversal for refunded order #${orderId.substring(0, 6)}`,
        timestamp: timestamp,
    });
    
    // 4. Debit Reseller (Commission)
    if (resellerId && resellerCommission > 0) {
        const resellerDebitRef = db.collection('walletTransactions').doc();
        batch.set(resellerDebitRef, {
            userId: resellerId,
            orderId: orderId,
            type: 'REFUND',
            amount: -resellerCommission,
            description: `Reversal of commission for refunded order #${orderId.substring(0, 6)}`,
            timestamp: timestamp,
        });
    }
    
    // 5. Debit Platform (Fee)
    const platformDebitRef = db.collection('walletTransactions').doc();
    batch.set(platformDebitRef, {
        userId: 'platform_revenue',
        orderId: orderId,
        type: 'REFUND',
        amount: -platformFee,
        description: `Reversal of fee for refunded order #${orderId.substring(0, 6)}`,
        timestamp: timestamp,
    });

    await batch.commit();

    return NextResponse.json({ success: true, message: `Order #${orderId.substring(0, 6)} fully refunded.` });

  } catch (error: any) {
    console.error(`Error refunding order ${orderId}:`, error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
