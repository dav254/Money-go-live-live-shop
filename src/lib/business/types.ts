/**
 * THE BUSINESS ENTITY.
 *
 * ## Why a business is not a seller
 *
 * A seller is a person with a login. A business is the trading entity — Maasai
 * Craft House. They are not the same thing, and pretending they are is the
 * mistake that makes service areas, verification, reputation and sponsored
 * campaigns each need their own half-built workaround:
 *
 *   - one person can run several businesses (a franchise, a tutor who also
 *     does photography);
 *   - several people can run one business (a shop with staff);
 *   - a business has an address, a verification status and a reputation, none
 *     of which belong to the login of whoever happened to create it.
 *
 * So `businesses/{id}` is the thing everything else hangs off, and `sellerId`
 * on a listing stays exactly where it is. Nothing is re-parented — listings
 * keep living in `products` and simply gain a `businessId`. Moving documents
 * would break every rule and every screen for tidiness nobody outside the
 * codebase will ever see.
 */

import type { VerificationStatus } from '@/lib/verification';

export type BusinessType =
  | 'sole_trader'
  | 'company'
  | 'cooperative'
  | 'individual'
  | 'community';

/**
 * What kind of operation this is, which decides how its location works.
 *
 * A physical shop publishes a point you can walk to. A plumber has no such
 * point — they have an area and a radius. Forcing both into one shape is what
 * makes "nearby" either useless or a privacy problem.
 */
export type BusinessKind =
  | 'physical_store'
  | 'online'
  | 'service_provider'
  | 'home_based'
  | 'mobile'
  | 'delivery';

export type MemberRole = 'owner' | 'manager' | 'staff';

export interface BusinessMember {
  uid: string;
  role: MemberRole;
  displayName?: string;
  /**
   * ISO string, NOT a server timestamp.
   *
   * `members` is an inline array so a permission check is one document read.
   * Firestore forbids `serverTimestamp()` inside an array — it is rejected at
   * write time — so the value is the app clock's ISO string. For a record of
   * when someone joined a business that is entirely adequate; where a trusted
   * server clock matters, the doc-level `createdAt` uses a real sentinel.
   */
  joinedAt?: string;
}

/**
 * One place a business operates from or serves.
 *
 * Coordinates are deliberately optional and, where present, represent the
 * business's *published* location — never a person's home. A home-based
 * business publishes an area and leaves the coordinates off.
 */
export interface BusinessLocation {
  id: string;
  /** Human name for this site: "Kilimani Workshop". */
  label: string;
  isPrimary: boolean;

  // The hierarchy, as ids from the locations collection.
  countryId?: string;
  countyId?: string;
  cityId?: string;
  areaId?: string;

  // Denormalised names so a list does not need four joins.
  countryName?: string;
  countyName?: string;
  cityName?: string;
  areaName?: string;

  /** Published coordinates. Absent for area-only businesses. */
  lat?: number;
  lng?: number;

  /** How far this business will travel. Null means "wherever the areas say". */
  serviceRadiusKm?: number;
  /** Named areas served, beyond the radius. */
  servesAreaIds?: string[];

  /**
   * Whether this exact point may be shown on a map.
   *
   * Defaults to false for home_based. A customer needs to know roughly where a
   * plumber works, not where they sleep.
   */
  publicPrecision: 'exact' | 'area_only';
}

export type AvailabilityState =
  | 'available'
  | 'low_stock'
  | 'out_of_stock'
  | 'preorder'
  | 'on_request'
  | 'available_today'
  | 'available_tomorrow'
  | 'fully_booked'
  | 'accepting_requests';

export interface Availability {
  state: AvailabilityState;
  /** When the next change is expected, for "out of stock" and "fully booked". */
  restockEta?: string;
  /** ISO date the business is next free, for services. */
  nextAvailableDate?: string;
  updatedAt?: any;
}

export interface Business {
  id: string;

  name: string;
  /** URL-safe, used in /business/{slug}. Unique. */
  slug: string;

  type: BusinessType;
  kind: BusinessKind;

  /**
   * The account that created it. Auth convenience only — access is decided by
   * the members subcollection, not by this field.
   */
  ownerId: string;
  members?: BusinessMember[];

  /** Primary trade. Others live on the listings. */
  category?: string;
  categories?: string[];

  description?: string;
  logoUrl?: string;
  bannerUrl?: string;

  /** Primary operating location, inlined so the common read is one doc. */
  primaryLocation?: BusinessLocation;
  locationCount?: number;

  verificationStatus?: VerificationStatus;

  /**
   * Behavioural reputation, 0–100.
   *
   * Volume is weighted ABOVE rating on purpose: a shop with two completed
   * orders and a 5.0 average is not more trustworthy than one with forty
   * orders and a 4.6, and scoring it higher would make the badge actively
   * mislead exactly the buyers it exists to protect.
   */
  reputationScore?: number;
  reputation?: {
    completedOrders?: number;
    responseRate?: number;
    cancellationRate?: number;
    averageRating?: number;
    reviewCount?: number;
    accountAgeDays?: number;
    verified?: boolean;
    /** Recomputed from the components above; shown in the UI. */
    computedAt?: any;
  };

  isActive?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

/** What a business publishes publicly. Never includes private coordinates. */
export interface PublicBusiness {
  id: string;
  name: string;
  slug: string;
  kind: BusinessKind;
  category?: string;
  verificationStatus?: VerificationStatus;
  reputationScore?: number;
  rating?: { average: number; count: number };
  /**
   * "Westlands" or "Kilimani · 2.1 km away" — whatever is safe to show.
   * The precise point never appears here.
   */
  approximateLocation?: string;
  distanceKm?: number;
}

export function isBusinessMember(
  members: BusinessMember[] | undefined,
  uid: string | null | undefined,
): boolean {
  if (!uid || !Array.isArray(members)) return false;
  return members.some((m) => m.uid === uid);
}

export function memberRole(
  members: BusinessMember[] | undefined,
  uid: string | null | undefined,
): MemberRole | null {
  if (!uid || !Array.isArray(members)) return null;
  return members.find((m) => m.uid === uid)?.role ?? null;
}

/** Only an owner or manager may change the business itself. */
export function canManage(members: BusinessMember[] | undefined, uid: string | null | undefined): boolean {
  const role = memberRole(members, uid);
  return role === 'owner' || role === 'manager';
}

const SLUG_STRIP = /[^a-z0-9]+/g;

export function slugifyBusinessName(name: string): string {
  return (name || '')
    .normalize('NFKD')
    // Drop the combining marks NFKD just split off, so "Café" → "cafe" rather
    // than "caf" and "Électro" → "electro". Without this, accented names lose
    // letters, and "Cafe Services" and "Café Services" collide on one slug —
    // which is two real businesses fighting over one URL.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(SLUG_STRIP, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}
