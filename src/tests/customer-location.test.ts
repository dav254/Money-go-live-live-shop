/**
 * CUSTOMER LOCATION — WORLDWIDE, AND PRIVATE.
 *
 * Two things this file exists to pin:
 *
 *   1. **No country limit.** A customer outside every seeded market must still
 *      get a working location, not an error and not a nearest-row guess.
 *   2. **No coordinate leak.** A business must never be able to obtain a
 *      customer's position at any precision.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm, isValidPoint, locationFor, nearestSeedLocation } from '../lib/locations/geo';
import {
  customerLocationFromLabel,
  customerLocationFromPoint,
  customerLocationFromTreeId,
  customerLocationLabel,
  customerMatchesBusiness,
  customerToBusinessDistanceKm,
  hasUsableCustomerLocation,
  publicCustomerLocation,
} from '../lib/locations/customer';

/* Real coordinates: Nairobi, Mombasa, Lagos, London, Vancouver. */
const NAIROBI = { lat: -1.2864, lng: 36.8172 };   // Westlands
const MOMBASA = { lat: -4.0435, lng: 39.6682 };
const LAGOS = { lat: 6.5244, lng: 3.3792 };
const LONDON = { lat: 51.5074, lng: -0.1278 };
const VANCOUVER = { lat: 49.2827, lng: -123.1207 };

describe('isValidPoint', () => {
  it('accepts a real point anywhere on earth', () => {
    assert.equal(isValidPoint(LAGOS), true);
    assert.equal(isValidPoint({ lat: -89.9, lng: 179.9 }), true);
  });

  it('rejects the classic bad payloads', () => {
    assert.equal(isValidPoint({ lat: 0, lng: 0 }) === true, true, '0,0 is technically a real point');
    assert.equal(isValidPoint({ lat: 91, lng: 0 }), false);
    assert.equal(isValidPoint({ lat: 0, lng: 181 }), false);
    assert.equal(isValidPoint({ lat: NaN, lng: 0 }), false);
    assert.equal(isValidPoint({ lat: '1', lng: '2' }), false);
    assert.equal(isValidPoint(null), false);
    assert.equal(isValidPoint(undefined), false);
  });
});

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    assert.equal(distanceKm(NAIROBI, NAIROBI), 0);
  });

  it('Nairobi to Mombasa is about 440 km', () => {
    const km = distanceKm(NAIROBI, MOMBASA);
    assert.ok(km > 380 && km < 500, `expected ~440 km, got ${km}`);
  });

  it('is symmetric', () => {
    assert.equal(distanceKm(NAIROBI, LONDON), distanceKm(LONDON, NAIROBI));
  });
});

describe('locationFor', () => {
  it('resolves Westlands to Westlands, not merely to Kenya', () => {
    const hit = locationFor(NAIROBI);
    assert.equal(hit.node?.id, 'ke.nairobi.nairobi.westlands');
  });

  it('resolves a Nairobi point with no seeded area to the city', () => {
    // A point north of the seeded areas — still Nairobi.
    const hit = locationFor({ lat: -1.22, lng: 36.9 });
    assert.ok(hit.node, 'should resolve to something');
    assert.ok(['area', 'city', 'county'].includes(hit.node!.level));
  });

  it('resolves Mombasa to Mombasa, not to a Nairobi row', () => {
    const hit = locationFor(MOMBASA);
    assert.ok(hit.node?.id.startsWith('ke.mombasa'), `got ${hit.node?.id}`);
  });

  it('resolves a CBD whose centroid EQUALS its county to the AREA, not the county', () => {
    // Mombasa CBD, Mombasa and Mombasa County all sit on one point. Without a
    // level filter the county wins the tie (it comes first in the seed list)
    // and "Mombasa CBD" silently becomes unreachable — a customer standing in
    // the CBD gets labelled "Mombasa County".
    assert.equal(locationFor(MOMBASA).node?.id, 'ke.mombasa.mombasa.cbd');

    const nakuruCbd = { lat: -0.3031, lng: 36.08 };
    assert.equal(locationFor(nakuruCbd).node?.id, 'ke.nakuru.nakuru.nakuru-cbd');
  });

  it('still falls UP the levels when there is genuinely no area', () => {
    // Open country north-west of the seeded areas: past every area (45 km),
    // but inside a city's threshold (120 km). The honest answer is the city,
    // not an invented area.
    const rural = locationFor({ lat: -1.6, lng: 36.3 });
    assert.equal(rural.node?.level, 'city');
    assert.equal(rural.node?.id, 'ke.nairobi.nairobi');
  });

  it('falls all the way to the county when no city is close either', () => {
    // Measured, not guessed: the nearest city here (Kiambu) is 291 km away,
    // past the 120 km city threshold, but inside the 300 km county one.
    const rural = locationFor({ lat: 1.0, lng: 38.5 });
    assert.equal(rural.node?.id, 'ke.kiambu');
  });

  it('falls all the way to the country when nothing is close at all', () => {
    // ~286 km from the nearest seeded county.
    const far = locationFor({ lat: 2.0, lng: 39.5 });
    assert.equal(far.node?.id, 'ke');
  });

  it('REFUSES to name a place for a customer in another country', () => {
    // This is the important one. The nearest seeded row is Kenya, ~4,000 km
    // away. Naming it would show a Lagos customer businesses 4,000 km away and
    // they could not tell the answer was wrong.
    assert.equal(locationFor(LAGOS).node, null);
    assert.equal(locationFor(LONDON).node, null);
    assert.equal(locationFor(VANCOUVER).node, null);
  });

  it('still reports how far the nearest row was, for diagnostics', () => {
    const hit = locationFor(LAGOS);
    assert.ok(hit.distanceKm !== null && hit.distanceKm > 3000);
  });
});

