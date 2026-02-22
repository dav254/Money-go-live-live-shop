
// This file is deprecated to resolve a routing conflict with src/app/api/orders/move-to-delivery/route.ts
// Next.js 15 does not allow both a file and a directory-based route for the same endpoint.
export const dynamic = 'force-dynamic';
export async function GET() {
    return new Response('Route moved to App Router directory.', { status: 404 });
}
