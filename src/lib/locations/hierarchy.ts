/**
 * THE LOCATION HIERARCHY.
 *
 * ## Country → County → City → Area → coordinates
 *
 * The user's spec was explicit: "Do not hard-code Nairobi only. The
 * architecture must support other Kenyan cities and eventually international
 * markets." So Nairobi, Mombasa and Kisumu are SEED DATA, not logic. The
 * matching, distance and targeting code never mentions a city by name; it only
 * compares ids, which is what lets an international market arrive as new rows
 * rather than a new release.
 *
 * ## Ids are stable strings, not paths
 *
 * `ke.nairobi.westlands` reads well and survives a reorganisation, because the
 * id is what a business has stored. A slash-separated path would break the
 * moment an area moved between cities.
 *
 * ## The coordinates are CENTROIDS, and that matters
 *
 * Each node carries an approximate centre point, which is what makes reverse
 * geocoding work with no paid service and no network call. A centroid is not a
 * boundary: "Kasarani" here is a point, and Kasarani is tens of square
 * kilometres. So `locationFor` refuses to claim a match beyond
 * `AREA_MATCH_MAX_KM`, because calling a point in Lagos "Kasarani" because it
 * was the nearest row would be a confident lie shown to a customer who then
 * sees businesses 400 km away.
 *
 * For a customer outside every seeded market this module correctly answers
 * "I do not know where this is" — and the product answers that by keeping the
 * raw coordinates and searching on distance instead of on a name.
 */

export type LocationLevel = 'country' | 'county' | 'city' | 'area';

/** Below `area`: a business point or a radius. Never a public address. */
export type LocationDepth = LocationLevel | 'point';

export interface SeedLocation {
  id: string;
  name: string;
  level: LocationLevel;
  parentId?: string;
  /** Approximate centre. Not a boundary, and not a place to stand. */
  lat?: number;
  lng?: number;
}

export const SEED_LOCATIONS: SeedLocation[] = [
  /* ---------------------------------------------------------- country */
  { id: 'ke', name: 'Kenya', level: 'country', lat: -0.0236, lng: 37.9062 },

  /* --------------------------------------------------- Nairobi County */
  { id: 'ke.nairobi', name: 'Nairobi County', level: 'county', parentId: 'ke', lat: -1.2921, lng: 36.8219 },
  { id: 'ke.nairobi.nairobi', name: 'Nairobi', level: 'city', parentId: 'ke.nairobi', lat: -1.2921, lng: 36.8219 },
  { id: 'ke.nairobi.nairobi.westlands', name: 'Westlands', level: 'area', parentId: 'ke.nairobi.nairobi', lat: -1.2864, lng: 36.8172 },
  { id: 'ke.nairobi.nairobi.cbd', name: 'CBD', level: 'area', parentId: 'ke.nairobi.nairobi', lat: -1.2833, lng: 36.8167 },
  { id: 'ke.nairobi.nairobi.kilimani', name: 'Kilimani', level: 'area', parentId: 'ke.nairobi.nairobi', lat: -1.269, lng: 36.8078 },
  { id: 'ke.nairobi.nairobi.parklands', name: 'Parklands', level: 'area', parentId: 'ke.nairobi.nairobi', lat: -1.2667, lng: 36.8122 },
  { id: 'ke.nairobi.nairobi.kasarani', name: 'Kasarani', level: 'area', parentId: 'ke.nairobi.nairobi', lat: -1.25, lng: 36.85 },
  { id: 'ke.nairobi.nairobi.lavington', name: 'Lavington', level: 'area', parentId: 'ke.nairobi.nairobi', lat: -1.2767, lng: 36.79 },
  { id: 'ke.nairobi.nairobi.kileleshwa', name: 'Kileleshwa', level: 'area', parentId: 'ke.nairobi.nairobi', lat: -1.277, lng: 36.797 },
  { id: 'ke.nairobi.nairobi.mount-kenya', name: 'Mount Kenya', level: 'area', parentId: 'ke.nairobi.nairobi', lat: -1.26, lng: 36.82 },
  { id: 'ke.nairobi.nairobi.embakasi', name: 'Embakasi', level: 'area', parentId: 'ke.nairobi.nairobi', lat: -1.35, lng: 36.88 },
  { id: 'ke.nairobi.nairobi.ruiru', name: 'Ruiru', level: 'area', parentId: 'ke.nairobi.nairobi', lat: -1.27, lng: 36.96 },
  { id: 'ke.nairobi.nairobi.gigiri', name: 'Gigiri', level: 'area', parentId: 'ke.nairobi.nairobi', lat: -1.245, lng: 36.83 },

  /* --------------------------------------------------- Mombasa County */
  { id: 'ke.mombasa', name: 'Mombasa County', level: 'county', parentId: 'ke', lat: -4.0435, lng: 39.6682 },
  { id: 'ke.mombasa.mombasa', name: 'Mombasa', level: 'city', parentId: 'ke.mombasa', lat: -4.0435, lng: 39.6682 },
  { id: 'ke.mombasa.mombasa.nyali', name: 'Nyali', level: 'area', parentId: 'ke.mombasa.mombasa', lat: -4.02, lng: 39.7 },
  { id: 'ke.mombasa.mombasa.bamburi', name: 'Bamburi', level: 'area', parentId: 'ke.mombasa.mombasa', lat: -4.0, lng: 39.74 },
  { id: 'ke.mombasa.mombasa.cbd', name: 'Mombasa CBD', level: 'area', parentId: 'ke.mombasa.mombasa', lat: -4.0435, lng: 39.6682 },
  { id: 'ke.mombasa.mombasa.likoni', name: 'Likoni', level: 'area', parentId: 'ke.mombasa.mombasa', lat: -4.08, lng: 39.67 },
  { id: 'ke.mombasa.mombasa.changamwe', name: 'Changamwe', level: 'area', parentId: 'ke.mombasa.mombasa', lat: -4.05, lng: 39.6 },

  /* ----------------------------------------------------- Kisumu County */
  { id: 'ke.kisumu', name: 'Kisumu County', level: 'county', parentId: 'ke', lat: -0.0917, lng: 34.768 },
  { id: 'ke.kisumu.kisumu', name: 'Kisumu', level: 'city', parentId: 'ke.kisumu', lat: -0.0917, lng: 34.768 },
  { id: 'ke.kisumu.kisumu.cbd', name: 'Kisumu CBD', level: 'area', parentId: 'ke.kisumu.kisumu', lat: -0.0917, lng: 34.768 },
  { id: 'ke.kisumu.kisumu.milimani', name: 'Milimani', level: 'area', parentId: 'ke.kisumu.kisumu', lat: -0.105, lng: 34.76 },
  { id: 'ke.kisumu.kisumu.kibuye', name: 'Kibuye', level: 'area', parentId: 'ke.kisumu.kisumu', lat: -0.12, lng: 34.75 },

  /* ------------------------------------------------------ Kiambu County */
  { id: 'ke.kiambu', name: 'Kiambu County', level: 'county', parentId: 'ke', lat: -1.17, lng: 37.04 },
  { id: 'ke.kiambu.kiambu', name: 'Kiambu', level: 'city', parentId: 'ke.kiambu', lat: -1.17, lng: 37.04 },
  { id: 'ke.kiambu.kiambu.thika', name: 'Thika', level: 'area', parentId: 'ke.kiambu.kiambu', lat: -1.05, lng: 37.08 },
  { id: 'ke.kiambu.kiambu.limuru', name: 'Limuru', level: 'area', parentId: 'ke.kiambu.kiambu', lat: -1.1, lng: 36.64 },

  /* --------------------------------------------------- Nakuru County */
  { id: 'ke.nakuru', name: 'Nakuru County', level: 'county', parentId: 'ke', lat: -0.3, lng: 36.08 },
  { id: 'ke.nakuru.nakuru', name: 'Nakuru', level: 'city', parentId: 'ke.nakuru', lat: -0.3031, lng: 36.08 },
  { id: 'ke.nakuru.nakuru.nakuru-cbd', name: 'Nakuru CBD', level: 'area', parentId: 'ke.nakuru.nakuru', lat: -0.3031, lng: 36.08 },
  { id: 'ke.nakuru.nakuru.naivasha', name: 'Naivasha', level: 'area', parentId: 'ke.nakuru.nakuru', lat: -0.7167, lng: 36.4333 },
];

