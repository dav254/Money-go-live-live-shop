/**
 * DEPRECATED: This route has been moved to src/app/api/webhooks/paystack/route.ts
 * to comply with Next.js 15 App Router requirements and avoid duplicate page conflicts.
 * The file is kept as a stub to prevent build-time deletions issues if applicable,
 * but contains no logic to avoid routing overlaps.
 */
export default function handler(req: any, res: any) {
  res.status(404).json({ message: "This endpoint has moved to /src/app/api/webhooks/paystack/route.ts" });
}
