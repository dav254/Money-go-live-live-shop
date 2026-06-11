/**
 * DEPRECATED: Collides with App Router directory. 
 * Logic moved to src/app/api/orders/move-to-delivery/route.ts
 */
export const dynamic = 'force-dynamic';
export async function GET() {
    return new Response(null, { status: 410 });
}
