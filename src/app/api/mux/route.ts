import { NextResponse } from 'next/server';

/**
 * Mux integration is currently inactive.
 * This route is preserved as a placeholder to prevent build errors.
 */
export async function GET() {
    return NextResponse.json({ message: 'Mux service is currently disabled.' }, { status: 410 });
}
