/**
 * Client-side fire-and-forget mirror calls for the orders section.
 *
 * Every order a buyer creates or updates in Firestore (checkout, payment
 * success, cancellation) is followed by one of these helpers, which tell the
 * server to copy the authoritative document to the local PocketBase store on
 * the VPS. Same rules as the products mirror:
 *
 *   • fire-and-forget — the real write already succeeded, so a mirror failure
 *     is logged server-side and otherwise invisible;
 *   • never awaited in the user's critical path — the confirmation the buyer
 *     is waiting on does not depend on the VPS.
 *
 * Only the order id crosses the wire: the server re-reads the document and
 * checks the caller is a party to the order, so this cannot be abused to
 * write arbitrary data into the mirror.
 */

import type { User } from 'firebase/auth';

async function callSync(user: User, orderId: string) {
  try {
    const token = await user.getIdToken();
    await fetch('/api/orders/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId }),
      keepalive: true,
    });
  } catch {
    /* Best-effort — the Firestore write already succeeded. */
  }
}

/** After an order was created or updated in Firestore. */
export function mirrorOrder(user: User | null | undefined, orderId: string): void {
  if (!user || !orderId) return;
  void callSync(user, orderId);
}
