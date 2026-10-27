/**
 * Client-side fire-and-forget mirror calls for the per-user subcollections.
 *
 * Cart lines and saved payment / payout methods are written in the browser
 * with the client SDK; these helpers tell the server to copy the
 * authoritative document to the local PocketBase store on the VPS. Same rules
 * as the products/orders/wallet mirrors:
 *
 *   • fire-and-forget — the real write already succeeded, so a mirror failure
 *     is logged server-side and otherwise invisible;
 *   • never awaited in the user's critical path — the add-to-cart, quantity
 *     change or "method saved" toast does not depend on the VPS.
 *
 * Only the kind, the document id and the action cross the wire: the server
 * builds the path from the verified caller's own uid and re-reads the
 * document itself, so this cannot be abused to touch another account's data
 * or to write arbitrary content into the mirror.
 */

import type { User } from 'firebase/auth';
import type { UserDataKind } from '@/lib/pocketbase/user-data';

type MirrorAction = 'upsert' | 'delete';

async function callSync(user: User, kind: UserDataKind, id: string, action: MirrorAction) {
  try {
    const token = await user.getIdToken();
    await fetch('/api/users/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ kind, id, action }),
      keepalive: true,
    });
  } catch {
    /* Best-effort — the Firestore write already succeeded. */
  }
}

/** After a cart line was added or its quantity changed (`cart/{productId}`). */
export function mirrorCartItem(
  user: User | null | undefined,
  productId: string,
  action: MirrorAction = 'upsert',
): void {
  if (!user || !productId) return;
  void callSync(user, 'cart', productId, action);
}

/** After a cart line was removed (drops the VPS copy). */
export function mirrorCartItemDelete(
  user: User | null | undefined,
  productId: string,
): void {
  if (!user || !productId) return;
  void callSync(user, 'cart', productId, 'delete');
}

/** After a buyer saved or removed a `paymentMethods` document. */
export function mirrorPaymentMethod(
  user: User | null | undefined,
  methodId: string,
  action: MirrorAction = 'upsert',
): void {
  if (!user || !methodId) return;
  void callSync(user, 'paymentMethod', methodId, action);
}

/** After a seller saved or removed a `payoutMethods` document. */
export function mirrorPayoutMethod(
  user: User | null | undefined,
  methodId: string,
  action: MirrorAction = 'upsert',
): void {
  if (!user || !methodId) return;
  void callSync(user, 'payoutMethod', methodId, action);
}
