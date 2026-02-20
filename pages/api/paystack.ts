
import { NextApiRequest, NextApiResponse } from 'next';
import paystack from 'paystack';

paystack(process.env.PAYSTACK_SECRET_KEY as string);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { amount, email } = req.body;

    try {
      const transaction = await paystack.transaction.initialize({
        amount: amount * 100, // Paystack expects amount in kobo
        email,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/paystack`,
      });

      res.status(200).json({ authorization_url: transaction.data.authorization_url });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while initializing the transaction.' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed.' });
  }
}
