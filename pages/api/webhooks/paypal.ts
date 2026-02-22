// Deprecated: Consolidated into App Router at src/app/api/webhooks/paypal/route.ts
export default function handler(req: any, res: any) {
  res.status(404).json({ message: 'Moved to App Router' });
}
