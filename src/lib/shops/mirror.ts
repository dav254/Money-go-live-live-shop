/**
 * Client-side fire-and-forget mirror call for the shops section.
 *
 * Every write to `sellerShops/{uid}` (shop settings, branding, account
 * profile) is followed by this helper, which tells the server to copy the
 * authoritative document to the local PocketBase store on the VPS. Same rules
 * as the products/orders/wallet mirrors:
 *
 *   • fire-and-forget — the seller's real write already succeeded, so a
 *     mirror failure is logged server-side and otherwise invisible;
 *   • never awaited in the seller's critical path — the save toast does not
 *     depend on the VPS.
 *
 * Only the shop id crosses the wire (it defaults to the caller's own uid):
 * the server re-reads the document itself, so this cannot be abused to push
 * arbitrary data into the mirror.
 */

import type { User } from 'firebase/auth';

async function callSync(user: User, shopId?: string) {
  try {
    const token = await user.getIdToken();
    await fetch('/api/shops/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(shopId ? { shopId } : {}),
      keepalive: true,
    });
  } catch {
    /* Best-effort — the Firestore write already succeeded. */
  }
}

/**
 * After the seller saved their shop profile / branding in Firestore.
 * `shopId` is only needed when mirroring someone else's shop (admin); sellers
 * pass nothing and the server resolves the record from their own uid.
 */
export function mirrorShop(user: User | null | undefined, shopId?: string): void {
  if (!user) return;
  void callSync(user, shopId);
}
