
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

/**
 * Processes a new order to distribute earnings and taxes automatically.
 * Triggered when a new document is created in the 'orders' collection.
 */
export const processOrderAndDistributeEarnings = functions.firestore
    .document("orders/{orderId}")
    .onCreate(async (snap, context) => {
      const orderData = snap.data();
      const { orderId } = context.params;

      // 1. --- Basic Validation ---
      if (!orderData || !orderData.sellerId || !orderData.productPrice) {
        functions.logger.error("Order missing critical data (sellerId, productPrice)", { orderId });
        return null;
      }

      const { sellerId, resellerId, productPrice, shippingCost, commissionRate } = orderData;
      
      try {
        // 2. --- Define Rates (can be moved to Firestore config later) ---
        const VAT_RATE = 0.16; // 16%
        const PLATFORM_FEE_RATE = 0.10; // 10%

        // 3. --- Calculate All Financial Splits ---
        // Tax is calculated on the product price, not including shipping.
        const taxAmount = productPrice * VAT_RATE;

        // Platform fee is calculated on the pre-tax product price.
        const platformFee = productPrice * PLATFORM_FEE_RATE;

        // Reseller commission is also based on the pre-tax product price.
        let resellerCommission = 0;
        if (resellerId && commissionRate) {
            resellerCommission = productPrice * (commissionRate / 100);
        }

        // Seller's net earning is the product price minus all deductions. They keep the full shipping fee.
        const sellerNetEarnings = productPrice - platformFee - resellerCommission;

        const batch = db.batch();
        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        // 4. --- Create Transaction Records for Each Party ---

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

        // 5. --- Commit all transactions atomically ---
        await batch.commit();

        functions.logger.info(`Successfully processed all financial splits for order ${orderId}`);
        return null;
      } catch (error) {
        functions.logger.error(`Error processing order ${orderId}:`, error);
        // Optionally, add error handling like sending a notification
        return null;
      }
    });

