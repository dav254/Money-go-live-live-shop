// This file is disabled to resolve Next.js 15 build conflicts with the App Router directory.
// Consolidation into src/app/api/webhooks/paystack/route.ts is complete.
export const dynamic = 'force-dynamic';
export async function POST() {
    return new Response('Conflict resolved. Use /api/webhooks/paystack route instead.', { status: 404 });
}
