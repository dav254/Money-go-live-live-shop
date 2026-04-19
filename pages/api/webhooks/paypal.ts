
// This file is deprecated to resolve routing conflicts with the App Router.
// The logic has been moved to /src/app/api/webhooks/paypal/route.ts
export const dynamic = 'force-dynamic';
export default function handler(req: any, res: any) {
  res.status(404).end();
}
