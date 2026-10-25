/**
 * Client-side fire-and-forget mirror calls for the wallet section.
 *
 * A seller's payout REQUEST and the checkout points simulation's payment row
 * are created in the browser with the client SDK; these helpers tell the
 * server to copy the authoritative document to the local PocketBase store on
 * the VPS. Same rules as the products/orders mirrors:
 *
 *   • fire-and-forget — the real write already succeeded, so a mirror failure
 *     is logged server-side and otherwise invisible;
 *   • never awaited in the user's critical path.
 *
 * Only the record id crosses the wire: the server re-reads the document and
 * checks the caller owns it, so this cannot be abused to write arbitrary
 * ledger rows into the mirror.
 */

import type { User } from 'firebase/auth';

type WalletKind = 'payout' | 'payment';

async function callSync(user: User, kind: WalletKind, id: string) {
  try {
    const token = await user.getIdToken();
    await fetch('/api/wallet/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ kind, id }),
      keepalive: true,
    });
  } catch {
    /* Best-effort — the Firestore write already succeeded. */
  }
}

/** After a seller requested a payout in Firestore (`payouts`). */
export function mirrorPayout(user: User | null | undefined, payoutId: string): void {
  if (!user || !payoutId) return;
  void callSync(user, 'payout', payoutId);
}

/** After a payment row was created in Firestore (`payments`). */
export function mirrorWalletPayment(user: User | null | undefined, paymentId: string): void {
  if (!user || !paymentId) return;
  void callSync(user, 'payment', paymentId);
}
