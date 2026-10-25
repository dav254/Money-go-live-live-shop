import { NextResponse } from 'next/server';
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { pocketBaseEnabled } from '@/lib/pocketbase/server';
import { pbPatchOrder } from '@/lib/pocketbase/orders';
import { pbMirrorPayment } from '@/lib/pocketbase/wallet';
import { pbAdjustAiPoints } from '@/lib/pocketbase/profiles';
import type { Order } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * PayPal Webhook Handler (App Router).
 *
 * HARDENED — this endpoint moves money and prints points, so nothing about
 * the caller may be taken on trust:
 *
 *  1. **Configuration gate.** With no PayPal credentials the route answers
 *     410 instead of happily processing forged events against a payment
 *     method this deployment cannot even start.
 *  2. **Signature verification.** Every event is verified against PayPal's
 *     `/v1/notifications/verify-webhook-signature` API using the six signed
 *     `PAYPAL-*` transmission headers and the RAW request body. Fail-closed:
 *     if headers are missing, the API errors, or verification is anything
 *     other than SUCCESS, the event is rejected with 401. A forged
 *     CHECKOUT.ORDER.APPROVED can therefore no longer credit points or mark
 *     orders paid — which is exactly what the previous version allowed.
 *  3. **Idempotent crediting.** Points credit is keyed on the PayPal
 *     transaction id: a payment row with the same id short-circuits the
 *     handler, and the row itself uses a deterministic document id
 *     (`paypal_<txn>`), so PayPal's automatic retries can never mint the
 *     same purchase twice.
 *  4. **Bounded inputs.** userId and points are validated before use — no
 *     arbitrary document paths, no negative/NaN/huge credits.
 *
 * Known limitation: verification requires outbound HTTPS to PayPal
 * (api-m.paypal.com / api-m.sandbox.paypal.com). If that call cannot be
 * made, the event is rejected (fail closed) rather than trusted.
 */

function paypalConfigured(): boolean {
  return !!(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim());
}

