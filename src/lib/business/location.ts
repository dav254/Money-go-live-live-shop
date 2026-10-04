/**
 * WHERE A BUSINESS IS — building, validating and publishing it.
 *
 * ## The rule that shapes this file
 *
 * A `BusinessLocation` is not an address. It is the answer to "roughly where do
 * you work?", and everything here exists to keep it that way:
 *
 *   - `home_based` and `service_provider` businesses may not publish a precise
 *     point at all. `publicPrecision` is forced to `area_only` for them, so
 *     there is no code path — and no admin mistake — by which someone's home
 *     coordinates reach a public document.
 *   - `servesAreaIds` is derived from the hierarchy rather than typed, so "I
 *     serve Westlands" cannot silently mean "I serve Westlands, Paris".
 *   - what a customer sees is `approximateLocationFor`, never the raw point.
 */

import {
  locationAncestry,
  locationById,
  locationContains,
} from '@/lib/locations/hierarchy';
import { impliedServedIds, type ResolvedPlace } from '@/lib/locations/match';
import type { BusinessKind, BusinessLocation } from './types';

/** Kinds that never publish a precise point. */
export const AREA_ONLY_KINDS: BusinessKind[] = ['home_based', 'service_provider', 'mobile'];

/** Nothing sensible exceeds this; 25 km is the top preset in the spec. */
export const MAX_SERVICE_RADIUS_KM = 100;

export interface LocationDraft {
  label?: string | null;
  countryId?: string | null;
  countyId?: string | null;
  cityId?: string | null;
  areaId?: string | null;
  lat?: number | null;
  lng?: number | null;
  serviceRadiusKm?: number | null;
  kind?: BusinessKind | null;
}

export interface LocationBuildResult {
  location?: BusinessLocation;
  error?: string;
}

function isValidLat(v: number): boolean {
  return Number.isFinite(v) && v >= -90 && v <= 90;
}

function isValidLng(v: number): boolean {
  return Number.isFinite(v) && v >= -180 && v <= 180;
}

/**
 * Build a location from a form submission, or explain why it cannot be built.
 *
 * Rejects, rather than silently repairing, two things that would otherwise be
 * stored wrong and surface as a wrong map pin months later:
 *   - an area that is not under the chosen city ("Kasarani, under Mombasa");
 *   - coordinates that are not a real point on the globe.
 */
export function buildBusinessLocation(
  draft: LocationDraft,
  resolved: ResolvedPlace = {},
): LocationBuildResult {
  const areaId = draft.areaId || resolved.areaId || undefined;
  const cityId = draft.cityId || resolved.cityId || undefined;
  const countyId = draft.countyId || resolved.countyId || undefined;
  const countryId = draft.countryId || resolved.countryId || undefined;

  if (!areaId && !cityId && !countyId && !countryId) {
    return { error: 'Choose at least an area or a city.' };
  }

  if (areaId && cityId && !locationContains(cityId, areaId)) {
    const area = locationById(areaId);
    const city = locationById(cityId);
    return {
      error: `${area?.name ?? 'That area'} is not in ${city?.name ?? 'that city'}.`,
    };
  }
  if (cityId && countyId && !locationContains(countyId, cityId)) {
    return { error: 'That city is not in the selected county.' };
  }

  const hasLat = draft.lat !== null && draft.lat !== undefined;
  const hasLng = draft.lng !== null && draft.lng !== undefined;
  if (hasLat !== hasLng) {
    return { error: 'A location needs both a latitude and a longitude.' };
  }
  let lat: number | undefined;
  let lng: number | undefined;
  if (hasLat && hasLng) {
    lat = Number(draft.lat);
    lng = Number(draft.lng);
    if (!isValidLat(lat) || !isValidLng(lng)) {
      return { error: 'Those coordinates are not a real point.' };
    }
  }

  let serviceRadiusKm: number | undefined;
  if (draft.serviceRadiusKm !== null && draft.serviceRadiusKm !== undefined) {
    serviceRadiusKm = Number(draft.serviceRadiusKm);
    if (!Number.isFinite(serviceRadiusKm) || serviceRadiusKm <= 0 || serviceRadiusKm > MAX_SERVICE_RADIUS_KM) {
      return { error: `Service radius must be between 0 and ${MAX_SERVICE_RADIUS_KM} km.` };
    }
  }

  const kind = draft.kind ?? undefined;
  const areaOnly = kind ? AREA_ONLY_KINDS.includes(kind) : false;

  // A home-based business keeps no coordinates even if the client sent some.
  // This is the second half of the privacy rule: the type says "this is my
  // house", so the point is dropped here rather than trusted downstream.
  if (areaOnly) {
    lat = undefined;
    lng = undefined;
  }

  const deepest = areaId ?? cityId ?? countyId ?? countryId!;
  const names: ResolvedPlace = {
    countryId,
    countyId,
    cityId,
    areaId,
    countryName: resolved.countryName,
    countyName: resolved.countyName,
    cityName: resolved.cityName,
    areaName: resolved.areaName,
  };
  // Names come from the tree, not from the client's strings.
  for (const node of locationAncestry(deepest)) {
    if (node.level === 'country') names.countryName = names.countryName ?? node.name;
    if (node.level === 'county') names.countyName = names.countyName ?? node.name;
    if (node.level === 'city') names.cityName = names.cityName ?? node.name;
    if (node.level === 'area') names.areaName = names.areaName ?? node.name;
  }

  return {
    location: {
      id: 'primary',
      label: (draft.label || '').trim() || (names.areaName ?? names.cityName ?? 'Primary location'),
      isPrimary: true,
      countryId,
      countyId,
      cityId,
      areaId,
      countryName: names.countryName,
      countyName: names.countyName,
      cityName: names.cityName,
      areaName: names.areaName,
      ...(lat !== undefined ? { lat } : {}),
      ...(lng !== undefined ? { lng } : {}),
      ...(serviceRadiusKm !== undefined ? { serviceRadiusKm } : {}),
      // Declared coverage, deliberately EMPTY on first save. Filling it from
      // the business's own address lineage was the original design and it was
      // wrong: "this business is in Kenya" is not "this business serves all of
      // Kenya", and conflating the two made every Kenyan business match every
      // Kenyan buyer. Coverage is something the seller declares.
      servesAreaIds: [],
      publicPrecision: areaOnly || lat === undefined ? 'area_only' : 'exact',
    },
  };
}

