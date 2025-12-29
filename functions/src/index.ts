
'use server';

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import type { UserProfile } from "@/lib/types";

admin.initializeApp();

const db = admin.firestore();

/**
 * Automatically processes an order when its status is updated to 'delivered'.
 * It calculates and distributes earnings to the seller, reseller (if any),
 * the person who referred the seller, and the platform. It also creates
 * notifications for each party.
 */
export const processOrderAndDistributeEarnings = functions.firestore
    .document("orders/{orderId}")
    .onUpdate(async (change, context) => {
      const beforeData = change.before.data();
      const afterData = change.after.data();
      const { orderId } = context.params;

      // --- Trigger Condition ---
      // Only run if the status changes TO 'delivered' from something else.
      if (beforeData.orderStatus === 'delivered' || afterData.orderStatus !== 'delivered') {
        functions.logger.log(`Order ${orderId} status not 'delivered' or was already delivered. Exiting.`);
        return null;
      }

      // --- Basic Validation ---
      if (!afterData || !afterData.sellerId || !afterData.productPrice || !afterData.buyerId) {
        functions.logger.error("Order missing critical data (sellerId, buyerId, productPrice)", { orderId });
        return null;
      }

      const { sellerId, resellerId, buyerId, productPrice, shippingCost, productName } = afterData;
      
      try {
        // --- Define Rates (Source of Truth) ---
        const VAT_RATE = 0.16; // 16%
        const PLATFORM_FEE_RATE = 0.10; // 10% of product price
        const RESELLER_COMMISSION_RATE = 0.10; // 10% of product price
        const SELLER_REFERRAL_COMMISSION_RATE = 0.01; // 1% of product price for the person who referred the seller

        // --- Calculate All Financial Splits ---
        const taxAmount = productPrice * VAT_RATE;
        
        let resellerCommission = 0;
        if (resellerId) {
            resellerCommission = productPrice * RESELLER_COMMISSION_RATE;
        }
        
        // Fetch the seller's profile to check if they were referred
        const sellerProfileSnap = await db.doc(`userProfiles/${sellerId}`).get();
        const sellerProfile = sellerProfileSnap.data() as UserProfile | undefined;
        
        let sellerReferralCommission = 0;
        let sellerReferrerId: string | null = null;
        if (sellerProfile?.referredBy) {
            sellerReferrerId = sellerProfile.referredBy;
            sellerReferralCommission = productPrice * SELLER_REFERRAL_COMMISSION_RATE;
        }
        
        const platformFee = (productPrice * PLATFORM_FEE_RATE);

        // Correctly calculate seller's earnings AFTER all commissions and fees
        const sellerNetEarnings = productPrice - platformFee - resellerCommission - sellerReferralCommission;

        const batch = db.batch();
        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        // --- Create Transaction Records for Each Party ---

        // A. Seller's Earning Transaction
        const sellerEarningRef = db.collection("walletTransactions").doc();
        batch.set(sellerEarningRef, {
          userId: sellerId,
          orderId: orderId,
          type: "SALE_EARNING",
          amount: sellerNetEarnings,
          description: `Net earnings from order #${orderId.substring(0, 6)}`,
          timestamp: timestamp,
        });

        // B. Seller's Shipping Reimbursement Transaction
        if (shippingCost && shippingCost > 0) {
            const sellerShippingRef = db.collection("walletTransactions").doc();
            batch.set(sellerShippingRef, {
                userId: sellerId,
                orderId: orderId,
                type: "SHIPPING_FEE",
                amount: shippingCost,
                description: `Shipping reimbursement for order #${orderId.substring(0, 6)}`,
                timestamp: timestamp,
            });
        }

        // C. Reseller's Commission Transaction & Notification (for the direct sale)
        if (resellerId && resellerCommission > 0) {
          const resellerTransactionRef = db.collection("walletTransactions").doc();
          batch.set(resellerTransactionRef, {
            userId: resellerId,
            orderId: orderId,
            type: "COMMISSION",
            amount: resellerCommission,
            description: `Commission for order #${orderId.substring(0, 6)}`,
            timestamp: timestamp,
          });

          // Create notification for the reseller
          const resellerNotifRef = db.collection('notifications').doc();
          batch.set(resellerNotifRef, {
            userId: resellerId,
            type: 'commission',
            title: 'New Commission Earned!',
            message: `You earned $${resellerCommission.toFixed(2)} commission from the sale of "${productName}".`,
            link: `/dashboard/reseller/commissions`,
            status: 'unread',
            timestamp: timestamp,
          });
        }
        
        // D. Seller Referrer's Commission Transaction & Notification
        if (sellerReferrerId && sellerReferralCommission > 0) {
            const sellerReferrerTxRef = db.collection("walletTransactions").doc();
            batch.set(sellerReferrerTxRef, {
                userId: sellerReferrerId,
                orderId: orderId,
                type: "COMMISSION",
                amount: sellerReferralCommission,
                description: `Seller referral bonus from order #${orderId.substring(0, 6)}`,
                timestamp: timestamp,
            });
            
             // Create notification for the seller's referrer
            const sellerReferrerNotifRef = db.collection('notifications').doc();
            batch.set(sellerReferrerNotifRef, {
                userId: sellerReferrerId,
                type: 'commission',
                title: 'Seller Referral Bonus!',
                message: `You earned a $${sellerReferralCommission.toFixed(2)} bonus because a seller you referred made a sale!`,
                link: `/dashboard/reseller/commissions`,
                status: 'unread',
                timestamp: timestamp,
            });
        }
        
        // E. Platform Fee Transaction
        const platformTransactionRef = db.collection("walletTransactions").doc();
        batch.set(platformTransactionRef, {
          userId: "platform_revenue",
          orderId: orderId,
          type: "PLATFORM_FEE",
          amount: platformFee,
          description: `Platform fee for order #${orderId.substring(0, 6)}`,
          timestamp: timestamp,
        });
        
        // F. Tax Collection Transaction
        const taxTransactionRef = db.collection("walletTransactions").doc();
        batch.set(taxTransactionRef, {
          userId: "tax_collected", // Special ID for tax liability
          orderId: orderId,
          type: "TAX",
          amount: taxAmount,
          description: `VAT (16%) for order #${orderId.substring(0, 6)}`,
          timestamp: timestamp,
        });
        
        // G. Seller Notification for the sale
        const sellerNotifRef = db.collection('notifications').doc();
        batch.set(sellerNotifRef, {
            userId: sellerId,
            type: 'order',
            title: 'Sale Completed & Funds Cleared',
            message: `Your sale of "${productName}" is complete. $${sellerNetEarnings.toFixed(2)} has been added to your wallet.`,
            link: `/dashboard/seller/earnings`,
            status: 'unread',
            timestamp: timestamp,
        });

        // H. Award referral points on first successful order
        const buyerProfileRef = db.doc(`userProfiles/${buyerId}`);
        const buyerProfileSnap = await buyerProfileRef.get();
        const buyerProfile = buyerProfileSnap.data() as UserProfile | undefined;
        
        if (buyerProfile && buyerProfile.referredBy && !buyerProfile.referralBonusAwarded) {
            const POINTS_PER_REFERRAL = 5;
            const referrerRef = db.doc(`userProfiles/${buyerProfile.referredBy}`);
            
            batch.update(referrerRef, { aiPoints: admin.firestore.FieldValue.increment(POINTS_PER_REFERRAL) });
            batch.update(buyerProfileRef, { referralBonusAwarded: true });

            const referrerNotifRef = db.collection('notifications').doc();
            batch.set(referrerNotifRef, {
                userId: buyerProfile.referredBy,
                type: 'commission',
                title: 'Referral Bonus!',
                message: `You earned ${POINTS_PER_REFERRAL} points because ${buyerProfile.fullName} made their first purchase!`,
                link: '/dashboard/reseller/referrals',
                status: 'unread',
                timestamp: timestamp,
            });
        }


        // --- Commit all transactions atomically ---
        await batch.commit();

        functions.logger.info(`Successfully processed all financial splits for delivered order ${orderId}`);
        return null;
      } catch (error) {
        functions.logger.error(`Error processing delivered order ${orderId}:`, error);
        // Optionally, log this error to a specific collection for monitoring
        await db.collection('errorLogs').add({
            message: `Failed to process order ${orderId}`,
            error: (error as Error).message,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            context: { function: 'processOrderAndDistributeEarnings', orderData: afterData }
        });
        return null;
      }
    });



