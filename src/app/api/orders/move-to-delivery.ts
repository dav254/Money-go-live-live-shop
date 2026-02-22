// This file is disabled to resolve a routing conflict with the App Router directory.
export const dynamic = 'force-dynamic';
export async function GET() {
    return new Response('Route moved to src/app/api/orders/move-to-delivery/route.ts', { status: 404 });
}
