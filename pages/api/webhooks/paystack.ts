
import { NextApiRequest, NextApiResponse } from 'next';
import paystack from 'paystack';

paystack(process.env.PAYSTACK_SECRET_KEY as string);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { trxref } = req.query;

    if (!trxref) {
      return res.status(400).json({ error: 'Transaction reference not found.' });
    }

    try {
      const verification = await paystack.transaction.verify(trxref as string);

      if (verification.data.status === 'success') {
        // TODO: Update order status in the database
        res.status(200).json({ message: 'Payment successful.' });
      } else {
        res.status(400).json({ error: 'Payment not successful.' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while verifying the transaction.' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed.' });
  }
}
