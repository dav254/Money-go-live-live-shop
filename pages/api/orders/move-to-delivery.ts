import { NextApiRequest, NextApiResponse } from 'next';

/**
 * DEPRECATED: This route has been moved to src/app/api/orders/move-to-delivery/route.ts
 * to comply with Next.js 15 App Router standards.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(410).json({ 
    error: 'API Endpoint Moved', 
    message: 'This endpoint is deprecated. Use the App Router equivalent instead.' 
  });
}
