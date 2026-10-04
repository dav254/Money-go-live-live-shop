import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server';
import { EMAIL_TEMPLATES } from '@/lib/notifications';
import { getVidnovConfig } from '@/lib/notifications';

export const runtime = 'nodejs';

/**
 * GET /api/admin/communication?box=email-logs|dev-mailbox
 *      &status=&limit=   — returns recent delivery records (metadata only;
 *      bodies are intentionally not exposed to ordinary admins).
 * GET /api/admin/communication?box=templates — template catalog + config.
 */
export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) {
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const box = url.searchParams.get('box') ?? 'email-logs';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  const status = url.searchParams.get('status');

  if (box === 'templates') {
    const cfg = getVidnovConfig();
    return NextResponse.json({
      ok: true,
      templates: EMAIL_TEMPLATES.map(t => ({ key: t.key, subject: t.subject, category: t.category, vars: t.vars })),
      config: {
        appUrl: cfg.appUrl,
        emailMode: cfg.emailMode,
        emailProvider: cfg.emailProvider || 'console (dev)',
        emailFrom: cfg.emailFrom,
        addresses: cfg.mailAddresses,
      },
    });
  }

  if (box === 'dev-mailbox') {
    const snap = await db
      .collection('devMailbox')
      .orderBy('capturedAt', 'desc')
      .limit(limit)
      .get();
    return NextResponse.json({
      ok: true,
      messages: snap.docs.map(d => {
        const m = d.data() as Record<string, any>;
        return {
          id: d.id,
          to: m.to, from: m.from, subject: m.subject,
          templateKey: m.templateKey, category: m.category,
          capturedAt: m.capturedAt?.toDate?.().toISOString?.() ?? null,
          text: typeof m.text === 'string' ? m.text.slice(0, 2000) : '',
        };
      }),
    });
  }

  // Default: delivery logs
  let q: any = db.collection('emailLogs').orderBy('createdAt', 'desc').limit(limit);
  if (status) q = db.collection('emailLogs').where('status', '==', status).orderBy('createdAt', 'desc').limit(limit);
  const snap = await q.get();

  return NextResponse.json({
    ok: true,
    logs: snap.docs.map((d: { id: string; data: () => Record<string, any> }) => {
      const l = d.data();
      return {
        id: d.id,
        to: l.to, from: l.from, subject: l.subject,
        template: l.template, category: l.category,
        status: l.status, provider: l.provider, providerId: l.providerId,
        failureReason: l.failureReason ?? null,
        createdAt: l.createdAt?.toDate?.().toISOString?.() ?? null,
        devMode: l.devMode ?? false,
      };
    }),
  });
}
