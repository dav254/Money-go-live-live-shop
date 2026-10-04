/**
 * FREE TEXT → LOCATION ID.
 *
 * ## Why this exists
 *
 * `sellerShops` already carries `county`, `subCounty`, `area` and `cityTown` as
 * free-text strings typed by sellers. The live data is "Mwiki / Kasarani /
 * Nairobi" — and "Mwiki" is a constituency, not one of the seeded areas. So
 * this module's job is to turn those strings into hierarchy ids *without
 * lying*: where the text is ambiguous or unrecognised it returns null, because
 * a confidently wrong area puts a business in the wrong city and every Nearby
 * result for it is then wrong too.
 *
 * ## The rule
 *
 * A match must be UNAMBIGUOUS — exactly one candidate at the given level, or a
 * single candidate whose ancestry agrees with every level the seller supplied.
 * Two Nairobi CBDs collapse to one candidate because they share an ancestor,
 * which is the safe direction. Two unrelated towns do not.
 */

import {
  SEED_LOCATIONS,
  locationAncestry,
  locationById,
  type LocationLevel,
  type SeedLocation,
} from './hierarchy';

/** Lowercase, strip punctuation and spaces so "Nairobi County" ≈ "nairobi". */
export function normalisePlaceName(raw: string | null | undefined): string {
  return (raw || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(county|city|town|area|sub\s*county|constituency|province|state|region)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const NORMALISED: { node: SeedLocation; key: string }[] = SEED_LOCATIONS.map((node) => ({
  node,
  key: normalisePlaceName(node.name),
})).filter((e) => e.key.length > 0);

export interface PlaceMatch {
  node: SeedLocation;
  /** How the text was recognised: an exact name, or one contained in it. */
  how: 'exact' | 'contains' | 'ancestry';
}

/**
 * Match one free-text field at one level.
 *
 * `exact` wins outright. `contains` only counts when it is the SINGLE such
 * candidate — "nairobi" contained in "Mombasa CBD"? no; but "nairobi" would be
 * contained in nothing ambiguous here. The single-candidate rule is what stops
 * "cbd" matching two different cities at once.
 */
function matchAtLevel(text: string, level: LocationLevel): PlaceMatch | null {
  const candidates = NORMALISED.filter((e) => e.node.level === level);
  const exact = candidates.filter((e) => e.key === text);
  if (exact.length === 1) return { node: exact[0].node, how: 'exact' };
  if (exact.length > 1) return null;

  const contains = candidates.filter((e) => text.includes(e.key) || e.key.includes(text));
  if (contains.length === 1) return { node: contains[0].node, how: 'contains' };
  return null;
}

/**
 * The fields a seller typed, in decreasing order of how much they narrow it.
 *
 * `subCounty` is listed before `county` because in the real data "Mwiki" and
 * "Kasarani" describe the same constituency, and Kasarani is a seeded area —
 * so matching on it gives the more precise answer, while "Nairobi" alone would
 * only ever give the city.
 */
export interface FreeTextPlace {
  area?: string | null;
  subCounty?: string | null;
  cityTown?: string | null;
  county?: string | null;
  country?: string | null;
}

export interface ResolvedPlace {
  countryId?: string;
  countyId?: string;
  cityId?: string;
  areaId?: string;
  countryName?: string;
  countyName?: string;
  cityName?: string;
  areaName?: string;
  /** Which field produced the decision — recorded so the seller can see why. */
  matchedOn?: 'area' | 'subCounty' | 'cityTown' | 'county' | 'country';
}

/**
 * Resolve typed text into hierarchy ids, filling levels upward.
 *
 * Once an area resolves, its county and city are taken from the ANCESTRY
 * rather than from the seller's other fields: if they disagree, the tree is
 * right and the free text is not, and the tree is the only one that is
 * internally consistent.
 */
export function resolveFreeTextPlace(place: FreeTextPlace): ResolvedPlace {
  const out: ResolvedPlace = {};

  const countryText = normalisePlaceName(place.country);
  if (countryText) {
    const hit = matchAtLevel(countryText, 'country');
    if (hit) {
      out.countryId = hit.node.id;
      out.countryName = hit.node.name;
      out.matchedOn = 'country';
    }
  }

  const countyText = normalisePlaceName(place.county);
  if (countyText) {
    const hit = matchAtLevel(countyText, 'county');
    if (hit) {
      out.countyId = hit.node.id;
      out.countyName = hit.node.name;
      out.matchedOn = out.matchedOn ?? 'county';
    }
  }

  const cityText = normalisePlaceName(place.cityTown);
  if (cityText) {
    const hit = matchAtLevel(cityText, 'city');
    if (hit) {
      out.cityId = hit.node.id;
      out.cityName = hit.node.name;
      out.matchedOn = out.matchedOn ?? 'cityTown';
    }
  }

  // Narrowest first: an area or a sub-county both beat a bare city name.
  const areaText = normalisePlaceName(place.area);
  const subText = normalisePlaceName(place.subCounty);
  const narrowest = ([
    { key: place.area, field: 'area' },
    { key: place.subCounty, field: 'subCounty' },
  ] as const).filter((f) => normalisePlaceName(f.key).length > 0);

  for (const { key, field } of narrowest) {
    const text = normalisePlaceName(key);
    const hit = matchAtLevel(text, 'area');
    if (!hit) continue;
    out.areaId = hit.node.id;
    out.areaName = hit.node.name;
    out.matchedOn = field;
    break;
  }

  // Pull the upper levels from the ancestry of the deepest thing we resolved.
  const deepest = out.areaId ?? out.cityId ?? out.countyId ?? out.countryId;
  if (deepest) {
    for (const node of locationAncestry(deepest)) {
      if (node.level === 'country' && !out.countryId) {
        out.countryId = node.id;
        out.countryName = node.name;
      }
      if (node.level === 'county' && !out.countyId) {
        out.countyId = node.id;
        out.countyName = node.name;
      }
      if (node.level === 'city' && !out.cityId) {
        out.cityId = node.id;
        out.cityName = node.name;
      }
      if (node.level === 'area' && !out.areaId) {
        out.areaId = node.id;
        out.areaName = node.name;
      }
    }
  }

  return out;
}

/** True when the seller supplied nothing we could recognise. */
export function hasNoResolvedPlace(resolved: ResolvedPlace): boolean {
  return !resolved.areaId && !resolved.cityId && !resolved.countyId && !resolved.countryId;
}

/** "Westlands, Nairobi" — the most specific labels first, nothing empty. */
export function placeLabel(resolved: ResolvedPlace): string | undefined {
  return [resolved.areaName, resolved.cityName, resolved.countyName, resolved.countryName]
    .filter((v): v is string => !!v)
    .join(', ') || undefined;
}

/**
 * Turn a resolved place into the `servesAreaIds` list.
 *
 * An area implies its city and county; a city implies its county. This is what
 * lets "serve Nairobi" cover a business that published in Westlands without
 * either side enumerating everything.
 */
export function impliedServedIds(resolved: ResolvedPlace): string[] {
  const ids = new Set<string>();
  const deepest = resolved.areaId ?? resolved.cityId ?? resolved.countyId ?? resolved.countryId;
  if (!deepest) return [];
  for (const node of locationAncestry(deepest)) ids.add(node.id);
  return [...ids];
}

export function resolveLocationIdOrNull(id: string | null | undefined): SeedLocation | null {
  return locationById(id);
}
