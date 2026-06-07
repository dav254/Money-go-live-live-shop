// This file is deprecated to resolve Next.js 15 build conflicts.
// The primary route is now located at src/app/api/orders/move-to-delivery/route.ts
export const dynamic = 'force-dynamic';
export async function GET() {
    return new Response('Deprecated. Use App Router endpoint.', { status: 410 });
}
