
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

      const { sellerId, resellerId, totalAmount } = orderData;

      try {
        // 2. Fetch Product & User Details for Commission Rates
        // Assuming a simple flat-rate for now. This can be expanded.
        const platformFeeRate = 0.05; // 5% platform fee
        const resellerCommissionRate = resellerId ? 0.10 : 0; // 10% if reseller exists

        // 3. Calculate Earnings
        const resellerCommission = totalAmount * resellerCommissionRate;
        const platformFee = totalAmount * platformFeeRate;
        const sellerEarnings = totalAmount - resellerCommission - platformFee;

        const batch = db.batch();
        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        // 4. Create Seller Transaction
        const sellerTransactionRef = db.collection("walletTransactions").doc();
        batch.set(sellerTransactionRef, {
          userId: sellerId,
          date: timestamp,
          type: "SALE",
          amount: sellerEarnings,
          description: `Sale of order #${orderId}`,
          sourceId: orderId,
        });

        // 5. Create Reseller Transaction (if applicable)
        if (resellerId && resellerCommission > 0) {
          const resellerTransactionRef = db.collection("walletTransactions").doc();
          batch.set(resellerTransactionRef, {
            userId: resellerId,
            date: timestamp,
            type: "COMMISSION",
            amount: resellerCommission,
            description: `Commission for order #${orderId}`,
            sourceId: orderId,
          });
        }

        // 6. Create Platform Fee Transaction
        const platformTransactionRef = db.collection("walletTransactions").doc();
        batch.set(platformTransactionRef, {
          userId: "platform_revenue", // Special ID for platform earnings
          date: timestamp,
          type: "PLATFORM_FEE",
          amount: platformFee,
          description: `Platform fee for order #${orderId}`,
          sourceId: orderId,
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
