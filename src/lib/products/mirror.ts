/**
 * Client-side fire-and-forget mirror calls for the products section.
 *
 * Every listing create / edit / delete in Firestore is followed by one of
 * these helpers, which tell the server to copy the authoritative document to
 * the local PocketBase store on the VPS. They are deliberately:
 *
 *   • fire-and-forget — the seller's real write already succeeded, so a
 *     mirror failure is logged server-side and otherwise invisible;
 *   • never awaited in the user's critical path — the toast/navigation the
 *     seller is waiting on does not depend on the VPS.
 *
 * The server re-reads the document itself (only the id crosses the wire), so
 * this cannot be abused to write arbitrary data into the mirror.
 */

import type { User } from 'firebase/auth';

type MirrorAction = 'upsert' | 'delete';

async function callSync(user: User, productId: string, action: MirrorAction) {
  try {
    const token = await user.getIdToken();
    await fetch('/api/products/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ productId, action }),
      keepalive: true,
    });
  } catch {
    /* Best-effort — the Firestore write already succeeded. */
  }
}

/** After a listing was created or edited in Firestore. */
export function mirrorProduct(user: User | null | undefined, productId: string): void {
  if (!user || !productId) return;
  void callSync(user, productId, 'upsert');
}

/** After a listing was deleted in Firestore (tombstones the VPS copy). */
export function mirrorProductDelete(user: User | null | undefined, productId: string): void {
  if (!user || !productId) return;
  void callSync(user, productId, 'delete');
}
