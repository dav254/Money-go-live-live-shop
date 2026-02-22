
// This legacy route is disabled to prevent conflicts with App Router.
export default function handler(req: any, res: any) {
  res.status(404).json({ message: 'Moved to /api/orders/move-to-delivery' });
}
