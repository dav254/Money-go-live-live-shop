
// This route has been disabled to avoid conflicts with Next.js 15 App Router.
// The logic now resides in /src/app/api/webhooks/paystack/route.ts
export const dynamic = 'force-dynamic';
export default function handler(req: any, res: any) {
  res.status(404).end();
}
