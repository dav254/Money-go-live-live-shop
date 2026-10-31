/**
 * POST /api/webhooks/email — provider delivery events (Resend / svix scheme).
 *
 * This is the ONLY thing that may advance a message past `SENT`:
 *   email.sent → SENT · email.delivered → DELIVERED ·
 *   email.delivery_delayed → DELAYED · email.bounced / complained → BOUNCED
 * A provider accepting the API request proves nothing about delivery, so
 * the send pipeline stops at SENT and waits for this endpoint.
 *
 * ## Security
 * • HMAC-SHA256 verification of the `svix-id` / `svix-timestamp` /
 *   `svix-signature` headers against `EMAIL_WEBHOOK_SECRET`, timing-safe,
 *   ±5 minutes, FAIL CLOSED — no secret configured ⇒ 503, bad signature ⇒
 *   401. Nothing is parsed or stored before verification succeeds.
 *
 * ## Idempotency & retries
 * • The (sanitized) svix id is the document id of `emailWebhookEvents`, so a
 *   redelivered event is detected and skipped.
 * • Side effects run BEFORE the idempotency record is written, and every
 *   side effect is itself idempotent (status patch + address-keyed
 *   suppression). A store failure answers 500 so the provider redelivers —
 *   an event is never silently dropped.
 *
 * ## Privacy
 * Only event type, provider message id, recipient address and status are
 * stored. Bodies are never expected here (and would be discarded anyway).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { pbUpdateEmailLogStatus } from '@/lib/pocketbase/email-logs';
import {
  bounceIsPermanent,
  parseEmailEvent,
  sanitizeEventId,
  statusForEvent,
  verifyWebhookSignature,
} from '@/lib/notifications/email-reliability';
import {
  recordWebhookEvent,
  suppressAddress,
  updateLogStatusByProviderId,
  type StoreDb,
} from '@/lib/notifications/email-store';

export const runtime = 'nodejs';

function header(request: NextRequest, name: string): string | undefined {
  return request.headers.get(name) ?? undefined;
}

/** Extracts what we keep from the (verified) payload — defensively. */
function extract(payload: Record<string, unknown>): {
  messageId?: string | undefined;
  address?: string | undefined;
} {
  const email = (payload.email ?? {}) as Record<string, unknown>;
  const rawTo = email.to ?? payload.to;
  const address = Array.isArray(rawTo) ? String(rawTo[0] ?? '') : typeof rawTo === 'string' ? rawTo : '';
  const messageId =
    (typeof email.id === 'string' && email.id) ||
    (typeof payload.email_id === 'string' && payload.email_id) ||
    (typeof payload.message_id === 'string' && payload.message_id) ||
    undefined;
  return { messageId, address: address || undefined };
}

export async function POST(request: NextRequest) {
  const secret = (process.env.EMAIL_WEBHOOK_SECRET ?? '').trim();
  if (!secret) {
    // Fail closed: without a configured secret we cannot trust any delivery.
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  const verify = verifyWebhookSignature({
    secret,
    headers: {
      id: header(request, 'svix-id'),
      timestamp: header(request, 'svix-timestamp'),
      signature: header(request, 'svix-signature'),
    },
    rawBody,
  });
  if (!verify.ok) {
    return NextResponse.json({ error: 'invalid_signature', reason: verify.reason }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const store = db as unknown as StoreDb;
  const type = typeof payload.type === 'string' ? payload.type : '';
  const eventId = sanitizeEventId(header(request, 'svix-id') ?? `${type}-${Date.now()}`);
  const { messageId, address } = extract(payload);

  // ── Idempotency fast path ────────────────────────────────────────────────
  try {
    const seen = await store.collection('emailWebhookEvents').doc(eventId).get();
    if (seen.exists) return NextResponse.json({ ok: true, duplicate: true });
  } catch {
    // Store unreachable — fall through; the effect calls below decide 500.
  }

  const event = parseEmailEvent(type);

  // ── Effects (idempotent, run BEFORE the dedupe record) ───────────────────
  let storeOk = true;

  if (event) {
    const status = statusForEvent(event);
    if (status && messageId) {
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { status };
      if (status === 'DELIVERED') patch.deliveredAt = now;
      if (status === 'BOUNCED' || status === 'FAILED') {
        patch.failureReason =
          status === 'BOUNCED' ? 'Provider reported this message bounced.' : 'Provider reported a send failure.';
        patch.errorClass = status === 'BOUNCED' ? 'bounce' : 'provider_failed';
      }
      // PocketBase best-effort, Firestore is the source of truth for `ok`.
      await pbUpdateEmailLogStatus(messageId, patch);
      const fs = await updateLogStatusByProviderId(store, messageId, patch);
      if (!fs.ok) storeOk = false;
    }

    // Permanent bounce / complaint → suppression (doc id = address ⇒ idempotent).
    if ((event === 'bounced' && bounceIsPermanent(payload)) || event === 'complained') {
      if (address) {
        const suppressed = await suppressAddress(store, {
          address,
          reason: event === 'complained' ? 'complaint' : 'permanent_bounce',
          source: 'webhook',
        });
        if (!suppressed) storeOk = false;
      }
    }
  }

  if (!storeOk) {
    // 500 ⇒ the provider redelivers; effects are idempotent so nothing doubles.
    return NextResponse.json({ error: 'store_unavailable' }, { status: 500 });
  }

  const recorded = await recordWebhookEvent(store, {
    eventId,
    type,
    messageId,
    address,
    status: event ? statusForEvent(event) ?? undefined : undefined,
  });
  if (!recorded) {
    return NextResponse.json({ error: 'store_unavailable' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, processed: Boolean(event), eventId });
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
