/**
 * Repair: give existing request-marketplace orders the canonical Order fields
 * (totalAmount / subtotal / quantity / orderDate). They were created without
 * them, which crashed any screen that renders `order.totalAmount`.
 *
 * Usage: npx tsx scripts/backfill-order-amounts.ts [--apply]
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import serviceAccount from '../service-account.json';

initializeApp({ credential: cert(serviceAccount as never) });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');

async function main() {
  const snap = await db.collection('orders').get();
  let fixed = 0;

  for (const doc of snap.docs) {
    const o = doc.data() as Record<string, unknown>;
    const patch: Record<string, unknown> = {};

    if (typeof o.totalAmount !== 'number') {
      const price = typeof o.productPrice === 'number' ? o.productPrice : 0;
      patch.totalAmount = price;
      patch.subtotal = typeof o.subtotal === 'number' ? o.subtotal : price;
    }
    if (typeof o.shippingCost !== 'number') patch.shippingCost = 0;
    if (typeof o.quantity !== 'number') patch.quantity = 1;
    if (!o.orderDate) patch.orderDate = o.createdAt ?? FieldValue.serverTimestamp();

    if (Object.keys(patch).length === 0) continue;
    fixed += 1;
    console.log(`  ${doc.id} (${String(o.fulfillmentType ?? 'standard')}) → ${JSON.stringify(patch)}`);
    if (APPLY) await doc.ref.update(patch);
  }

  console.log(`${fixed} order(s) ${APPLY ? 'repaired' : 'need repair (re-run with --apply)'}`);
  process.exit(0);
}

void main();