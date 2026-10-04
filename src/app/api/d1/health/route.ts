import { NextResponse } from 'next/server';
import { d1Configured, d1Query } from '@/lib/d1/client';

export const runtime = 'nodejs';

/**
 * GET /api/d1/health — setup check for the Cloudflare D1 connection.
 * 200 → keys present and database answers.
 * 503 → keys missing (not configured yet).
 * 502 → keys present but Cloudflare rejected the query.
 */
export async function GET() {
  if (!d1Configured()) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message:
          'Cloudflare D1 is not configured yet. Add CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN and D1_DATABASE_ID in Settings → Environment.',
      },
      { status: 503 },
    );
  }

  const startedAt = Date.now();
  try {
    const [result] = await d1Query<{ ok: number }>('SELECT 1 AS ok');
    return NextResponse.json({
      ok: true,
      configured: true,
      ping: result?.results?.[0]?.ok ?? null,
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error('[d1/health]', error);
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        message: error instanceof Error ? error.message : 'D1 query failed.',
      },
      { status: 502 },
    );
  }
}
