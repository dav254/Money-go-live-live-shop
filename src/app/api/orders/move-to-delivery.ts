
// This file is disabled because it conflicts with the /route.ts in the same directory.
// Consolidation into src/app/api/orders/move-to-delivery/route.ts is complete.
export const dynamic = 'force-dynamic';
export async function GET() {
    return new Response('Conflict resolved', { status: 404 });
}
