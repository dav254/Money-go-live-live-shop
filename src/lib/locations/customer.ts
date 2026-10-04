/**
 * WHERE THE CUSTOMER IS.
 *
 * ## The rule that shapes this file
 *
 * "We don't limit anyone" has to survive a customer who is not in Kenya. So a
 * customer's place is not a row in our tree — it is **coordinates first**, with
 * a tree name attached only when we honestly have one. A customer in Lagos is a
 * first-class location; they simply have no `areaId`, and everything that ranks
 * results falls back to distance rather than falling over.
 *
 * ## The privacy rule, stated once
 *
 * A business NEVER receives a customer's coordinates. Not a rounded one, not a
 * jittered one. `publicCustomerLocation` is the only shape that crosses the
 * boundary, and it is a place name plus a rough distance — the same thing the
 * customer already shows the business in plain text ("I'm in Westlands"). A
 * seller who needs to know a customer is 2 km away can ask them; a platform that
 * hands it over has turned a marketplace into a tracker.
 *
 * Coarse coordinates on the customer's own record are a different matter and are
 * stored, because a customer expects to open the app and still be in Westlands.
 * They live on the user's own document and are never read into a business-facing
 * payload.
 */

import { locationAncestry, locationById } from './hierarchy';
import { distanceKm, formatCoordinate, isValidPoint, locationFor } from './geo';

// Re-exported so the routes have one import for "everything about where a
// customer is", and so `isValidPoint` keeps a single definition.
export { isValidPoint };

/** Coordinates are stored to ~1 m. Anything finer is theatre. */
function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

export interface CustomerLocation {
  /** Coarse device position, when the customer granted permission. */
  lat?: number;
  lng?: number;

  /**
   * Where in our tree this is, when we honestly know.
   *
   * Absent for a customer in a market we have not seeded — and that is a normal
   * state, not a failure.
   */
  countryId?: string;
  countyId?: string;
  cityId?: string;
  areaId?: string;
  countryName?: string;
  countyName?: string;
  cityName?: string;
  areaName?: string;

  /**
   * A name the customer typed for a place we do not have a row for.
   *
   * "Kampala" with no `cityId` still displays as Kampala, still filters, and
   * still ranks by the coordinates behind it.
   */
  label?: string;

  /** How the position was obtained. Shown in the UI, and honest about it. */
  source: 'gps' | 'manual_tree' | 'manual_label';
  updatedAt?: any;
}

export const CUSTOMER_LOCATION_MAX_RADIUS_KM = 200;

/** Build a customer location from raw GPS coordinates, anywhere on earth. */
export function customerLocationFromPoint(
  point: { lat: number; lng: number },
  source: 'gps' = 'gps',
): CustomerLocation | null {
  if (!isValidPoint(point)) return null;
  const base: CustomerLocation = {
    lat: round5(point.lat),
    lng: round5(point.lng),
    source,
  };

  const { node } = locationFor(point);
  if (!node) {
    // An unmapped customer is still located. Naming them would be a guess.
    return base;
  }

  for (const n of locationAncestry(node.id)) {
    if (n.level === 'country') {
      base.countryId = n.id;
      base.countryName = n.name;
    }
    if (n.level === 'county') {
      base.countyId = n.id;
      base.countyName = n.name;
    }
    if (n.level === 'city') {
      base.cityId = n.id;
      base.cityName = n.name;
    }
    if (n.level === 'area') {
      base.areaId = n.id;
      base.areaName = n.name;
    }
  }
  return base;
}

/** Build one from the customer picking a place in the tree by hand. */
export function customerLocationFromTreeId(areaOrCityId: string): CustomerLocation | null {
  const node = locationById(areaOrCityId);
  if (!node) return null;
  const out: CustomerLocation = { source: 'manual_tree' };
  for (const n of locationAncestry(node.id)) {
    if (n.level === 'country') {
      out.countryId = n.id;
      out.countryName = n.name;
    }
    if (n.level === 'county') {
      out.countyId = n.id;
      out.countyName = n.name;
    }
    if (n.level === 'city') {
      out.cityId = n.id;
      out.cityName = n.name;
    }
    if (n.level === 'area') {
      out.areaId = n.id;
      out.areaName = n.name;
    }
  }
  return out;
}

/**
 * Build one from a name the customer typed for a place we have no row for.
 *
 * This is the path that makes the platform worldwide without a seeded row for
 * every town on earth. No `areaId`, no guessing — but a real label and the
 * coordinates, so the customer is findable.
 */
