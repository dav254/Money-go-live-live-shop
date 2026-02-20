import { NextApiRequest, NextApiResponse } from 'next';
import { db, bucket } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import formidable from 'formidable';
import fs from 'fs';

// Disable the default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

function formidablePromise(
  req: NextApiRequest,
): Promise<{ fields: formidable.Fields; files: formidable.Files }> {
  return new Promise((resolve, reject) => {
    const form = formidable({});
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fields, files } = await formidablePromise(req);
    const orderId = Array.isArray(fields.orderId) ? fields.orderId[0] : fields.orderId;
    const proofFile = Array.isArray(files.proof) ? files.proof[0] : files.proof;

    if (!orderId) return res.status(400).json({ error: "Order ID required" });

    const orderRef = db.doc(`orders/${orderId}`);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) return res.status(404).json({ error: 'Order not found' });

    let proofUrl = null;
    if (proofFile) {
        const filename = `delivery_proofs/${orderId}_${Date.now()}.png`;
        const file = bucket.file(filename);
        await bucket.upload(proofFile.filepath, {
            destination: filename,
            metadata: { contentType: proofFile.mimetype }
        });
        proofUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media`;
    }

    await orderRef.update({
      orderStatus: 'delivered',
      buyerConfirmed: true,
      deliveredAt: FieldValue.serverTimestamp(),
      deliveryProof: proofUrl,
    });
    
    res.status(200).json({ success: true, proofUrl });

  } catch (error) {
    console.error("Confirm delivery error:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
