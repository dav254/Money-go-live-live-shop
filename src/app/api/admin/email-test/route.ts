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

  let result: {
    ok: boolean;
    status: string;
    provider?: string;
    error?: string;
    errorClass?: string;
    devCaptured?: boolean;
    skippedDuplicate?: boolean;
  };
  try {
    const sent = await sendTemplateEmail({
      templateKey,
      to,
      category: 'account',
      vars: { user_name: 'Admin test', app_url: process.env.APP_URL || '' },
      // A test must never be blocked by the duplicate cooldown — it is an
      // explicit, human-triggered diagnostic — and a test failure must never
      // queue a retry either.
      ignoreCooldown: true,
      enqueueRetry: false,
    });
    result = {
      ok: sent.ok,
      status: sent.status,
      provider: sent.providerId,
      error: sent.error,
      errorClass: sent.errorClass,
      devCaptured: sent.devCaptured,
      skippedDuplicate: sent.skippedDuplicate,
    };
  } catch (error) {
    result = {
      ok: false,
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Honest messages: capture ≠ send ≠ delivered.
  const message = result.skippedDuplicate
    ? 'Skipped: this recipient received the same template moments ago (duplicate cooldown). Nothing was sent again.'
    : result.ok && result.devCaptured
      ? 'Captured to the development mailbox — EMAIL_MODE is not production, so nothing actually left the server.'
      : result.ok
        ? `Test email accepted by the provider${result.provider ? ` (${result.provider})` : ''}. Delivery is confirmed only by the provider webhook.`
        : `Delivery failed${result.errorClass ? ` [${result.errorClass}]` : ''}: ${result.error ?? 'unknown error'}`;

  return NextResponse.json({
    ok: result.ok,
    status: result.status,
    provider: result.provider ?? null,
    error: result.error ?? null,
    errorClass: result.errorClass ?? null,
    message,
  });
}