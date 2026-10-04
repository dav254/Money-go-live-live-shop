import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import { getAiSettings, saveAiSettings, type AiSettings } from '@/lib/ai/config';

export const runtime = 'nodejs';

/**
 * GET  /api/admin/ai-settings → current pricing/providers/limits (§31)
 * PUT  /api/admin/ai-settings → admin saves configuration (§12)
 *
 * Provider API secrets are never returned or accepted here — they live
 * only in server-side env vars (spec §33).
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdminUid(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const settings = await getAiSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdminUid(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await request.json()) as Partial<AiSettings>;
    const saved = await saveAiSettings({
      pricing: body.pricing,
      activeProviders: body.activeProviders,
      freeTrialGenerations: body.freeTrialGenerations,
      refundOnFailure: body.refundOnFailure,
      maxUploadMb: body.maxUploadMb,
    });
    return NextResponse.json({ settings: saved });
  } catch (error) {
    console.error('[admin/ai-settings]', error);
    return NextResponse.json({ error: 'Failed to save settings.' }, { status: 500 });
  }
}
