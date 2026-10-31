/**
 * POST /api/support/notify — support ticket acknowledgement + admin alert.
 *
 * Fired (best-effort) by the contact form right after a ticket document is
 * created. The recipient address is resolved SERVER-SIDE from the verified
 * Firebase token / profile — never taken from the request body — and both
 * messages travel through the central email service, so rate limits,
 * duplicate cooldowns, suppression, retries and the emailLogs trail apply
 * unchanged.
 *
 * Returns `ok: true` even when a delivery fails: a ticket must never be
 * rejected because an email bounced. The failure is visible in the email
 * logs instead.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { db } from '@/firebase/server';
import { verifyUserUid } from '@/lib/notifications/server';
import { getVidnovConfig } from '@/lib/notifications/config';
import { sendTemplateEmail } from '@/lib/notifications/email-service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const uid = await verifyUserUid(request);
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const issueType = String(body?.issueType ?? '').trim().slice(0, 80);
  const description = String(body?.description ?? '').trim().slice(0, 1_500);
  const ticketRef = String(body?.ticketRef ?? '').trim().slice(0, 40);
  if (!issueType) {
    return NextResponse.json({ ok: false, message: 'A topic is required.' }, { status: 400 });
  }

  // Resolve the real account address server-side (Auth first, profile fallback).
  let email = '';
  let name = '';
  try {
    const user = await getAuth().getUser(uid);
    email = user.email ?? '';
    name = user.displayName ?? '';
  } catch {
    /* fall through to the profile */
  }
  if (!email) {
    try {
      const snap = await db.collection('userProfiles').doc(uid).get();
      const data = (snap.data() ?? {}) as Record<string, unknown>;
      email = typeof data.email === 'string' ? data.email : '';
      if (!name && typeof data.displayName === 'string') name = data.displayName;
    } catch {
      /* no address on file */
    }
  }
  if (!email) {
    // No address: nothing can be sent — report honestly, without failing.
    return NextResponse.json({ ok: true, emailed: false, reason: 'no_address' });
  }

  const vars: Record<string, string | undefined> = {
    user_name: name || 'there',
    issue_type: issueType,
    ticket_ref: ticketRef || '—',
    description,
  };

  const [ack, alert] = await Promise.all([
    sendTemplateEmail({
      templateKey: 'support-ticket-received',
      category: 'messages',
      to: email,
      userId: uid,
      vars,
    }).catch(() => null),
    sendTemplateEmail({
      templateKey: 'support-ticket-alert',
      category: 'messages',
      to: getVidnovConfig().mailAddresses.admin,
      vars: { ...vars, user_name: name || uid },
    }).catch(() => null),
  ]);

  return NextResponse.json({
    ok: true,
    emailed: Boolean(ack?.ok),
    adminNotified: Boolean(alert?.ok),
  });
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
