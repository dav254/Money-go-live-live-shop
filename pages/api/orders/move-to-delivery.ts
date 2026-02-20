import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * API route to transition an order to the 'delivery' status.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { orderId, courierName, dispatchNote } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    const orderRef = db.doc(`orders/${orderId}`);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await orderRef.update({
      orderStatus: 'delivery',
      courierName: courierName || null,
      dispatchNote: dispatchNote || null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Move to delivery error:", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
