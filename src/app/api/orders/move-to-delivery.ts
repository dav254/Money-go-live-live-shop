/**
<<<<<<< HEAD
 * DEPRECATED: Collides with App Router directory. 
 * Logic moved to src/app/api/orders/move-to-delivery/route.ts
 */
export const dynamic = 'force-dynamic';
export async function GET() {
    return new Response(null, { status: 410 });
}
=======
 * DEPRECATED: This file was causing a naming conflict with the move-to-delivery/ folder.
 * The active endpoint is located at src/app/api/orders/move-to-delivery/route.ts
 * This file is now a non-routing module to satisfy the build system.
 */
export const DEPRECATED_ROUTE = true;
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
