import { NextResponse, type NextRequest } from 'next/server';
import { verifyUserContext } from '@/lib/notifications/server-utils';
import { getVidnovConfig } from '@/lib/notifications/config';
import { db } from '@/firebase/server';
import { EMAIL_TEMPLATES } from '@/lib/notifications/templates';

export const runtime = 'nodejs';

/**
 * GET /api/admin/email-status — what the email system looks like right now.
 *
 * Returns CONFIGURATION ONLY (provider id, sender address, mode) plus which
 * required env keys are present. Secret values (the API key) are never sent to
 * the browser — only true/false per key. In development mode it also returns
 * the last captured messages so an admin can confirm the templates render.
 */
export async function GET(_request: NextRequest) {
  const user = await verifyUserContext(_request);
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const cfg = getVidnovConfig();

  const requiredKeys = [
    { key: 'EMAIL_MODE', set: Boolean((process.env.EMAIL_MODE ?? '').trim()) },
    { key: 'EMAIL_FROM', set: Boolean((process.env.EMAIL_FROM ?? '').trim()) },
    { key: 'EMAIL_PROVIDER', set: Boolean((process.env.EMAIL_PROVIDER ?? '').trim()) },
    { key: 'EMAIL_API_KEY', set: Boolean((process.env.EMAIL_API_KEY ?? '').trim()) },
    { key: 'APP_URL', set: Boolean((process.env.APP_URL ?? '').trim()) },
  ];

  let captured: { id: string; to: string; subject: string; createdAt: unknown }[] = [];
  if (cfg.emailMode === 'development') {
    const snap = await db
      .collection('devMailbox')
      .orderBy('createdAt', 'desc')
      .limit(15)
      .get()
      .catch(() => null);
    captured = (snap?.docs ?? []).map((d) => {
      const data = d.data() as { to?: string; subject?: string; createdAt?: unknown };
      const created = data.createdAt as { toDate?: () => Date } | Date | undefined;
      return {
        id: d.id,
        to: data.to ?? '—',
        subject: data.subject ?? '(no subject)',
        createdAt: created instanceof Date ? created.toISOString() : created?.toDate?.().toISOString() ?? null,
      };
    });
  }

  return NextResponse.json({
    mode: cfg.emailMode,
    provider: cfg.emailProvider || null,
    delivering: cfg.emailMode === 'production' && Boolean(cfg.emailApiKey) && Boolean(cfg.emailProvider),
    from: cfg.emailFrom,
    replyTo: cfg.emailReplyTo,
    appUrl: cfg.appUrl,
    mailboxes: cfg.mailAddresses,
    requiredKeys,
    templates: EMAIL_TEMPLATES.map((t) => ({ key: t.key, subject: t.subject, category: t.category })),
    captured,
  });
}