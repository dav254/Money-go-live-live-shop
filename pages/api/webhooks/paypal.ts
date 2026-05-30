
// This file is deprecated to resolve routing conflicts with the App Router.
// Logic moved to /src/app/api/webhooks/paypal/route.ts
export default function handler(req: any, res: any) {
  res.status(404).end();
}
