/**
 * GEOGRAPHY WITHOUT A PAID SERVICE.
 *
 * ## Why this exists
 *
 * The customer is not in Kenya. They might be in Lagos, London or Vancouver, and
 * "we don't limit anyone" has to be literally true — not true up to the edge of
 * a seed table. So the system has to do two things with a coordinate:
 *
 *   1. work out whether it is somewhere we have a place for; and
 *   2. if it is not, still be useful.
 *
 * (1) is `locationFor`, which compares against seeded centroids and **refuses
 * beyond a per-level threshold** rather than always naming the nearest row.
 * (2) is everything downstream keeping the raw coordinates, so an unmapped
 * customer still gets distance-ranked results instead of an error.
 *
 * No network call, no API key. Adding a geocoding provider later improves
 * naming and coverage; it must never become a prerequisite for the app working.
 */

import {
  MATCH_MAX_KM,
  SEED_LOCATIONS,
  locationAncestry,
  type LocationLevel,
  type SeedLocation,
} from './hierarchy';

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km, rounded to 2dp. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h))) * 100) / 100;
}

export function isValidPoint(p: unknown): p is { lat: number; lng: number } {
  if (!p || typeof p !== 'object') return false;
  const { lat, lng } = p as { lat?: unknown; lng?: unknown };
  return (
    typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180
  );
}

export interface PointMatch {
  node: SeedLocation;
  distanceKm: number;
}

/**
 * The nearest seeded place to a coordinate, **if it is close enough to be true**.
 *
 * `level` is a filter, not a hint, and it matters more than it looks: many
 * areas sit on their city's centroid (Nairobi CBD, Nakuru CBD, Kisumu CBD all
 * share a point with their county). Without the filter the county wins the tie —
 * it appears earlier in the list — and those areas become permanently
 * unresolvable, so a customer standing in the CBD is labelled "Nairobi" and
 * never "CBD". That is a silent downgrade, not an error.
 *
 * The threshold is per level: a customer in Mombasa is legitimately "Kenya",
 * and one in Kasarani is not. Returning `{ node: null }` for anything beyond the
 * threshold is the whole point — an answer that is 300 km wrong is worse than
 * no answer, because the customer cannot tell it is wrong.
 */
export function nearestSeedLocation(
  point: { lat: number; lng: number },
  maxKm = Number.POSITIVE_INFINITY,
  level?: LocationLevel,
): { node: SeedLocation | null; distanceKm: number | null } {
  let best: PointMatch | null = null;

  for (const node of SEED_LOCATIONS) {
    if (level && node.level !== level) continue;
    if (typeof node.lat !== 'number' || typeof node.lng !== 'number') continue;
    const km = distanceKm(point, { lat: node.lat, lng: node.lng });
    if (!best || km < best.distanceKm) best = { node, distanceKm: km };
  }

  if (!best) return { node: null, distanceKm: null };
  if (best.distanceKm > maxKm) return { node: null, distanceKm: best.distanceKm };
  return best;
}

/**
 * The most specific place a coordinate genuinely falls inside.
 *
 * Tries area → city → county → country, each searched at its OWN level with its
 * own threshold, so a point in Westlands resolves to Westlands rather than to
 * Kenya, and a point in Mombasa CBD resolves to the CBD rather than to the
 * county that shares its centroid.
 *
 * When it refuses, it still reports how far the nearest seeded AREA was. That
 * number is what lets the product say something true and useful — "nothing near
 * you here yet" — instead of a bare `null` the caller has to guess about.
 */
export function locationFor(
  point: { lat: number; lng: number },
): { node: SeedLocation | null; distanceKm: number | null } {
  const order: LocationLevel[] = ['area', 'city', 'county', 'country'];
  for (const level of order) {
    const hit = nearestSeedLocation(point, MATCH_MAX_KM[level], level);
    if (hit.node) return hit;
  }

  // Refused. Report the nearest area's distance for diagnostics, not as an
  // answer — `node` stays null so no caller can mistake it for a match.
  return { node: null, distanceKm: nearestSeedLocation(point, undefined, 'area').distanceKm };
}

/** The chain of ids a coordinate falls under, or `[]` when unmapped. */
export function ancestryIdsFor(point: { lat: number; lng: number }): string[] {
  const { node } = locationFor(point);
  return node ? locationAncestry(node.id).map((n) => n.id) : [];
}

export function formatCoordinate(point: { lat: number; lng: number }): string {
  const lat = `${Math.abs(point.lat).toFixed(2)}°${point.lat >= 0 ? 'N' : 'S'}`;
  const lng = `${Math.abs(point.lng).toFixed(2)}°${point.lng >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lng}`;
}
