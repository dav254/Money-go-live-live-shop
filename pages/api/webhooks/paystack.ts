// This route has been moved to /src/app/api/webhooks/paystack/route.ts
// Content removed to avoid duplicate route conflicts in Next.js 15.
export const dynamic = 'force-dynamic';
export default function handler(req: any, res: any) {
  res.status(404).end();
}
