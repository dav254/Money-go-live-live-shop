/**
 * /api/shop-agent/optout — PUBLIC, token-gated opt-out (GET + POST).
 *
 * The practical opt-out every outreach message carries: a recipient clicks
 * the link (GET) or posts the form (POST) and is added to the suppression
 * list — no account, no login, no email address required.
 *
 * Security:
 *   • The token is an HMAC over the candidate id keyed by a server-side
 *     secret (`VIDNOV_SHOP_AGENT_SECRET`, falling back to `CRON_SECRET`).
 *     Forging one requires the secret; a leaked token only opts out THAT
 *     contact. Invalid tokens answer a generic 403 — no enumeration.
 *   • No secret configured ⇒ 503 fail-closed. Outreach cannot send without
 *     the same secret, so a live campaign can never lack a working opt-out.
 *   • Idempotent: opting out twice succeeds both times and sends nothing.
 *   • The response never echoes the token or any secret.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { optOutSchema } from '@/lib/vidnov-core/shop-agent/schemas';
import { suppressContact } from '@/lib/vidnov-core/shop-agent/service';
import { outreachSecret, verifyOptOutToken } from '@/lib/vidnov-core/shop-agent/types';

export const runtime = 'nodejs';

async function handle(request: NextRequest): Promise<NextResponse> {
  const secret = outreachSecret();
  if (!secret) {
    return NextResponse.json({ error: 'Opt-out service is not configured.' }, { status: 503 });
  }

  let candidate = '';
  let token = '';
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    candidate = String((body as { candidate?: unknown }).candidate ?? '');
    token = String((body as { token?: unknown }).token ?? '');
  } else {
    const params = request.nextUrl.searchParams;
    candidate = params.get('candidate') ?? '';
    token = params.get('token') ?? '';
  }

  const parsed = optOutSchema.safeParse({ candidate, token });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid opt-out request.' }, { status: 400 });
  }

  if (!verifyOptOutToken(parsed.data.candidate, secret, parsed.data.token)) {
    return NextResponse.json({ error: 'Invalid opt-out link.' }, { status: 403 });
  }

  try {
    await suppressContact(db, {
      candidateId: parsed.data.candidate,
      reason: 'opt_out',
      source: 'recipient',
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'not_found') {
      // Same generic answer as a bad token: no enumeration of candidate ids.
      return NextResponse.json({ error: 'Invalid opt-out link.' }, { status: 403 });
    }
    console.error('[shop-agent] opt-out failed');
    return NextResponse.json({ error: 'Opt-out could not be processed.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: 'You have been opted out. You will not receive further outreach from Vidnov.',
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
