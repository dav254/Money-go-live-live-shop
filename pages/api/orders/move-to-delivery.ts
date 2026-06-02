// Deprecated to resolve Next.js 15 build conflict.
// All order logic is now in App Router: src/app/api/orders/...
export default function handler(req: any, res: any) {
  res.status(410).json({ error: "Deprecated. Use App Router endpoint instead." });
}
