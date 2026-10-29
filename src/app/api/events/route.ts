import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '@/firebase/server';
import { verifyUserUid } from '@/lib/notifications/server-utils';
import {
  MAX_EVENT_BYTES,
  SID_PATTERN,
  dedupeDocId,
  eventDayKey,
  eventExpiresAt,
  isQualifiedView,
  parseEventInput,
} from '@/lib/growth/events';
import { hashViewerId } from '@/lib/growth/server';

export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * Server-issued anonymous session cookie — httpOnly (not reachable from JS),
 * same-site, day-bucketed only inside the stored HASH (the cookie itself is a
 * stable opaque nonce so dedupe survives page loads). Rotated server-side only.
 */
const SESSION_COOKIE = 'vn_evs';

/**
 * POST /api/events — the Growth Engine's event spine (Phase 1).
 *
 * Records two things, nothing else: `view` (a listing) and `click` (a share).
 * Everything a client could try to influence is either absent from the wire
 * format or re-derived server-side:
 *
 *   1. **Session evidence** — the anonymous session id is generated SERVER-SIDE
 *      and delivered in an httpOnly cookie (`vn_evs`), so browser JavaScript
 *      can never supply, read or rotate it; any `sid` left in an old client's
 *      body is parsed and then IGNORED. Signed-in callers are additionally
 *      bound to their verified Bearer uid — an invalid Bearer → 401 (an
 *      expired token must not silently downgrade to anonymous).
 *   2. **Validation** — `parseEventInput` whitelists type/kind/id/platform/
 *      dwell and DROPS every other key; counters, seller ids, prices and
 *      order values are not parseable fields (never trusted, never stored).
 *   3. **Dedupe + counters in ONE transaction** — the dedupe document id is
 *      (type, target, viewer-hash, day): a repeat refresh finds the existing
 *      doc and writes nothing. A race on the same id serialises through the
 *      Firestore transaction (create-if-absent), so the counter can only
 *      increment once per viewer per target per day — concurrency-safe by
 *      construction.
 *   4. **Self-view filter** — when the viewer's verified uid equals the
 *      listing's sellerId (or the shop's own id), the event is recorded as
 *      `self: true` and the public counter is NOT incremented.
 *   5. **Qualified views** — public counters only move when the attested
 *      dwell meets VIEW_QUALIFY_MS (2s of visible page). Raw, unqualified
 *      events are still stored (`qualified: false`) so raw-vs-qualified stays
 *      measurable. Never faked, never backfilled.
 *   6. **Privacy** — the raw sid/uid is hashed with a day bucket before
 *      storage; NO IP addresses, user-agents, tokens or referrer URLs are
 *      read or stored; the optional `ref` is a normalised 40-char code and
 *      the optional `ch` is a closed-set distribution channel label (from
 *      `?ch=` tracked links) used for destination analytics — an attribution
 *      LABEL only, never a reward trigger.
 *      Every doc carries `expiresAt` (30 days) for a Firestore TTL policy.
 *   7. **Browsing never breaks** — any unexpected failure answers
 *      202 { ok: true, counted: false } (clients fire-and-forget anyway);
 *      only malformed input (400/413) or bad credentials (401) are errors.
 *
 * Firestore stays the single source of truth: counters on `products` /
 * `sellerShops` are written here via the Admin SDK only (client rules are
 * tightened separately, presented for approval — not deployed by this code).
 */
export async function POST(request: NextRequest) {
  try {
    /* ── request size ── */
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > MAX_EVENT_BYTES) {
      return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_EVENT_BYTES) {
      return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    }

    const parsed = parseEventInput(json);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const event = parsed.value;

    /* ── session evidence: verified uid, or the server-issued cookie ── */
    let uid: string | null = null;
    const authHeader = request.headers.get('authorization') ?? '';
    if (authHeader) {
      uid = await verifyUserUid(request);
      if (!uid) return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
    }

    /* ── session id: SERVER-generated (cookie), never client-supplied ── */
    const cookieSid = request.cookies.get(SESSION_COOKIE)?.value ?? '';
    const issueSid = !SID_PATTERN.test(cookieSid);
    const sid = issueSid ? randomBytes(16).toString('hex') : cookieSid;

    const day = eventDayKey(new Date());
    const viewerHash = hashViewerId(uid ? `u:${uid}` : `s:${sid}`, day);
    const qualified = isQualifiedView(event);
    const eventRef = db
      .collection('contentEvents')
      .doc(dedupeDocId(event.type, event.targetKind, event.targetId, day, viewerHash));

    /* ── resolve target + apply counters atomically ── */
    const targetCol = event.targetKind === 'product' ? 'products' : 'sellerShops';
    const targetRef = db.collection(targetCol).doc(event.targetId);

    const outcome = await db.runTransaction(async (tx) => {
      const seen = await tx.get(eventRef);
      if (seen.exists) return { counted: false, reason: 'duplicate' };

      const target = await tx.get(targetRef);
      if (!target.exists) return { counted: false, reason: 'unknown_target' };
      const data = target.data() ?? {};
      // For a shop the document id IS the seller uid; products carry sellerId.
      const sellerId =
        event.targetKind === 'shop' ? event.targetId : String(data.sellerId ?? '');
      const self = !!uid && !!sellerId && uid === sellerId;

      tx.create(eventRef, {
        type: event.type,
        targetKind: event.targetKind,
        targetId: event.targetId,
        sellerId: sellerId || null,
        day,
        viewer: viewerHash,
        qualified: qualified && !self,
        self,
        platform: event.platform ?? null,
        ref: event.ref ?? null,
        // Distribution channel label — server-validated against the closed
        // channel set inside parseEventInput (an unknown value is dropped
        // before it ever reaches here).
        channel: event.channel ?? null,
        // Campaign label from `?camp=` tracked links — same closed-set
        // validation as `ch` inside parseEventInput (invalid values are
        // dropped before they ever reach here).
        campaign: event.campaign ?? null,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: eventExpiresAt(new Date()),
      });

      if (self || !qualified) {
        // Recorded raw; public counters untouched (self-view / unqualified).
        return { counted: false, reason: self ? 'self_view' : 'unqualified' };
      }

      if (event.type === 'view') {
        tx.update(targetRef, { viewCount: FieldValue.increment(1) });
      } else {
        tx.update(targetRef, { clickCount: FieldValue.increment(1) });
      }
      return { counted: true };
    });

    const response = NextResponse.json({ ok: true, ...outcome }, { status: 200 });
    if (issueSid) {
      response.cookies.set(SESSION_COOKIE, sid, {
        httpOnly: true,
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        path: '/',
        maxAge: 180 * 24 * 60 * 60, // 180 days; the salted hash still rotates daily
      });
    }
    return response;
  } catch (error) {
    // Never surface internals, never break the caller's browsing: the client
    // treats this as fire-and-forget, and the next visit retries cleanly.
    console.error('[events] event could not be recorded');
    return NextResponse.json({ ok: true, counted: false }, { status: 202 });
  }
}
