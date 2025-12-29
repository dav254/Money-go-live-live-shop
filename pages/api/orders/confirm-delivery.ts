import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import formidable from 'formidable';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
    const { fields, files } = await formidablePromise(req);
    const orderId = Array.isArray(fields.orderId) ? fields.orderId[0] : fields.orderId;
    const proofFile = Array.isArray(files.proof) ? files.proof[0] : files.proof;

    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required." });
    }

    const orderRef = db.doc(`orders/${orderId}`);
    const orderDoc = await orderRef.get();
    const orderData = orderDoc.data();

    if (!orderData) {
      return res.status(404).json({ error: 'Order not found' });
    }

    let proofUrl = null;
    if (proofFile) {
        const uploadResponse = await cloudinary.uploader.upload(proofFile.filepath, {
            folder: 'delivery_proofs',
            public_id: orderId,
        });
        proofUrl = uploadResponse.secure_url;
    }

    await orderRef.update({
      orderStatus: 'delivered',
      buyerConfirmed: true,
      deliveredAt: FieldValue.serverTimestamp(),
      deliveryProof: proofUrl,
    });
    
    // Auto log to chat (optional)
    const { buyerId, sellerId } = orderData;
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
      const messagesRef = db.collection('chats').doc(existingChatId).collection('messages');
      await messagesRef.add({
        senderId: 'system',
        text: 'Buyer confirmed item delivery ✅',
        timestamp: FieldValue.serverTimestamp(),
      });
    }

    res.status(200).json({ success: true, proofUrl });

  } catch (error) {
    console.error("A runtime error occurred in confirm-delivery API:", error);
    res.status(500).json({ error: 'Internal server error. Check server logs for details.' });
  }
}
