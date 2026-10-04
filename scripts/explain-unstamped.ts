/**
 * EXPLAINS THE UNSTAMPED DOCUMENTS.
 *
 * I claimed the handful of unstamped orders and the listing count simply
 * belong to sellers with no shop. That was an assumption, not a measurement.
 * This script measures it: for every unstamped document it prints the seller's
 * shop, so the reason is on the record rather than inferred.
 */
import { db } from '@/firebase/server';

async function main() {
  const businesses = await db.collection('businesses').get();
  const ownedSellers = new Set(
    businesses.docs.map((d) => (d.data() as { ownerId?: string }).ownerId).filter(Boolean) as string[],
  );
  console.log(`businesses: ${businesses.size}, distinct owner sellers: ${ownedSellers.size}`);

  for (const col of ['products', 'orders']) {
    const snap = await db.collection(col).get();
    let stamped = 0;
    const unstamped: { id: string; sellerId: string; hasShop: boolean }[] = [];

    snap.forEach((d) => {
      const data = d.data() as Record<string, any>;
      if (data.businessId) stamped++;
      else unstamped.push({ id: d.id, sellerId: data.sellerId ?? '(none)', hasShop: false });
    });

    // Resolve whether each unstamped seller actually has a shop.
    for (const u of unstamped) {
      if (u.sellerId === '(none)') continue;
      u.hasShop = (await db.collection('sellerShops').doc(u.sellerId).get()).exists;
    }

    console.log(`\n${col}: ${snap.size} total, ${stamped} stamped, ${unstamped.length} unstamped`);
    for (const u of unstamped) {
      const owned = ownedSellers.has(u.sellerId);
      console.log(
        `  ${u.id.slice(0, 10).padEnd(12)} seller=${u.sellerId.slice(0, 12).padEnd(14)} ` +
          `hasShop=${u.hasShop ? 'yes' : 'no '} isBusinessOwner=${owned ? 'yes' : 'no'}`,
      );
    }
    const realGaps = unstamped.filter((u) => u.hasShop || ownedSellers.has(u.sellerId));
    console.log(
      realGaps.length === 0
        ? '  -> every unstamped document belongs to a NON-business seller. Correct.'
        : `  -> ${realGaps.length} belong to a business seller and SHOULD have been stamped.`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
