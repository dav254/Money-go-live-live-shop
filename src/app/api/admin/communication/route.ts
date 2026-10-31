import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server';
import { EMAIL_TEMPLATES } from '@/lib/notifications';
import { getVidnovConfig } from '@/lib/notifications';
import { pbListDevMailbox, pbListEmailLogs } from '@/lib/pocketbase/email-logs';
import {
  listSuppressions,
  listWebhookEvents,
  unsuppressAddress,
  type StoreDb,
} from '@/lib/notifications/email-store';

export const runtime = 'nodejs';

/**
 * GET /api/admin/communication?box=email-logs|dev-mailbox
 *      &status=&limit=&page=  — delivery records (metadata only; bodies are
 *      intentionally not exposed to ordinary admins). `page` paginates.
 * GET /api/admin/communication?box=templates — template catalog + config.
 * GET /api/admin/communication?box=suppressions — hard-bounce suppression list.
 * GET /api/admin/communication?box=webhook-events — recent delivery events.
 * POST { action: 'unsuppress', address } — remove one suppression entry.
 */
export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) {
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const box = url.searchParams.get('box') ?? 'email-logs';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  const page = Math.max(0, Math.floor(Number(url.searchParams.get('page') ?? 0)) || 0);
  const status = url.searchParams.get('status');

  if (box === 'suppressions') {
    const rows = await listSuppressions(db as unknown as StoreDb, limit);
    return NextResponse.json({ ok: true, suppressions: rows });
  }

  if (box === 'webhook-events') {
    const rows = await listWebhookEvents(db as unknown as StoreDb, limit);
    return NextResponse.json({ ok: true, events: rows });
  }

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
    // Self-hosting migration: PocketBase first, Firestore fallback.
    const pbMessages = await pbListDevMailbox(limit);
    if (pbMessages) return NextResponse.json({ ok: true, messages: pbMessages });
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

  // Default: delivery logs — PocketBase first, Firestore fallback.
  const pbLogs = await pbListEmailLogs(Math.min(200, limit * (page + 1)), status);
  if (pbLogs) {
    const start = page * limit;
    return NextResponse.json({
      ok: true,
      page,
      logs: pbLogs.slice(start, start + limit),
    });
  }

  let q: any = db.collection('emailLogs').limit(limit);
  if (status) q = q.where('status', '==', status);
  q = q.orderBy('createdAt', 'desc').offset(page * limit);
  const snap = await q.get();

  return NextResponse.json({
    ok: true,
    page,
    logs: snap.docs.map((d: { id: string; data: () => Record<string, any> }) => {
      const l = d.data();
      return {
        id: d.id,
        to: l.to, from: l.from, subject: l.subject,
        template: l.template, category: l.category,
        status: l.status, provider: l.provider, providerId: l.providerId,
        failureReason: l.failureReason ?? null,
        errorClass: l.errorClass ?? null,
        createdAt: l.createdAt?.toDate?.().toISOString?.() ?? null,
        devMode: l.devMode ?? false,
      };
    }),
  });
}

/** Removing a suppression is an explicit, audited admin decision. */
export async function POST(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) {
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? '');
  if (action !== 'unsuppress') {
    return NextResponse.json({ ok: false, message: 'Unknown action.' }, { status: 400 });
  }
  const address = String(body?.address ?? '').trim().toLowerCase();
  if (!address || address.length > 254) {
    return NextResponse.json({ ok: false, message: 'A valid address is required.' }, { status: 400 });
  }

  const removed = await unsuppressAddress(db as unknown as StoreDb, address);
  return NextResponse.json({ ok: removed, address });
}
