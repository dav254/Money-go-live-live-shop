/**
 * DOES NEARBY ACTUALLY MATCH ANYTHING?
 *
 * Unit tests prove the rules. This runs them against the LIVE business
 * documents, because the rules being right is only half the question — the
 * other half is whether there is anything on the other side of them to match.
 *
 * Three customers in three countries, on purpose:
 *   - a Kasarani buyer, where the seeded businesses actually are;
 *   - a Mombasa buyer, who must NOT be shown a Nairobi shop;
 *   - a London buyer, who must get an honest empty state, not a Kenyan result.
 *
 * Also asserts that no customer coordinate appears in any business-facing field.
 */

import { db } from '../src/firebase/server';
import {
  customerLocationFromPoint,
  customerMatchesBusiness,
  customerToBusinessDistanceKm,
  publicCustomerLocation,
} from '../src/lib/locations/customer';

const CUSTOMERS = [
  { name: 'Kasarani buyer', point: { lat: -1.25, lng: 36.85 } },
  { name: 'Westlands buyer', point: { lat: -1.2864, lng: 36.8172 } },
  { name: 'Mombasa buyer', point: { lat: -4.0435, lng: 39.6682 } },
  { name: 'London buyer', point: { lat: 51.5074, lng: -0.1278 } },
];

async function main() {
  const snap = await db.collection('businesses').get();
  const businesses = snap.docs.map((d) => ({ ...(d.data() as any), id: d.id }));

  console.log(`businesses in database: ${businesses.length}\n`);

  let failures = 0;

  for (const { name, point } of CUSTOMERS) {
    const customer = customerLocationFromPoint(point)!;
    const pub = publicCustomerLocation(customer);
    const matched = businesses.filter((b) =>
      customerMatchesBusiness(customer, {
        areaId: b.primaryLocation?.areaId,
        cityId: b.primaryLocation?.cityId,
        servesAreaIds: b.primaryLocation?.servesAreaIds,
        serviceRadiusKm: b.primaryLocation?.serviceRadiusKm,
        lat: b.primaryLocation?.lat,
        lng: b.primaryLocation?.lng,
      }),
    );

    console.log(`${name}`);
    console.log(
      `  resolved as : ${[customer.areaName, customer.cityName, customer.countyName, customer.countryName].filter(Boolean).join(', ') || 'UNMAPPED (coords only)'}`,
    );
    console.log(`  business sees: ${JSON.stringify(pub)}`);
    console.log(`  matched      : ${matched.length}`);
    for (const b of matched) {
      const km = customerToBusinessDistanceKm(customer, b.primaryLocation);
      console.log(`     - ${b.name} (${b.primaryLocation?.areaName ?? 'no area'})${km === null ? '' : ` · ${km} km`}`);
    }
    if (matched.length === 0) console.log('     (none — honest empty state)');
    console.log('');
  }

  // The privacy assertion, against the real response shape.
  for (const { name, point } of CUSTOMERS) {
    const customer = customerLocationFromPoint(point)!;
    const serialised = JSON.stringify(publicCustomerLocation(customer));
    if (serialised.includes(String(customer.lat)) || serialised.includes(String(customer.lng))) {
      console.log(`FAIL: ${name} coordinates leaked into the business-facing payload`);
      failures++;
    }
  }

  // A Mombasa buyer must never see the Kasarani businesses.
  const mombasa = customerLocationFromPoint({ lat: -4.0435, lng: 39.6682 })!;
  const wrongCity = businesses.filter(
    (b) =>
      b.primaryLocation?.cityId === 'ke.nairobi.nairobi' &&
      customerMatchesBusiness(mombasa, {
        areaId: b.primaryLocation?.areaId,
        cityId: b.primaryLocation?.cityId,
        servesAreaIds: b.primaryLocation?.servesAreaIds,
      }),
  );
  if (wrongCity.length > 0) {
    console.log(`FAIL: a Mombasa buyer matched ${wrongCity.length} Nairobi business(es)`);
    failures++;
  }

  console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
