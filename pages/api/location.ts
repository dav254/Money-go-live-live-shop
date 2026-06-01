// Deprecated to resolve Next.js 15 build conflict.
// Logic moved to src/lib/location-detection.ts
export default function handler(req: any, res: any) {
  res.status(410).json({ error: "Deprecated." });
}
