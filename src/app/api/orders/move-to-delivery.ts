
// This file is deprecated to resolve a routing conflict with src/app/api/orders/move-to-delivery/route.ts
// All logic has been moved to the App Router route handler.
export const dynamic = 'force-dynamic';
export async function GET() {
    return new Response('Deprecated', { status: 404 });
}