/**
 * Sends a notification to a buyer when their order status changes.
 */
export const sendOrderUpdateNotification = functions.firestore
    .document("orders/{orderId}")
    .onUpdate(async (change, context) => {
        const beforeData = change.before.data();
        const afterData = change.after.data();
        const orderId = context.params.orderId;

        // Exit if status has not changed
        if (beforeData.orderStatus === afterData.orderStatus) {
            return null;
        }

        const userId = afterData.buyerId;
        const productName = afterData.productName || 'your order';
        const newStatus = afterData.orderStatus;

        let title = '';
        let message = '';

        switch (newStatus) {
            case 'processing':
                title = 'Order is Processing';
                message = `Your order for "${productName}" is now being processed by the seller.`;
                break;
            case 'shipped':
                title = 'Your Order Has Shipped!';
                message = `Great news! Your order for "${productName}" is on its way.`;
                break;
            case 'delivered':
                title = 'Order Delivered';
                message = `Your order for "${productName}" has been delivered. Please confirm receipt in your order history.`;
                break;
            default:
                // For other statuses like 'cancelled' or 'pending', we don't send a notification for now.
                return null;
        }

        const notification = {
            userId,
            type: 'order',
            title,
            message,
            link: `/buyer/my-orders`,
            status: 'unread',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        };

        try {
            await db.collection('notifications').add(notification);
            functions.logger.info(`Notification sent to user ${userId} for order ${orderId}`);
        } catch (error) {
            functions.logger.error(`Failed to send notification for order ${orderId}:`, error);
        }

        return null;
    });

