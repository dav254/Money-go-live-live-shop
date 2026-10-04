/**
 * BACKFILL BUSINESS LOCATIONS FROM EXISTING SHOP TEXT.
 *
 * Six businesses, none carrying a location, is the state this addresses. The
 * seller's shop form has always collected `county`, `subCounty`, `area` and
 * `cityTown` as free text, so most of the answer is already in the database —
 * it just is not in a shape Nearby can query.
 *
 * ## Why this refuses to guess
 *
 * "Mwiki / Kasarani / Nairobi" resolves cleanly to Kasarani, Nairobi. A blank
 * area does not. A seller who typed a town we have not seeded does not. Both are
 * left alone rather than defaulted to Nairobi, because a business pinned to the
 * wrong city produces confidently wrong "1.2 km away" results — the failure is
 * invisible and it is the customer's trust that pays for it.
 *
 * Default is a dry run. Pass `--apply` to write.
 */

import { db } from '../src/firebase/server';
import { resolveFreeTextPlace, hasNoResolvedPlace, placeLabel } from '../src/lib/locations/match';
import { buildBusinessLocation } from '../src/lib/business/location';

const APPLY = process.argv.includes('--apply');

async function main() {
  const bizSnap = await db.collection('businesses').get();
  const shopSnap = await db.collection('sellerShops').get();

  // The shop document's ID *is* the seller's uid — there is no `sellerId`
  // field on `sellerShops`. Keying on one that does not exist silently matches
  // nothing, which is exactly what the first dry run reported.
  const shopsByUid = new Map<string, any>();
  for (const d of shopSnap.docs) {
    shopsByUid.set(d.id, d.data() as any);
  }

  const plan: { id: string; name: string; label: string; on: string }[] = [];
  const skipped: { id: string; name: string; why: string }[] = [];

  for (const d of bizSnap.docs) {
    const biz = d.data() as any;
    if (biz.primaryLocation) {
      skipped.push({ id: d.id, name: biz.name, why: 'already has a location' });
      continue;
    }
    const ownerUid: string = biz.ownerId;
    const shop = shopsByUid.get(ownerUid);
    if (!shop) {
      skipped.push({ id: d.id, name: biz.name, why: 'no shop document' });
      continue;
    }

    const resolved = resolveFreeTextPlace({
      area: shop.area,
      subCounty: shop.subCounty,
      cityTown: shop.cityTown,
      county: shop.county,
      country: shop.country,
    });
    if (hasNoResolvedPlace(resolved)) {
      skipped.push({ id: d.id, name: biz.name, why: 'shop text matched nothing' });
      continue;
    }

    const { location, error } = buildBusinessLocation({ kind: biz.kind }, resolved);
    if (error || !location) {
      skipped.push({ id: d.id, name: biz.name, why: error || 'rejected' });
      continue;
    }

    plan.push({
      id: d.id,
      name: biz.name,
      label: placeLabel(resolved) || location.label,
      on: resolved.matchedOn || '?',
    });
  }

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${plan.length} to write, ${skipped.length} skipped\n`);
  for (const p of plan) {
    console.log(`  ${p.name.padEnd(24)} → ${p.label.padEnd(28)} (matched on: ${p.on})`);
  }
  console.log('');
  for (const s of skipped) {
    console.log(`  skip ${s.name.padEnd(24)} — ${s.why}`);
  }

  if (!APPLY) {
    console.log('\nNothing written. Re-run with --apply to write these.');
    return;
  }

  const batch = db.batch();
  for (const p of plan) {
    const biz = bizSnap.docs.find((d) => d.id === p.id)!.data() as any;
    const shop = shopsByUid.get(biz.ownerId);
    const resolved = resolveFreeTextPlace({
      area: shop.area,
      subCounty: shop.subCounty,
      cityTown: shop.cityTown,
      county: shop.county,
      country: shop.country,
    });
    const { location } = buildBusinessLocation({ kind: biz.kind }, resolved);
    batch.set(
      db.collection('businesses').doc(p.id),
      { primaryLocation: location, locationCount: 1 },
      { merge: true },
    );
  }
  await batch.commit();
  console.log(`\nWrote ${plan.length} locations.`);
}

/**
 * CLEAR INFERRED COVERAGE.
 *
 * The first version of this backfill filled `servesAreaIds` from each business's
 * own address lineage, which made a shop in Kasarani claim to serve the whole
 * country. No seller ever declared that, so it is removed rather than migrated.
 *
 * A business that HAS since declared coverage on the new screen keeps it — this
 * only clears the coverage this script itself generated, which is identifiable
 * because it is exactly the implied ancestry of the business's own location.
 */
async function clearInferredCoverage() {
  const snap = await db.collection('businesses').get();
  const batch = db.batch();
  let cleared = 0;

  for (const d of snap.docs) {
    const biz = d.data() as any;
    const loc = biz.primaryLocation;
    if (!loc?.areaId || !Array.isArray(loc.servesAreaIds)) continue;

    const own = [loc.areaId, loc.cityId, loc.countyId, loc.countryId].filter(Boolean);
    const derived =
      loc.servesAreaIds.length === own.length &&
      own.every((id) => loc.servesAreaIds.includes(id));
    if (!derived) continue;

    batch.set(d.ref, { primaryLocation: { ...loc, servesAreaIds: [] } }, { merge: true });
    cleared++;
  }

  if (cleared) {
    await batch.commit();
  }
  console.log(`Cleared inferred coverage on ${cleared} businesses.`);
}

main()
  .then(() => (APPLY ? clearInferredCoverage() : undefined))
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