/**
 * The areas a location's ANSWER covers, for display only.
 *
 * "Westlands" implies Nairobi implies Kenya — useful to show a seller what
 * their single choice will reach. Never use it to decide whether a business
 * serves a buyer; that is `servesArea`, and it reads declared coverage.
 */
export function impliedCoverageIds(location: BusinessLocation | null | undefined): string[] {
  if (!location) return [];
  return impliedServedIds({
    countryId: location.countryId,
    countyId: location.countyId,
    cityId: location.cityId,
    areaId: location.areaId,
  });
}

/**
 * The string a customer is allowed to see.
 *
 * A distance is only included when the business published a point; for an
 * area-only business the area name is all there is, and inventing "3 km" for it
 * would be a fabrication shown to buyers.
 */
export function approximateLocationFor(
  location: BusinessLocation | undefined | null,
  distanceKm?: number | null,
): string | undefined {
  if (!location) return undefined;
  const area = location.areaName ?? location.cityName ?? location.countyName;
  if (area && typeof distanceKm === 'number' && Number.isFinite(distanceKm)) {
    return `${area} · ${formatDistance(distanceKm)} away`;
  }
  return area;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/** Great-circle distance in km. Null when either point is unknown. */
export function distanceKmBetween(
  a: { lat?: number; lng?: number } | null | undefined,
  b: { lat?: number; lng?: number } | null | undefined,
): number | null {
  if (!a || !b || typeof a.lat !== 'number' || typeof a.lng !== 'number') return null;
  if (typeof b.lat !== 'number' || typeof b.lng !== 'number') return null;
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 100) / 100;
}

/**
 * Does this business serve a buyer standing in `areaId`?
 *
 * Two ways to say yes: this is the business's own area, or the seller declared
 * an area that contains the buyer's. Declaring "Nairobi" covers Westlands;
 * declaring "Westlands" does not cover Kilimani.
 *
 * Everything else — no location, no declaration — is false. That default is the
 * important one: reading an unset field as "everywhere" would hand every
 * business every request in the country, which is the exact opposite of
 * matching.
 */
export function servesArea(
  location: BusinessLocation | null | undefined,
  areaId: string | null | undefined,
): boolean {
  if (!location || !areaId) return false;
  if (location.areaId === areaId) return true;
  const declared = location.servesAreaIds ?? [];
  if (declared.includes(areaId)) return true;
  // They declared "Nairobi"; the buyer is in an area of Nairobi.
  return declared.some((servedId) => locationContains(servedId, areaId));
}

/** True when the business has enough location to be ranked by distance. */
export function hasPublishableLocation(location: BusinessLocation | null | undefined): boolean {
  if (!location) return false;
  return !!(location.areaId || location.cityId || location.lat !== undefined);
}
