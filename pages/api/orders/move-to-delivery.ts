// Deprecated to resolve Next.js 15 build conflict.
// Logic has been moved to src/app/api/orders/move-to-delivery/route.ts
export default function handler(req: any, res: any) {
  res.status(410).json({ error: "Route Deprecated. Use App Router equivalent instead." });
}