/**
 * Securely processes a payout request when an admin approves it.
 * Triggered when a payout's status changes from 'pending' to 'processing'.
 */
export const processPayout = functions.firestore
    .document("payouts/{payoutId}")
    .onUpdate(async (change, context) => {
        const beforeData = change.before.data();
        const afterData = change.after.data();
        const { payoutId } = context.params;

        // --- Trigger Condition ---
        // Only run if status changes from 'pending' to 'processing'
        if (beforeData.status !== 'pending' || afterData.status !== 'processing') {
            functions.logger.log(`Payout ${payoutId} not ready for processing. Status: ${afterData.status}`);
            return null;
        }

        const { sellerId, amount, payoutMethodId, payoutMethodInfo } = afterData;

        // --- Validation ---
        if (!sellerId || !amount || !payoutMethodId) {
            functions.logger.error(`Payout ${payoutId} is missing critical data.`);
            await db.doc(`payouts/${payoutId}`).update({ status: 'failed', adminNotes: 'Missing critical payout data.' });
            return null;
        }
        
        try {
            functions.logger.info(`Processing payout ${payoutId} for seller ${sellerId} of amount ${amount}`);

            //
            // --- PAYMENT PROVIDER INTEGRATION ---
            // THIS IS WHERE YOU WOULD ADD YOUR PAYSTACK, PAYPAL, OR MPESA API CALLS
            //
            // 1. Fetch the seller's actual payout details securely from their profile
            //    const payoutMethodDoc = await db.doc(`userProfiles/${sellerId}/payoutMethods/${payoutMethodId}`).get();
            //    if (!payoutMethodDoc.exists) throw new Error('Payout method not found.');
            //    const methodDetails = payoutMethodDoc.data();
            //
            // 2. Call the payment provider's API with the details
            //    e.g., const paymentResult = await paystack.transfer.create({ amount: amount * 100, recipient: methodDetails.recipientCode });
            //
            // 3. Check the result from the payment provider
            //    if (!paymentResult.status) throw new Error(paymentResult.message);
            //
            
            // --- MOCK SUCCESS (for now) ---
            const mockTransactionId = `MOCK_TXN_${payoutId}`;
            functions.logger.warn(`THIS IS A MOCK PAYOUT FOR ${payoutId}. NO REAL MONEY WAS SENT.`);
            // --- END MOCK ---
            
            // On successful payment, update the payout document to 'completed'
            await db.doc(`payouts/${payoutId}`).update({
                status: 'completed',
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                transactionId: mockTransactionId, // The real ID from your payment provider
            });

            // Create a formal transaction record in the wallet ledger
            const walletTransactionRef = db.collection("walletTransactions").doc();
            await walletTransactionRef.set({
              userId: sellerId,
              orderId: payoutId, // Use payoutId as the source reference
              type: "PAYOUT_COMPLETED",
              amount: -amount, // Negative amount as it's a debit from their wallet
              description: `Payout to ${payoutMethodInfo}`,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

            functions.logger.info(`Successfully processed payout ${payoutId}.`);
            return null;

        } catch (error) {
            functions.logger.error(`Error processing payout ${payoutId}:`, error);
            await db.doc(`payouts/${payoutId}`).update({
                status: 'failed',
                adminNotes: `Processing failed: ${(error as Error).message}`
            });
            return null;
        }
    });
