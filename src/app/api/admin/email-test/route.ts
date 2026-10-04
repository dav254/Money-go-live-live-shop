import { NextResponse, type NextRequest } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { sendTemplateEmail } from '@/lib/notifications/email-service';

export const runtime = 'nodejs';

/**
 * POST /api/admin/email-test — send one real email through the configured
 * provider so an admin can verify sender identity, domain and deliverability
 * without waiting for a customer action.
 *
 * Body: { to: string, templateKey?: string }
 */
export async function POST(request: NextRequest) {
  const user = await verifyUserContext(request);
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { to?: string; templateKey?: string };
  const to = (body.to ?? '').toString().trim().toLowerCase();
  if (!to || !to.includes('@')) {
    return NextResponse.json({ error: 'A valid recipient address is required.' }, { status: 400 });
  }

  const templateKey = body.templateKey || 'welcome';

  let result: { ok: boolean; status: string; provider?: string; error?: string };
  try {
    const sent = await sendTemplateEmail({
      templateKey,
      to,
      category: 'account',
      vars: { user_name: 'Admin test', app_url: process.env.APP_URL || '' },
    });
    result = { ok: sent.ok, status: sent.status, provider: sent.providerId, error: sent.error };
  } catch (error) {
    result = {
      ok: false,
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  return NextResponse.json({
    ok: result.ok,
    status: result.status,
    provider: result.provider ?? null,
    error: result.error ?? null,
    message: result.ok
      ? `Test email accepted by the provider${result.provider ? ` (${result.provider})` : ''}.`
      : `Delivery failed: ${result.error ?? 'unknown error'}`,
  });
}