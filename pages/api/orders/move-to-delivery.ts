import { NextApiRequest, NextApiResponse } from 'next';

/**
 * DEPRECATED: This route has been moved to the App Router.
 * Next.js 15 requires unique routes between pages/ and app/ directories.
 * Use src/app/api/orders/move-to-delivery/route.ts instead.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    res.status(410).json({ 
        error: 'Gone', 
        message: 'This endpoint is deprecated. Use the App Router equivalent at /api/orders/move-to-delivery.' 
    });
}