describe('nearestSeedLocation', () => {
  it('honours an explicit maximum distance', () => {
    assert.equal(nearestSeedLocation(LONDON, 50).node, null);
    assert.ok(nearestSeedLocation(NAIROBI, 50).node);
  });

  it('only returns a node at the requested level', () => {
    assert.equal(nearestSeedLocation(MOMBASA, 1000, 'area')?.node?.level, 'area');
    assert.equal(nearestSeedLocation(MOMBASA, 1000, 'county')?.node?.level, 'county');
  });
});

describe('customerLocationFromPoint', () => {
  it('names a seeded location and keeps coarse coordinates', () => {
    const loc = customerLocationFromPoint(NAIROBI);
    assert.equal(loc?.areaId, 'ke.nairobi.nairobi.westlands');
    assert.equal(loc?.areaName, 'Westlands');
    assert.equal(loc?.source, 'gps');
    assert.ok(typeof loc?.lat === 'number');
  });

  it('gives an unmapped customer a location with no tree ids', () => {
    const loc = customerLocationFromPoint(LAGOS);
    assert.ok(loc, 'an unmapped customer still HAS a location');
    assert.equal(loc?.areaId, undefined);
    assert.equal(loc?.cityId, undefined);
    assert.ok(typeof loc?.lat === 'number' && typeof loc?.lng === 'number');
    assert.equal(hasUsableCustomerLocation(loc), true, 'still usable for distance ranking');
  });

  it('rejects a nonsense coordinate outright', () => {
    assert.equal(customerLocationFromPoint({ lat: 999, lng: 999 }), null);
  });

  it('rounds coordinates rather than storing full precision', () => {
    const loc = customerLocationFromPoint({ lat: -1.28641234567, lng: 36.81729876543 });
    assert.equal(loc?.lat, -1.28641);
    assert.equal(loc?.lng, 36.8173);
  });
});

describe('customerLocationFromTreeId', () => {
  it('fills the whole chain from an area id', () => {
    const loc = customerLocationFromTreeId('ke.nairobi.nairobi.kilimani');
    assert.equal(loc?.areaName, 'Kilimani');
    assert.equal(loc?.cityName, 'Nairobi');
    assert.equal(loc?.countryName, 'Kenya');
    assert.equal(loc?.source, 'manual_tree');
  });

  it('returns null for an id we do not have', () => {
    assert.equal(customerLocationFromTreeId('x.y.z'), null);
  });
});

describe('customerLocationFromLabel', () => {
  it('accepts a town we have no row for', () => {
    const loc = customerLocationFromLabel('Kampala');
    assert.equal(loc?.label, 'Kampala');
    assert.equal(hasUsableCustomerLocation(loc), false, 'a name alone is not enough to rank by');
    assert.equal(customerLocationLabel(loc), 'Kampala');
  });

  it('keeps coordinates alongside the typed name when it has them', () => {
    const loc = customerLocationFromLabel('Kampala', { lat: 0.3476, lng: 32.5825 });
    assert.equal(hasUsableCustomerLocation(loc), true);
    assert.equal(loc?.label, 'Kampala');
  });

  it('refuses an empty label', () => {
    assert.equal(customerLocationFromLabel('   '), null);
  });

  it('rejects an invalid coordinate rather than storing it', () => {
    assert.equal(customerLocationFromLabel('Kampala', { lat: 500, lng: 500 }), null);
  });

  it('truncates an absurd label', () => {
    assert.equal(customerLocationFromLabel('x'.repeat(500))?.label?.length, 80);
  });
});

