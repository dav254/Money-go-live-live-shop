// This file is disabled to resolve Next.js 15 build conflicts with the App Router directory.
// Consolidation into src/app/api/orders/move-to-delivery/route.ts is complete.
export const dynamic = 'force-dynamic';
export async function GET() {
    return new Response('Conflict resolved. Use /api/orders/move-to-delivery route instead.', { status: 404 });
}