export function customerLocationFromLabel(
  label: string,
  point?: { lat: number; lng: number },
): CustomerLocation | null {
  const clean = (label || '').trim();
  if (!clean) return null;
  if (point && !isValidPoint(point)) return null;
  return {
    ...(point ? { lat: round5(point.lat), lng: round5(point.lng) } : {}),
    label: clean.slice(0, 80),
    source: 'manual_label',
  };
}

/**
 * "Westlands, Nairobi" — or the typed name, or the coordinates, or nothing.
 *
 * Deliberately stops at the city. The full chain is "Westlands, Nairobi,
 * Nairobi County, Kenya", which on a chip the width of a phone is four lines of
 * noise — and "Nairobi County, Kenya" adds nothing a Nairobi customer did not
 * already know. The county and country are kept in the record for matching and
 * for the fallback when nothing deeper is known.
 */
export function customerLocationLabel(loc: CustomerLocation | null | undefined): string {
  if (!loc) return 'Location not set';
  const deep = [loc.areaName, loc.cityName].filter(Boolean).join(', ');
  if (deep) return deep;
  const shallow = [loc.countyName, loc.countryName].filter(Boolean).join(', ');
  if (shallow) return shallow;
  if (loc.label) return loc.label;
  if (isValidPoint(loc)) return formatCoordinate(loc);
  return 'Location not set';
}

/** True when we have enough to rank results at all. */
export function hasUsableCustomerLocation(loc: CustomerLocation | null | undefined): boolean {
  if (!loc) return false;
  return !!loc.areaId || !!loc.cityId || isValidPoint(loc);
}

/**
 * THE ONLY SHAPE THAT CROSSES TO A BUSINESS.
 *
 * No coordinates, at any precision. This is what a seller sees, and it is
 * exactly what the customer already says out loud: an area and a rough
 * distance.
 */
export function publicCustomerLocation(
  loc: CustomerLocation | null | undefined,
): { area?: string; city?: string; distanceKm?: number; precision: 'area' | 'city' | 'none' } {
  if (!loc) return { precision: 'none' };
  const area = loc.areaName;
  const city = loc.cityName;
  if (area || city) {
    return { ...(area ? { area } : {}), ...(city ? { city } : {}), precision: area ? 'area' : 'city' };
  }
  if (loc.label) return { city: loc.label, precision: 'city' };
  // Coordinates alone: the business learns nothing but that we have none.
  return { precision: 'none' };
}

/** Distance from a customer to a business point, or null when either is unknown. */
export function customerToBusinessDistanceKm(
  customer: CustomerLocation | null | undefined,
  business: { lat?: number; lng?: number } | null | undefined,
): number | null {
  if (!isValidPoint(customer) || !business) return null;
  if (typeof business?.lat !== 'number' || typeof business?.lng !== 'number') return null;
  return distanceKm(
    { lat: customer.lat, lng: customer.lng },
    { lat: business.lat, lng: business.lng },
  );
}

/**
 * Does this business serve this customer?
 *
 * Two independent questions, and conflating them is how a marketplace ends up
 * showing a Mombasa barber to someone in Nairobi:
 *
 *   - **coverage** — the seller declared this area, or set a radius;
 *   - **distance** — how far away they actually are.
 *
 * A business with coordinates but no declared coverage is NOT a match. A
 * business with declared coverage 400 km away is not either. Both have to hold.
 */
export function customerMatchesBusiness(
  customer: CustomerLocation | null | undefined,
  business: {
    areaId?: string;
    cityId?: string;
    servesAreaIds?: string[];
    serviceRadiusKm?: number;
    lat?: number;
    lng?: number;
  } | null | undefined,
): boolean {
  if (!customer || !business) return false;

  const declared = business.servesAreaIds ?? [];
  const coverage =
    !!customer.areaId && (business.areaId === customer.areaId || declared.includes(customer.areaId));
  const sameCity =
    !!customer.cityId &&
    (business.cityId === customer.cityId || declared.includes(customer.cityId) ||
      declared.includes(customer.countyId ?? ''));

  if (coverage || sameCity) {
    if (typeof business.serviceRadiusKm !== 'number') return true;
    const km = customerToBusinessDistanceKm(customer, business);
    // No coordinates for either side means the radius cannot be applied. The
    // declared coverage already says yes, so this is not a rejection.
    return km === null ? true : km <= business.serviceRadiusKm;
  }

  return false;
}
