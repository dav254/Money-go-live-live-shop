/**
 * GET /api/orbit/marketplace?days=30 — aggregate-only marketplace view.
 *
 * Seller shops, listings, requests, offers and orders are COUNTS. Exposure,
 * visits, enquiries and revenue come from the existing growth funnel. No
 * buyer identity, message, address or payment reference is ever included.
 */
import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { readMarketplaceSummary } from '@/lib/ai-headquarters/aggregates';
import { authorizeOrbitRequest, orbitErrorResponse } from '@/lib/ai-headquarters/orbit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await authorizeOrbitRequest(request, db, 'marketplace:read');
    const raw = new URL(request.url).searchParams.get('days');
    const days = Number(raw ?? '30');
    const summary = await readMarketplaceSummary(db, Number.isFinite(days) ? days : 30);

    return NextResponse.json({
      ...summary,
      privacy: 'Aggregates only. No customer, seller or payment identifiers are exposed.',
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return orbitErrorResponse(error);
  }
}