describe('customerLocationLabel', () => {
  it('prefers the most specific real name', () => {
    const loc = customerLocationFromPoint(NAIROBI);
    assert.equal(customerLocationLabel(loc), 'Westlands, Nairobi');
  });

  it('falls back to the typed name, then to coordinates', () => {
    assert.equal(customerLocationLabel({ source: 'manual_label', label: 'Kampala' }), 'Kampala');
    assert.match(customerLocationLabel({ source: 'gps', lat: 6.52, lng: 3.38 }), /°/);
  });

  it('says so when nothing is set', () => {
    assert.equal(customerLocationLabel(null), 'Location not set');
  });
});

describe('publicCustomerLocation — the privacy boundary', () => {
  it('never includes coordinates, even for a GPS customer', () => {
    const loc = customerLocationFromPoint(NAIROBI);
    const pub = publicCustomerLocation(loc);
    assert.equal('lat' in pub, false);
    assert.equal('lng' in pub, false);
    assert.equal(JSON.stringify(pub).includes('-1.286'), false);
  });

  it('gives a business the area, which is what the customer already says aloud', () => {
    const pub = publicCustomerLocation(customerLocationFromPoint(NAIROBI));
    assert.equal(pub.area, 'Westlands');
    assert.equal(pub.city, 'Nairobi');
    assert.equal(pub.precision, 'area');
  });

  it('tells the business nothing at all for an unmapped customer', () => {
    // Coordinates exist, but a business learns nothing from them.
    const pub = publicCustomerLocation(customerLocationFromPoint(LAGOS));
    assert.equal(pub.precision, 'none');
    assert.equal(pub.area, undefined);
    assert.equal(pub.city, undefined);
  });

  it('passes a typed town name through as a city', () => {
    const pub = publicCustomerLocation({ source: 'manual_label', label: 'Kampala' });
    assert.equal(pub.city, 'Kampala');
  });
});

describe('customerMatchesBusiness — coverage, not proximity', () => {
  const kasarani = {
    areaId: 'ke.nairobi.nairobi.kasarani',
    cityId: 'ke.nairobi.nairobi',
    servesAreaIds: ['ke.nairobi.nairobi'],
  };

  it('matches a customer inside the declared area', () => {
    const customer = customerLocationFromPoint({ lat: -1.25, lng: 36.85 });
    assert.equal(customerMatchesBusiness(customer, kasarani), true);
  });

  it('does NOT match a customer in another city, however close the shop', () => {
    const customer = customerLocationFromPoint(MOMBASA);
    assert.equal(customerMatchesBusiness(customer, kasarani), false,
      'proximity is not relevance');
  });

  it('does NOT match a business with no coverage at all', () => {
    const customer = customerLocationFromPoint(NAIROBI);
    assert.equal(customerMatchesBusiness(customer, { areaId: undefined, servesAreaIds: [] }), false);
  });

  it('applies a declared radius on top of declared coverage', () => {
    const customer = customerLocationFromPoint(NAIROBI);
    const wide = { ...kasarani, lat: -1.25, lng: 36.85, serviceRadiusKm: 50 };
    const tight = { ...kasarani, lat: -1.25, lng: 36.85, serviceRadiusKm: 1 };
    assert.equal(customerMatchesBusiness(customer, wide), true);
    assert.equal(customerMatchesBusiness(customer, tight), false);
  });

  it('keeps coverage when there are no coordinates to measure the radius with', () => {
    const customer = customerLocationFromPoint(NAIROBI);
    const noPoint = { ...kasarani, serviceRadiusKm: 5 };
    assert.equal(customerMatchesBusiness(customer, noPoint), true,
      'no coordinates is not evidence of being too far');
  });

  it('matches nobody when either side is missing', () => {
    assert.equal(customerMatchesBusiness(null, kasarani), false);
    assert.equal(customerMatchesBusiness(customerLocationFromPoint(NAIROBI), null), false);
  });
});

describe('customerToBusinessDistanceKm', () => {
  it('measures between two real points', () => {
    const km = customerToBusinessDistanceKm(
      customerLocationFromPoint(NAIROBI),
      { lat: -1.269, lng: 36.8078 },
    );
    assert.ok(km !== null && km > 0.5 && km < 10);
  });

  it('is null — never zero — when the business has no point', () => {
    assert.equal(
      customerToBusinessDistanceKm(customerLocationFromPoint(NAIROBI), { lat: undefined, lng: undefined }),
      null,
    );
  });
});
