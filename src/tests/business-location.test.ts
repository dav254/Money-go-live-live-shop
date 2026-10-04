/**
 * LOCATION RESOLUTION AND PRIVACY.
 *
 * These tests pin the failures that do not crash. A business pinned to the
 * wrong city still renders, still returns results, and is confidently wrong to
 * a customer standing in the right one — so the assertions here are about
 * REFUSING to produce a location, not about producing a right one.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalisePlaceName,
  resolveFreeTextPlace,
  hasNoResolvedPlace,
  placeLabel,
  impliedServedIds,
} from '../lib/locations/match';
import {
  buildBusinessLocation,
  distanceKmBetween,
  servesArea,
  approximateLocationFor,
  impliedCoverageIds,
  formatDistance,
  MAX_SERVICE_RADIUS_KM,
} from '../lib/business/location';

describe('normalisePlaceName', () => {
  it('drops the level words so "Nairobi County" matches "Nairobi"', () => {
    assert.equal(normalisePlaceName('Nairobi County'), 'nairobi');
    assert.equal(normalisePlaceName('nairobi'), 'nairobi');
  });

  it('folds accents instead of dropping letters', () => {
    assert.equal(normalisePlaceName('Kilimé'), 'kilime');
    assert.ok(normalisePlaceName('Kilimé').includes('k'));
  });
});

describe('resolveFreeTextPlace', () => {
  it('resolves the real shop text: Mwiki / Kasarani / Nairobi', () => {
    const r = resolveFreeTextPlace({
      area: 'Mwiki',
      subCounty: 'Kasarani',
      county: 'Nairobi',
    });
    assert.equal(r.areaId, 'ke.nairobi.nairobi.kasarani');
    assert.equal(r.cityId, 'ke.nairobi.nairobi');
    assert.equal(r.countyId, 'ke.nairobi');
    assert.equal(r.countryId, 'ke');
  });

  it('prefers the narrowest field it can recognise', () => {
    // "Nairobi" alone would give the city; "Kasarani" is the better answer.
    const r = resolveFreeTextPlace({ area: 'Kasarani', cityTown: 'Nairobi' });
    assert.equal(r.matchedOn, 'area');
    assert.equal(r.areaId, 'ke.nairobi.nairobi.kasarani');
  });

  it('returns nothing for text it does not know, rather than defaulting to Kenya', () => {
    const r = resolveFreeTextPlace({ area: 'Kijabe', cityTown: 'Kijabe' });
    assert.equal(hasNoResolvedPlace(r), true);
  });

  it('never returns an area that contradicts the city', () => {
    // Kasarani is in Nairobi, not Mombasa. The tree wins over the text.
    const r = resolveFreeTextPlace({ area: 'Nyali', cityTown: 'Mombasa' });
    assert.equal(r.areaId, 'ke.mombasa.mombasa.nyali');
    assert.equal(r.cityId, 'ke.mombasa.mombasa');
    assert.notEqual(r.cityId, 'ke.nairobi.nairobi');
  });

  it('is not fooled by an empty-string field', () => {
    const r = resolveFreeTextPlace({ area: '', subCounty: '', cityTown: '', county: '' });
    assert.equal(hasNoResolvedPlace(r), true);
  });
});

describe('impliedServedIds', () => {
  it('an area implies its city, county and country', () => {
    const ids = impliedServedIds({ areaId: 'ke.nairobi.nairobi.westlands' });
    assert.ok(ids.includes('ke.nairobi.nairobi.westlands'));
    assert.ok(ids.includes('ke.nairobi.nairobi'));
    assert.ok(ids.includes('ke.nairobi'));
    assert.ok(ids.includes('ke'));
  });

  it('a country alone covers one id, not the world', () => {
    assert.deepEqual(impliedServedIds({ countryId: 'ke' }), ['ke']);
  });

  it('nothing in, nothing out', () => {
    assert.deepEqual(impliedServedIds({}), []);
  });
});

describe('buildBusinessLocation', () => {
  it('refuses a location with no place at all', () => {
    const { location, error } = buildBusinessLocation({});
    assert.equal(location, undefined);
    assert.ok(error);
  });

  it('REJECTS an area that is not inside the chosen city', () => {
    // Kasarani is in Nairobi. Silently keeping it would put a Nairobi shop on a
    // Mombasa map, which is a wrong answer that still renders.
    const { location, error } = buildBusinessLocation({
      areaId: 'ke.nairobi.nairobi.kasarani',
      cityId: 'ke.mombasa.mombasa',
    });
    assert.equal(location, undefined);
    assert.match(String(error), /not in/i);
  });

  it('rejects a half-supplied coordinate pair', () => {
    const { location, error } = buildBusinessLocation({
      areaId: 'ke.nairobi.nairobi.westlands',
      lat: -1.28,
    });
    assert.equal(location, undefined);
    assert.match(String(error), /latitude and a longitude/i);
  });

  it('rejects coordinates that are not a real point', () => {
    const { location } = buildBusinessLocation({
      areaId: 'ke.nairobi.nairobi.westlands',
      lat: 999,
      lng: 999,
    });
    assert.equal(location, undefined);
  });

  it('DROPS coordinates for a home-based business even if the client sends them', () => {
    // This is the privacy rule, and it is enforced server-side rather than
    // trusted to the screen that collects the number.
    const { location } = buildBusinessLocation(
      { areaId: 'ke.nairobi.nairobi.westlands', lat: -1.286, lng: 36.817, kind: 'home_based' },
      {},
    );
    assert.ok(location);
    assert.equal(location?.lat, undefined);
    assert.equal(location?.lng, undefined);
    assert.equal(location?.publicPrecision, 'area_only');
  });

  it('keeps coordinates for a physical store', () => {
    const { location } = buildBusinessLocation(
      { areaId: 'ke.nairobi.nairobi.westlands', lat: -1.286, lng: 36.817, kind: 'physical_store' },
      {},
    );
    assert.equal(location?.publicPrecision, 'exact');
    assert.equal(location?.lat, -1.286);
  });

  it('is area_only whenever there is no point, whatever the kind', () => {
    const { location } = buildBusinessLocation(
      { areaId: 'ke.nairobi.nairobi.westlands', kind: 'physical_store' },
      {},
    );
    assert.equal(location?.publicPrecision, 'area_only');
  });

  it('rejects a radius beyond the maximum', () => {
    const { location } = buildBusinessLocation(
      { areaId: 'ke.nairobi.nairobi.westlands', serviceRadiusKm: MAX_SERVICE_RADIUS_KM + 1 },
      {},
    );
    assert.equal(location, undefined);
  });

  it('starts with NO declared coverage — saving an area is not a coverage claim', () => {
    const { location } = buildBusinessLocation(
      { areaId: 'ke.nairobi.nairobi.westlands' },
      {},
    );
    assert.deepEqual(location?.servesAreaIds, [],
      'coverage must be declared by the seller, never inferred from their address');
  });
});

describe('distanceKmBetween', () => {
  it('is zero for the same point', () => {
    assert.equal(distanceKmBetween({ lat: -1.286, lng: 36.817 }, { lat: -1.286, lng: 36.817 }), 0);
  });

  it('is null when either point is unknown — never a fake zero', () => {
    assert.equal(distanceKmBetween({ lat: -1.286, lng: 36.817 }, {}), null);
    assert.equal(distanceKmBetween(null, { lat: 0, lng: 0 }), null);
  });

  it('Westlands to Kilimani is a plausible local distance', () => {
    const km = distanceKmBetween(
      { lat: -1.2864, lng: 36.8172 },
      { lat: -1.2690, lng: 36.8078 },
    );
    assert.ok(km !== null);
    assert.ok(km! > 0.5 && km! < 10, `expected a local distance, got ${km}`);
  });

  it('Nairobi to Mombasa is hundreds of kilometres, not a rounding error', () => {
    const km = distanceKmBetween({ lat: -1.2921, lng: 36.8219 }, { lat: -4.0435, lng: 39.6682 });
    assert.ok(km! > 400 && km! < 500, `expected ~480 km, got ${km}`);
  });
});

describe('servesArea', () => {
  const westlands = {
    id: 'primary', label: 'Base', isPrimary: true,
    areaId: 'ke.nairobi.nairobi.westlands',
    servesAreaIds: [] as string[],
    publicPrecision: 'area_only' as const,
  };

  it('serves its own area', () => {
    assert.equal(servesArea(westlands, 'ke.nairobi.nairobi.westlands'), true);
  });

  it('does NOT cover a neighbouring area it never declared', () => {
    // Being in Westlands is not a claim to serve Kilimani. Coverage is
    // declared; an inferred one hands businesses work nobody agreed to.
    assert.equal(servesArea(westlands, 'ke.nairobi.nairobi.kilimani'), false);
  });

  it('a declared city DOES cover the areas inside it', () => {
    const nairobiWide = { ...westlands, servesAreaIds: ['ke.nairobi.nairobi'] };
    assert.equal(servesArea(nairobiWide, 'ke.nairobi.nairobi.westlands'), true);
    assert.equal(servesArea(nairobiWide, 'ke.nairobi.nairobi.kilimani'), true);
  });

  it('does NOT serve an area in another city it never declared', () => {
    assert.equal(servesArea(westlands, 'ke.mombasa.mombasa.nyali'), false);
  });

  it('a declared country DOES reach every area under it', () => {
    // Declaring "Kenya" is a real claim to serve all of Kenya, so a Mombasa
    // buyer is inside it. The hierarchy cuts both ways — it is what makes
    // "I only want customers within 5 km" and "I want Kenya" both work.
    const kenyaWide = { ...westlands, servesAreaIds: ['ke'] };
    assert.equal(servesArea(kenyaWide, 'ke.mombasa.mombasa.nyali'), true);
    assert.equal(servesArea(kenyaWide, 'ke.kisumu.kisumu.cbd'), true);
  });

  it('but a declared city does NOT leak into a sibling city', () => {
    const nairobiWide = { ...westlands, servesAreaIds: ['ke.nairobi.nairobi'] };
    assert.equal(servesArea(nairobiWide, 'ke.nairobi.nairobi.westlands'), true);
    assert.equal(servesArea(nairobiWide, 'ke.mombasa.mombasa.nyali'), false);
    assert.equal(servesArea(nairobiWide, 'ke.nairobi.mombasa.cbd'), false,
      'Mombasa CBD is not under Nairobi');
  });

  it('an unset area serves nothing rather than everyone', () => {
    // The dangerous default: a missing value that reads as "all" would make
    // every business match every buyer.
    assert.equal(servesArea(undefined, 'ke.nairobi.nairobi.westlands'), false);
    assert.equal(servesArea({ ...westlands, areaId: undefined }, 'ke.nairobi.nairobi.westlands'), false);
  });

  it('needs an area to test against', () => {
    assert.equal(servesArea(westlands, null), false);
  });
});

describe('impliedCoverageIds', () => {
  it('shows a seller what one answer reaches, for display only', () => {
    const ids = impliedCoverageIds({
      id: 'primary', label: 'Base', isPrimary: true,
      areaId: 'ke.nairobi.nairobi.westlands',
      publicPrecision: 'area_only',
    });
    assert.ok(ids.includes('ke.nairobi.nairobi'));
    assert.ok(ids.includes('ke.nairobi'));
  });

  it('is empty for a business with no location', () => {
    assert.deepEqual(impliedCoverageIds(null), []);
  });
});

describe('approximateLocationFor', () => {
  const loc = {
    id: 'primary', label: 'Base', isPrimary: true,
    areaName: 'Westlands',
    publicPrecision: 'exact' as const,
  };

  it('shows area and distance together', () => {
    assert.equal(approximateLocationFor(loc, 2.1), 'Westlands · 2.1 km away');
  });

  it('never invents a distance it does not have', () => {
    assert.equal(approximateLocationFor(loc, null), 'Westlands');
    assert.equal(approximateLocationFor(loc, undefined), 'Westlands');
  });

  it('shows nothing for a business with no location', () => {
    assert.equal(approximateLocationFor(null), undefined);
  });
});

describe('formatDistance', () => {
  it('uses metres under a kilometre and kilometres above', () => {
    assert.equal(formatDistance(0.4), '400 m');
    assert.equal(formatDistance(2.14), '2.1 km');
  });
});

describe('placeLabel', () => {
  it('runs from most specific to least, dropping empties', () => {
    assert.equal(placeLabel({ areaName: 'Westlands', cityName: 'Nairobi' }), 'Westlands, Nairobi');
  });

  it('falls back to the county when nothing deeper is known', () => {
    assert.equal(placeLabel({ countyName: 'Mombasa County' }), 'Mombasa County');
  });
});
