// This file is disabled to resolve Next.js 15 build conflicts with the App Router directory.
export const dynamic = 'force-dynamic';
export async function POST() {
    return new Response('Conflict resolved. Use /api/webhooks/paypal route instead.', { status: 404 });
}
