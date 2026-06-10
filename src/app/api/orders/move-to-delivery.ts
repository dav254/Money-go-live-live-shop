// This file is permanently cleared to resolve naming conflicts with App Router directories.
// The active endpoint is located at src/app/api/orders/move-to-delivery/route.ts
export const dynamic = 'force-dynamic';
export async function GET() {
    return new Response('Conflict Resolved. Use /api/orders/move-to-delivery route.', { status: 410 });
}