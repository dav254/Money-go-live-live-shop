import { NextResponse } from 'next/server';

/**
 * DEPRECATED: This route was using an incompatible auth provider (NextAuth).
 * All authentication is handled by Firebase.
 */
export async function GET() {
    return NextResponse.json({ message: 'Route Deprecated.' }, { status: 410 });
}
