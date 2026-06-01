
// This file is deprecated to resolve routing conflicts with the App Router in Next.js 15.
// The logic has been moved to /src/app/api/orders/move-to-delivery/route.ts
export default function handler(req: any, res: any) {
  res.status(404).json({ error: 'Route moved to App Router' });
}
