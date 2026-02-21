// This route has been moved to /src/app/api/webhooks/paypal/route.ts to avoid conflicts in Next.js 15.
export const dynamic = 'force-dynamic';
export default function handler(req: any, res: any) {
  res.status(404).end();
}
