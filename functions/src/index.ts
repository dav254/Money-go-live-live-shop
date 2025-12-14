
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

/**
 * Processes a new order to distribute earnings to the seller, reseller (if any),
 * and the platform. It creates detailed transaction records for each party.
 */
export const processOrderAndDistributeEarnings = functions.firestore
    .document("orders/{orderId}")
    .onCreate(async (snap, context) => {
      const orderData = snap.data();
      const { orderId } = context.params;

      // 1. Basic Validation
      if (!orderData || !orderData.sellerId || !orderData.totalAmount) {
        functions.logger.error("Order missing critical data", { orderId });
        return null;
      }

      const { sellerId, resellerId, totalAmount, productPrice, commissionRate } = orderData;
      
      try {
        // 2. Calculate Fees & Commissions
        const platformFeeRate = 0.10; // 10% platform fee
        const platformFee = productPrice * platformFeeRate;

        let resellerCommission = 0;
        if (resellerId && commissionRate) {
            // Commission is based on product price, not total amount with shipping
            resellerCommission = productPrice * (commissionRate / 100);
        }

        // 3. Calculate Net Seller Earnings
        const sellerEarnings = productPrice - platformFee - resellerCommission;

        const batch = db.batch();
        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        // 4. Create Seller Wallet Transaction
        const sellerTransactionRef = db.collection("walletTransactions").doc();
        batch.set(sellerTransactionRef, {
          userId: sellerId,
          orderId: orderId,
          type: "SALE_EARNING",
          amount: sellerEarnings,
          description: `Earnings from order #${orderId.substring(0, 6)}`,
          timestamp: timestamp,
        });

        // 5. Create Reseller Wallet Transaction (if applicable)
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

        // 6. Create Platform Fee Transaction
        const platformTransactionRef = db.collection("walletTransactions").doc();
        batch.set(platformTransactionRef, {
          userId: "platform_revenue", // Special ID for platform earnings
          orderId: orderId,
          type: "PLATFORM_FEE",
          amount: platformFee,
          description: `Platform fee for order #${orderId.substring(0, 6)}`,
          timestamp: timestamp,
        });

        // 7. Commit all transactions at once
        await batch.commit();

        functions.logger.info(`Successfully processed earnings for order ${orderId}`);
        return null;
      } catch (error) {
        functions.logger.error(`Error processing order ${orderId}:`, error);
        // Optionally, add error handling like sending a notification
        return null;
      }
    });