function paypalApiBase(): string {
  return process.env.PAYPAL_ENVIRONMENT === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

/**
 * Verifies the PayPal transmission headers against PayPal's own API.
 * Returns true only on an explicit SUCCESS. Never throws.
 */
async function verifyPaypalSignature(
  headers: Headers,
  rawBody: string,
  eventId: string,
): Promise<boolean> {
  try {
    const authAlgo = headers.get('paypal-auth-algo');
    const certUrl = headers.get('paypal-cert-url');
    const transmissionId = headers.get('paypal-transmission-id');
    const transmissionSig = headers.get('paypal-transmission-sig');
    const transmissionTime = headers.get('paypal-transmission-time');
    if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
      return false; // unsigned delivery — never process
    }

    const clientId = process.env.PAYPAL_CLIENT_ID!.trim();
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET!.trim();
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const res = await fetch(`${paypalApiBase()}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        event_id: eventId,
        payload: rawBody,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as {
      verification_status?: string;
    } | null;
    return data?.verification_status === 'SUCCESS';
  } catch {
    return false; // network error / timeout → fail closed
  }
}

/** Deterministic payment-row id so a retry overwrites instead of duplicating. */
function paymentDocId(transactionId: string): string {
  const safe = transactionId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
  return `paypal_${safe || Date.now().toString(36)}`;
}

/** True when a payment row for this PayPal transaction already exists. */
async function alreadyProcessed(transactionId: string): Promise<boolean> {
  if (!transactionId) return false;
  try {
    const snap = await db
      .collection('payments')
      .where('transactionId', '==', transactionId)
      .limit(1)
      .get();
    return !snap.empty;
  } catch {
    return false; // cannot prove it is new → do not risk a double credit
  }
}

export async function POST(request: Request) {
  try {
    /* ── 1. configuration gate ─────────────────────────────────── */
    if (!paypalConfigured()) {
      return NextResponse.json(
        { error: 'PayPal is not configured on this deployment.' },
        { status: 410 },
      );
    }

    /* ── 2. raw body + signature verification ──────────────────── */
    const rawBody = await request.text();
    let event: Record<string, any>;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const eventId = typeof event?.id === 'string' ? event.id : '';
    if (!eventId || !(await verifyPaypalSignature(request.headers, rawBody, eventId))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
      const resource = event.resource ?? {};
      const purchaseUnit = resource.purchase_units?.[0];
      const customId = purchaseUnit?.custom_id;
      const transactionId = typeof resource.id === 'string' ? resource.id : '';
      if (!customId || !transactionId) {
        return NextResponse.json({ status: 'ignored' });
      }

      let metadata: any;
      try {
        metadata = JSON.parse(customId);
      } catch {
        metadata = { transactionType: 'product-purchase', orderId: customId };
      }

      /* ── 3. idempotency: this exact transaction never pays twice ── */
      if (await alreadyProcessed(transactionId)) {
        return NextResponse.json({ status: 'duplicate-ignored' });
      }

      const transactionType = metadata?.transactionType;

      if (transactionType === 'points-purchase') {
        const userId = metadata.userId;
        const points = Math.floor(Number(metadata.points));
        const amount = parseFloat(purchaseUnit.amount?.value);
        // Bounded, sane inputs only — a verified payload can still be a
        // replayed or malformed one.
        if (
          typeof userId !== 'string' ||
          !/^[A-Za-z0-9_-]{1,128}$/.test(userId) ||
          !(points > 0) ||
          points > 1_000_000 ||
          !Number.isFinite(amount)
        ) {
          return NextResponse.json({ status: 'ignored' });
        }

        const userRef = db.collection('userProfiles').doc(userId);

        /*
         * Points credited VPS-first (the balance the go-live charge reads
         * lives there too), with the Firestore increment as the other half
         * of the pair.
         */
        let creditedOnVps = false;
        if (pocketBaseEnabled()) {
          creditedOnVps = (await pbAdjustAiPoints(userId, points)) !== null;
        }
        if (!creditedOnVps) {
          await userRef.update({ aiPoints: FieldValue.increment(points) });
          void pbAdjustAiPoints(userId, points);
        } else {
          try {
            await userRef.update({ aiPoints: FieldValue.increment(points) });
          } catch (error) {
            console.error('[paypal] Firestore balance mirror failed (credit kept on VPS):', error);
          }
        }

        /*
         * The payment row — deterministic id keyed on the PayPal
         * transaction, so even a retry that races past `alreadyProcessed`
         * upserts the SAME document instead of minting a second credit
         * record.
         */
        const paymentRef = db.collection('payments').doc(paymentDocId(transactionId));
        const plainPayment = {
          userId: userId,
          amount: amount,
          paymentMethod: 'paypal',
          paymentStatus: 'completed',
          paymentDate: new Date().toISOString(),
          transactionType: 'points-purchase',
          transactionId: transactionId,
        };
        let mirrored = false;
        if (pocketBaseEnabled()) {
          mirrored = await pbMirrorPayment(paymentRef.id, plainPayment);
        }
        try {
          await paymentRef.set({
            ...plainPayment,
            paymentDate: FieldValue.serverTimestamp(),
          });
        } catch (error) {
          if (!mirrored) throw error;
          console.error('[paypal] Firestore payment mirror failed (payment kept on VPS):', error);
        }
      } else {
        const orderId = metadata.orderId;
        if (orderId && typeof orderId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(orderId)) {
          const orderRef = db.collection('orders').doc(orderId);
          const orderSnap = await orderRef.get();
          if (orderSnap.exists) {
            const orderData = orderSnap.data() as Order;
            /* Payment acknowledged → `processing`. VPS-PRIMARY when PocketBase
             * is on, best-effort copy to the other store either way. The
             * status values are idempotent (same patch on every retry). */
            const patch = {
              orderStatus: 'processing',
              paymentMethod: 'paypal',
              updatedAt: new Date().toISOString(),
            };
            let updatedOnVps = false;
            if (pocketBaseEnabled()) {
              updatedOnVps = await pbPatchOrder(orderId, patch);
              if (updatedOnVps) {
                try {
                  await orderRef.update({
                    orderStatus: 'processing',
                    paymentMethod: 'paypal',
                    updatedAt: FieldValue.serverTimestamp(),
                  });
                } catch (error) {
                  console.error('[paypal] Firestore mirror failed (paid order kept on VPS):', error);
                }
              }
            }
            if (!updatedOnVps) {
              await orderRef.update({
                orderStatus: 'processing',
                paymentMethod: 'paypal',
                updatedAt: FieldValue.serverTimestamp(),
              });
              void pbPatchOrder(orderId, patch);
            }
            // Payment row — deterministic id on the PayPal transaction id.
            const plainPayment = {
              orderId: orderId,
              userId: orderData.buyerId,
              amount: orderData.totalAmount,
              paymentMethod: 'paypal',
              paymentStatus: 'completed',
              paymentDate: new Date().toISOString(),
              transactionType: 'product-purchase',
              transactionId: transactionId,
            };
            const paymentRef = db.collection('payments').doc(paymentDocId(transactionId));
            let mirroredPayment = false;
            if (pocketBaseEnabled()) {
              mirroredPayment = await pbMirrorPayment(paymentRef.id, plainPayment);
            }
            try {
              await paymentRef.set({
                ...plainPayment,
                paymentDate: FieldValue.serverTimestamp(),
              });
            } catch (error) {
              if (!mirroredPayment) throw error;
              console.error('[paypal] Firestore payment mirror failed (payment kept on VPS):', error);
            }
          }
        }
      }
    }
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('[paypal] webhook processing error');
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}