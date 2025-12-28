
import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import formidable from 'formidable';

// Disable the default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

// --- Helper function to parse form data ---
function formidablePromise(
  req: NextApiRequest,
): Promise<{ fields: formidable.Fields; files: formidable.Files }> {
  return new Promise((resolve, reject) => {
    const form = formidable({});
    form.parse(req, (err, fields, files) => {
      if (err) {
        return reject(err);
      }
      resolve({ fields, files });
    });
  });
}

// --- Main API Handler ---
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log("API route started. Parsing form data...");
    const { fields } = await formidablePromise(req);

    const orderId = Array.isArray(fields.orderId) ? fields.orderId[0] : fields.orderId;

    if (!orderId) {
      console.error("Order ID is missing from the request.");
      return res.status(400).json({ error: "Order ID is required." });
    }
    console.log(`Processing confirmation for order ID: ${orderId}`);

    console.log("Updating Firestore document...");
    const orderRef = db.doc(`orders/${orderId}`);
    const orderDoc = await orderRef.get();
    const orderData = orderDoc.data();

    if (!orderData) {
      console.error(`Order not found for ID: ${orderId}`);
      return res.status(404).json({ error: 'Order not found' });
    }
    console.log("Order found. Proceeding with update.");

    await orderRef.update({
      orderStatus: 'delivered',
      buyerConfirmed: true,
      deliveredAt: FieldValue.serverTimestamp(),
      deliveryProof: null, // Proof is disabled for now
    });
    console.log("Firestore document updated successfully.");

    // Auto log to chat (optional)
    const { buyerId, sellerId } = orderData;
    console.log(`Logging to chat for buyer: ${buyerId} and seller: ${sellerId}`);
    const chatsRef = db.collection('chats');
    const q = chatsRef.where('participantIds', 'array-contains', buyerId);

    const querySnapshot = await q.get();
    let existingChatId: string | null = null;
    querySnapshot.forEach(doc => {
      if (doc.data().participantIds.includes(sellerId)) {
        existingChatId = doc.id;
      }
    });

    if (existingChatId) {
      console.log(`Found existing chat ID: ${existingChatId}. Adding system message.`);
      const messagesRef = db.collection('chats').doc(existingChatId).collection('messages');
      await messagesRef.add({
        senderId: 'system',
        text: 'Buyer confirmed item delivery ✅',
        timestamp: FieldValue.serverTimestamp(),
      });
      console.log("System message added to chat.");
    } else {
      console.log("No existing chat found between buyer and seller.");
    }

    console.log("API route finished successfully.");
    res.status(200).json({ success: true });

  } catch (error) {
    console.error("!!! TOP-LEVEL API ERROR !!!");
    console.error("A runtime error occurred in confirm-delivery API:", error);
    res.status(500).json({ error: 'Internal server error. Check server logs for details.' });
  }
}
