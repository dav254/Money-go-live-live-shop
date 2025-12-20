
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

/**
 * Processes a delivered order to distribute earnings and taxes automatically.
 * Triggered when an order's status is updated, specifically to 'delivered'.
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
        functions.logger.log(`Order ${orderId} status not changed to 'delivered'. Exiting function.`);
        return null;
      }

      // --- Basic Validation ---
      if (!afterData || !afterData.sellerId || !afterData.productPrice) {
        functions.logger.error("Order missing critical data (sellerId, productPrice)", { orderId });
        return null;
      }

      const { sellerId, resellerId, productPrice, shippingCost, commissionRate } = afterData;
      
      try {
        // --- Define Rates (can be moved to Firestore config later) ---
        const VAT_RATE = 0.16; // 16%
        const PLATFORM_FEE_RATE = 0.10; // 10%

        // --- Calculate All Financial Splits ---
        const taxAmount = productPrice * VAT_RATE;
        const platformFee = productPrice * PLATFORM_FEE_RATE;
        let resellerCommission = 0;
        if (resellerId && commissionRate) {
            resellerCommission = productPrice * (commissionRate / 100);
        }
        const sellerNetEarnings = productPrice - platformFee - resellerCommission;

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
        const sellerShippingRef = db.collection("walletTransactions").doc();
        batch.set(sellerShippingRef, {
            userId: sellerId,
            orderId: orderId,
            type: "SHIPPING_FEE",
            amount: shippingCost || 0,
            description: `Shipping reimbursement for order #${orderId.substring(0, 6)}`,
            timestamp: timestamp,
        });

        // C. Reseller's Commission Transaction (if applicable)
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
        }

        // D. Platform Fee Transaction
        const platformTransactionRef = db.collection("walletTransactions").doc();
        batch.set(platformTransactionRef, {
          userId: "platform_revenue",
          orderId: orderId,
          type: "PLATFORM_FEE",
          amount: platformFee,
          description: `Platform fee for order #${orderId.substring(0, 6)}`,
          timestamp: timestamp,
        });
        
        // E. Tax Collection Transaction
        const taxTransactionRef = db.collection("walletTransactions").doc();
        batch.set(taxTransactionRef, {
          userId: "tax_collected", // Special ID for tax liability
          orderId: orderId,
          type: "TAX",
          amount: taxAmount,
          description: `VAT (16%) for order #${orderId.substring(0, 6)}`,
          timestamp: timestamp,
        });

        // --- Commit all transactions atomically ---
        await batch.commit();

        functions.logger.info(`Successfully processed all financial splits for delivered order ${orderId}`);
        return null;
      } catch (error) {
        functions.logger.error(`Error processing delivered order ${orderId}:`, error);
        return null;
      }
    });

