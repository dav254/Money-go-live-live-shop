/**
 * DEPRECATED: This route has been moved to src/app/api/webhooks/paystack/route.ts
 * to comply with Next.js 15 App Router requirements and avoid duplicate page conflicts.
 */
export default function handler(req: any, res: any) {
  res.status(404).json({ message: "This endpoint has moved to /src/app/api/webhooks/paystack/route.ts" });
}
