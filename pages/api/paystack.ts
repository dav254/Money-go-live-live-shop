// Deprecated to resolve Next.js 15 build conflict.
// Logic moved to src/app/api/webhooks/paystack/route.ts
export default function handler(req: any, res: any) {
  res.status(410).json({ error: "Deprecated. Use App Router endpoint instead." });
}
