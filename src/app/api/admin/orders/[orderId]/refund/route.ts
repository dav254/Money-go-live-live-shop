import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { pbPatchOrder } from '@/lib/pocketbase/orders';
import { pbMirrorWalletTransaction } from '@/lib/pocketbase/wallet';
import { pbGetProfile } from '@/lib/pocketbase/profiles';
import { pbIsAdmin } from '@/lib/pocketbase/admins';
import { isAdminByEnv } from '@/lib/server/admin-env';
import type { Order } from '@/lib/types';

async function verifyAdmin(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return { error: 'Unauthorized: Missing or malformed token' };
    }
    const token = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await auth.verifyIdToken(token);
        // Role: env allowlist, then local admin grant, then VPS profile,
        // then Firestore — so the refund button works when Firestore is blocked.
        let isAdmin = isAdminByEnv(decodedToken.uid, decodedToken.email) ||
            (await pbIsAdmin(decodedToken.uid)) === true ||
            (await pbGetProfile(decodedToken.uid))?.userRole === 'admin';
        if (!isAdmin) {
            const userProfileSnap = await db.doc(`userProfiles/${decodedToken.uid}`).get().catch(() => null);
            isAdmin = userProfileSnap?.data()?.userRole === 'admin';
        }
        if (!isAdmin) {
            return { error: 'Forbidden: User is not an admin.' };
        }
        return { uid: decodedToken.uid };
    } catch (error) {
        return { error: 'Unauthorized: Invalid token.' };
    }
}

/**
 * Refund handler updated for Next.js 15 Async Params.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const adminVerification = await verifyAdmin(request);
  if ((adminVerification as any).error) {
    return NextResponse.json({ message: (adminVerification as any).error }, { status: 403 });
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

    batch.update(orderRef, {
      orderStatus: 'refunded',
      disputeReason: `Refund issued by admin: ${reason || 'No reason provided.'}`,
      updatedAt: timestamp,
    });

    const buyerRefundRef = db.collection('walletTransactions').doc();
    batch.set(buyerRefundRef, {
        userId: buyerId,
        orderId: orderId,
        type: 'REFUND',
        amount: totalAmount,
        description: `Refund for order #${orderId.substring(0, 6)}`,
        timestamp: timestamp,
    });    const sellerDebitRef = db.collection('walletTransactions'). doc();
    batch.set(sellerDebitRef, {
        userId: sellerId,
        orderId: orderId,
        type: 'REFUND',
        amount: -(sellerNetEarnings + (shippingCost || 0)),
        description: `Reversal for refunded order #${orderId.substring(0, 6)}`,
        timestamp: timestamp,
    });
    
    const resellerDebitRef = db.collection('walletTransactions'). doc();
    if (resellerId && resellerCommission > 0) {
        batch.set(resellerDebitRef, {
            userId: resellerId,
            orderId: orderId,
            type: 'REFUND',
            amount: -resellerCommission,
            description: `Reversal of commission for refunded order #${orderId.substring(0, 6)}`,
            timestamp: timestamp,
        });
    }
    
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

    /*
     * VPS copies of the money trail (best-effort — the batch already
     * committed): the order's refunded state and every ledger row, so the
     * refund stays auditable even if Firestore later cannot answer.
     */
    const mirroredAt = new Date().toISOString();
    void pbPatchOrder(orderId, {
      orderStatus: 'refunded',
      disputeReason: `Refund issued by admin: ${reason || 'No reason provided.'}`,
      updatedAt: mirroredAt,
    });
    void pbMirrorWalletTransaction(buyerRefundRef.id, {
      userId: buyerId,
      orderId,
      type: 'REFUND',
      amount: totalAmount,
      description: `Refund for order #${orderId.substring(0, 6)}`,
      timestamp: mirroredAt,
    });
    void pbMirrorWalletTransaction(sellerDebitRef.id, {
      userId: sellerId,
      orderId,
      type: 'REFUND',
      amount: -(sellerNetEarnings + (shippingCost || 0)),
      description: `Reversal for refunded order #${orderId.substring(0, 6)}`,
      timestamp: mirroredAt,
    });
    if (resellerId && resellerCommission > 0) {
      void pbMirrorWalletTransaction(resellerDebitRef.id, {
        userId: resellerId,
        orderId,
        type: 'REFUND',
        amount: -resellerCommission,
        description: `Reversal of commission for refunded order #${orderId.substring(0, 6)}`,
        timestamp: mirroredAt,
      });
    }
    void pbMirrorWalletTransaction(platformDebitRef.id, {
      userId: 'platform_revenue',
      orderId,
      type: 'REFUND',
      amount: -platformFee,
      description: `Reversal of fee for refunded order #${orderId.substring(0, 6)}`,
      timestamp: mirroredAt,
    });

    return NextResponse.json({ success: true, message: `Order #${orderId.substring(0, 6)} fully refunded.` });

  } catch (error: any) {
    console.error(`Error refunding order ${orderId}:`, error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}