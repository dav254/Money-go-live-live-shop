/**
 * BUSINESS + LOCATION — the foundation everything else stands on.
 *
 * These are pure functions, so they are asserted exactly. The one that really
 * matters is `locationContains`: it decides whether a buyer is inside a
 * seller's service area, and the obvious implementation (a string prefix test)
 * has a bug that only shows up once a town is named like another town's
 * prefix.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const {
  SEED_LOCATIONS, locationById, locationAncestry, childrenOf,
  locationContains, locationName, RADIUS_PRESETS_KM,
} = require('../lib/locations/hierarchy.ts');

const {
  slugifyBusinessName, memberRole, canManage, isBusinessMember,
} = require('../lib/business/types.ts');

/* ----------------------------------------------------------- locations */

test('every seeded location has a parent that exists', () => {
  for (const l of SEED_LOCATIONS as { id: string; parentId?: string }[]) {
    if (l.parentId) {
      assert.ok(locationById(l.parentId), `${l.id} points at missing parent ${l.parentId}`);
    }
  }
});

test('ids are unique', () => {
  const ids = (SEED_LOCATIONS as { id: string }[]).map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate location id in the seed');
});

test('no cycle can make ancestry loop forever', () => {
  for (const l of SEED_LOCATIONS as { id: string }[]) {
    // The walk has a guard, so a cycle returns a short chain rather than
    // hanging. Assert it terminates and never repeats a node.
    const chain = locationAncestry(l.id);
    const seen = new Set(chain.map((n: { id: string }) => n.id));
    assert.equal(seen.size, chain.length, `ancestry of ${l.id} repeated a node`);
  }
});

test('ancestry walks country → county → city → area', () => {
  const chain = locationAncestry('ke.nairobi.nairobi.westlands').map((n: { level: string }) => n.level);
  assert.deepEqual(chain, ['country', 'county', 'city', 'area']);
  assert.equal(locationAncestry('ke.nairobi.nairobi.westlands')[0].name, 'Kenya');
});

test('the seed is not Nairobi-only', () => {
  // The spec was explicit: other Kenyan cities must work, not just Nairobi.
  const cities = (SEED_LOCATIONS as { id: string; level: string }[])
    .filter((l) => l.level === 'city')
    .map((l) => l.id);
  assert.ok(cities.length >= 4, `only ${cities.length} cities seeded`);
  assert.ok(cities.some((c: string) => c.includes('mombasa')));
  assert.ok(cities.some((c: string) => c.includes('kisumu')));
});

test('containment is by ancestry, not string prefix', () => {
  assert.equal(locationContains('ke.nairobi.nairobi', 'ke.nairobi.nairobi.westlands'), true);
  assert.equal(locationContains('ke.nairobi.nairobi.westlands', 'ke.nairobi.nairobi.westlands'), true);
  assert.equal(locationContains('ke.nairobi.nairobi.parklands', 'ke.nairobi.nairobi.westlands'), false);
  assert.equal(locationContains('ke', 'ke.nairobi.nairobi.westlands'), true);
  // The trap: a prefix test would wrongly say Westlands is inside Mombasa CBD.
  assert.equal(locationContains('ke.mombasa.mombasa.cbd', 'ke.nairobi.nairobi.westlands'), false);
  assert.equal(locationContains('ke.nairobi.nairobi.cbd', 'ke.nairobi.nairobi.cbd'), true);
  // And the reverse trap: a county id is a prefix of no city's id.
  assert.equal(locationContains('ke.nairobi', 'ke.nairobishere'), false);
});

test('containment is safe with missing input', () => {
  assert.equal(locationContains(null, 'ke'), false);
  assert.equal(locationContains('ke', null), false);
  assert.equal(locationContains(undefined, undefined), false);
  assert.equal(locationContains('ke.does-not-exist', 'ke'), false);
});

test('children are addressable from any level', () => {
  assert.ok(childrenOf('ke.nairobi').length >= 1);
  assert.ok(childrenOf('ke').length >= 4, 'Kenya should have several counties');
  assert.equal(childrenOf('ke.nairobi.nairobi.westlands').length, 0, 'an area has no children');
});

test('radius presets match the spec', () => {
  assert.deepEqual([...RADIUS_PRESETS_KM], [1, 3, 5, 10, 25]);
});

test('an unknown id never renders as blank', () => {
  assert.equal(locationName('ke.nairobi.nairobi.westlands'), 'Westlands');
  assert.equal(locationName('nowhere'), 'Kenya', 'must fall back, not show empty');
});

/* ------------------------------------------------------------ business */

test('slugs are url-safe and stable', () => {
  assert.equal(slugifyBusinessName("Jane's Tailoring"), 'jane-s-tailoring');
  assert.equal(slugifyBusinessName('  Maasai   Craft  House '), 'maasai-craft-house');
  assert.equal(slugifyBusinessName('!!!'), '');
});

test('accents fold rather than vanish', () => {
  // Stripping instead of folding loses letters AND makes "Cafe Services" and
  // "Café Services" fight over one URL.
  assert.equal(slugifyBusinessName('Café Services'), 'cafe-services');
  assert.equal(slugifyBusinessName('Électro Ltd'), 'electro-ltd');
  assert.equal(
    slugifyBusinessName('Café Services'),
    slugifyBusinessName('Cafe Services'),
    'an accent must not change the slug',
  );
});

test('a truncated slug never ends in a hyphen', () => {
  const long = 'Maasai Craft House And Then Some Very Long Trading Name Indeed';
  const slug = slugifyBusinessName(long);
  assert.ok(slug.length <= 60, `slug is ${slug.length} chars`);
  assert.ok(!slug.endsWith('-'), 'a cut mid-word would leave a trailing hyphen');
});

test('membership decides who can manage', () => {
  const members = [
    { uid: 'u1', role: 'owner' as const },
    { uid: 'u2', role: 'manager' as const },
    { uid: 'u3', role: 'staff' as const },
  ];
  assert.equal(memberRole(members, 'u2'), 'manager');
  assert.equal(memberRole(members, 'u9'), null);
  assert.equal(memberRole(undefined, 'u1'), null, 'no members means nobody manages');
  assert.equal(canManage(members, 'u1'), true);
  assert.equal(canManage(members, 'u2'), true);
  assert.equal(canManage(members, 'u3'), false, 'staff must not manage the business');
  assert.equal(canManage(members, null), false);
  assert.equal(isBusinessMember(members, 'u3'), true);
});

test('one person can belong to several businesses', () => {
  // The whole reason a Business is not a Seller: membership is per business,
  // so the same uid appearing in two lists is normal, not a conflict.
  const a = [{ uid: 'u1', role: 'owner' as const }];
  const b = [{ uid: 'u1', role: 'manager' as const }];
  assert.equal(isBusinessMember(a, 'u1'), true);
  assert.equal(isBusinessMember(b, 'u1'), true);
  assert.notEqual(a, b);
});