/** Radius presets from the spec: 1 / 3 / 5 / 10 / 25 km, or unbounded. */
export const RADIUS_PRESETS_KM = [1, 3, 5, 10, 25] as const;

export type RadiusChoice = (typeof RADIUS_PRESETS_KM)[number] | 'city' | 'county' | 'country' | 'custom';

/**
 * How far a centroid may stand in for a place the customer is actually at.
 *
 * Loose on purpose for a country or county (a customer anywhere in Kenya
 * reasonably *is* "Kenya") and tight for an area, because claiming "Kasarani"
 * for someone 60 km away produces businesses that are all far too distant and
 * no explanation why.
 */
export const AREA_MATCH_MAX_KM = 45;

export const MATCH_MAX_KM: Record<LocationLevel, number> = {
  country: 2000,
  county: 300,
  city: 120,
  area: AREA_MATCH_MAX_KM,
};

const BY_ID = new Map(SEED_LOCATIONS.map((l) => [l.id, l]));

export function locationById(id: string | null | undefined): SeedLocation | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function hasCoordinates(node: SeedLocation | null | undefined): boolean {
  return typeof node?.lat === 'number' && typeof node?.lng === 'number';
}

/**
 * The chain from country down to a location: `['ke', 'ke.nairobi', …]`.
 *
 * Walked from the parent links rather than by splitting the id, so a future
 * market with non-hierarchical ids does not break it.
 */
export function locationAncestry(id: string): SeedLocation[] {
  const chain: SeedLocation[] = [];
  let cursor: string | undefined = id;
  let guard = 0;
  while (cursor && guard++ < 8) {
    const node = BY_ID.get(cursor);
    if (!node) break;
    chain.unshift(node);
    cursor = node.parentId;
  }
  return chain;
}

export function childrenOf(parentId: string): SeedLocation[] {
  return SEED_LOCATIONS.filter((l) => l.parentId === parentId);
}

/**
 * Is `candidate` at or below `target` in the tree?
 *
 * This is the containment test behind "is the buyer inside this seller's area".
 * It walks ancestry rather than testing string prefixes, because a prefix test
 * would call `ke.nairobi` a parent of `ke.nairobicity` — and that bug is
 * invisible until someone names a town that way.
 */
export function locationContains(target: string | null | undefined, candidate: string | null | undefined): boolean {
  if (!target || !candidate) return false;
  if (target === candidate) return true;
  return locationAncestry(candidate).some((n) => n.id === target);
}

export function locationName(id: string | null | undefined, fallback = 'Kenya'): string {
  return locationById(id)?.name ?? fallback;
}
