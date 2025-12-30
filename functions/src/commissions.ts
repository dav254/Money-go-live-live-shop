
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Order, Product, ResellActivity } from './types'; // Assuming types are defined for your data structures

/**
 * Cloud Function that triggers when a new order is created.
 *
 * This function checks if the order was facilitated by a reseller. If so, it calculates
 * the commission earned by the reseller and the net amount for the seller for each
 * product in the order. It then creates a new document in the `resellActivities`
 * collection to serve as a permanent, immutable ledger record of the transaction.
 *
 * This provides a transparent and authoritative source of truth for all reseller-driven sales.
 */
export const recordCommissionOnOrder = functions.firestore
  .document('orders/{orderId}')
  .onCreate(async (snap, context) => {
    const db = admin.firestore();
    const order = snap.data() as Order;
    const { orderId } = context.params;

    // 1. Check if the order has a reseller. If not, there's nothing to do.
    if (!order.resellerId) {
      console.log(`Order ${orderId} has no reseller. No commission to record.`);
      return null;
    }

    // 2. Iterate through each item in the order to calculate commission.
    for (const item of order.items) {
      const productRef = db.collection('products').doc(item.productId);
      const productSnap = await productRef.get();

      if (!productSnap.exists) {
        console.error(`Product ${item.productId} in order ${orderId} not found. Skipping commission calculation.`);
        continue;
      }

      const product = productSnap.data() as Product;

      // 3. Ensure the product is actually resellable and has a commission rate.
      if (!product.isResellable || !product.commissionRate || product.commissionRate <= 0) {
        console.log(`Product ${item.productId} is not set up for reselling. No commission recorded.`);
        continue;
      }

      // 4. Calculate the earnings.
      const productPrice = item.price; // Use the price from the order item for accuracy at time of sale.
      const commissionRate = product.commissionRate / 100;
      const resellerEarns = productPrice * commissionRate * item.quantity;
      const sellerGets = (productPrice * item.quantity) - resellerEarns;

      // 5. Create the immutable ledger entry in `resellActivities`.
      const activityId = `${orderId}_${item.productId}`;
      const resellActivityRef = db.collection('resellActivities').doc(activityId);

      const newActivity: ResellActivity = {
        id: activityId,
        orderId: orderId,
        productId: item.productId,
        productName: item.name,
        resellerId: order.resellerId,
        sellerId: order.sellerId,
        buyerId: order.buyerId,
        quantity: item.quantity,
        pricePerUnit: item.price,
        commissionRate: product.commissionRate,
        resellerEarns: resellerEarns,
        sellerGets: sellerGets,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        type: 'sale',
      };

      try {
        await resellActivityRef.set(newActivity);
        console.log(`Successfully recorded commission for product ${item.productId} in order ${orderId}. Reseller earns: ${resellerEarns}`);
      } catch (error) {
        console.error(`Failed to create resellActivity record for order ${orderId}.`, error);
      }
    }

    return null;
  });
