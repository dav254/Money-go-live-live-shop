/**
 * /api/admin/shop-agent/messages — the human-approved outreach queue.
 *
 * GET  → bounded queue listing (optional `?state=`).
 * POST → { action: 'approve' | 'reject' | 'send', ids?, limit? }
 *
 * The service enforces every gate: approval only moves `pending_approval`,
 * suppression cancels instead of approving, and `send` refuses a paused or
 * unacknowledged campaign, re-checks suppression/retention/max-one-contact
 * per message, and reserves daily count + budget atomically before dispatch.
 * Nothing in this route can mark a message sent — only the provider outcome
 * path can.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { verifyAdminUid } from '@/lib/notifications/server-utils';
import { dispatchOutreach } from '@/lib/vidnov-core/shop-agent/providers';
import { messageActionSchema } from '@/lib/vidnov-core/shop-agent/schemas';
import { MESSAGE_STATES, type MessageState } from '@/lib/vidnov-core/shop-agent/types';
import {
  ShopAgentError,
  approveMessages,
  cancelMessages,
  sendApprovedBatch,
} from '@/lib/vidnov-core/shop-agent/service';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const stateRaw = request.nextUrl.searchParams.get('state');
  const limitRaw = Number(request.nextUrl.searchParams.get('limit') ?? '50');
  const state = stateRaw && (MESSAGE_STATES as readonly string[]).includes(stateRaw)
    ? (stateRaw as MessageState)
    : undefined;
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.floor(limitRaw))) : 50;

  try {
    let query = db.collection('shopAgentMessages').limit(limit);
    if (state) query = query.where('state', '==', state);
    const snap = await query.get();
    return NextResponse.json({ messages: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch {
    console.error('[shop-agent] message list failed');
    return NextResponse.json({ error: 'Messages unavailable.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminUid = await verifyAdminUid(request);
  if (!adminUid) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const raw = await request.json().catch(() => ({}));
  const parsed = messageActionSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const input = parsed.data;
  if (input.action !== 'send' && !input.ids?.length) {
    return NextResponse.json({ error: 'Message ids are required.' }, { status: 400 });
  }

  try {
    if (input.action === 'approve') {
      const result = await approveMessages(db, input.ids ?? [], adminUid);
      return NextResponse.json(result);
    }
    if (input.action === 'reject') {
      const cancelled = await cancelMessages(db, input.ids ?? [], adminUid);
      return NextResponse.json({ cancelled });
    }
    const report = await sendApprovedBatch(db, {
      send: dispatchOutreach,
      limit: input.limit ?? 10,
    });
    return NextResponse.json({ report });
  } catch (err) {
    if (err instanceof ShopAgentError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[shop-agent] message action failed');
    return NextResponse.json({ error: 'Action could not complete.' }, { status: 500 });
  }
}
