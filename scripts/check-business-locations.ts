/**
 * WHAT NEARBY ACTUALLY HAS TO WORK WITH.
 *
 * I claimed the six businesses are "spread across the country" without
 * measuring it. This reads what location data they genuinely carry, because
 * Nearby cannot rank by distance against businesses with no coordinates.
 */
import { db } from '@/firebase/server';

async function main() {
  const snap = await db.collection('businesses').get();
  console.log(`businesses: ${snap.size}\n`);

  let withArea = 0;
  let withCoords = 0;
  let withRadius = 0;
  let withKind = 0;

  for (const d of snap.docs) {
    const b = d.data() as Record<string, any>;
    const loc = b.primaryLocation as Record<string, any> | undefined;

    const area = loc?.areaId || loc?.areaName || loc?.cityName || loc?.countyName || null;
    const hasCoords = typeof loc?.lat === 'number' && typeof loc?.lng === 'number';
    const hasRadius = typeof loc?.serviceRadiusKm === 'number';

    if (area) withArea++;
    if (hasCoords) withCoords++;
    if (hasRadius) withRadius++;
    if (b.kind) withKind++;

    console.log(
      `  ${d.id.padEnd(26)} kind=${String(b.kind ?? '(unset)').padEnd(16)} ` +
        `area=${String(area ?? '(none)').padEnd(14)} coords=${hasCoords ? 'yes' : 'NO '} radius=${hasRadius ? 'yes' : 'NO '}`,
    );
  }

  console.log(
    `\nwith an area:     ${withArea}/${snap.size}` +
      `\nwith coordinates: ${withCoords}/${snap.size}` +
      `\nwith a radius:    ${withRadius}/${snap.size}`,
  );

  if (withCoords === 0) {
    console.log(
      '\n=> NO business carries coordinates. Distance ranking cannot run yet.\n' +
        '   Nearby can still fall back to area-name matching, but real "1.2 km"\n' +
        '   needs a location capture step on the business profile.',
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
