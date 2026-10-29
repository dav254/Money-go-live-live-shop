/**
 * SHOP OPPORTUNITY AGENT — local business scout (source layer, no I/O model).
 *
 * Two permitted sources:
 *   • `google_places` — the official Places API (New) Nearby Search, called
 *     server-side with the configured key. NO scraping, no page fetching, no
 *     bypassing platform restrictions; only the field mask of permitted
 *     business fields is requested, and the required Google attribution is
 *     stored on every candidate. Retrieved data carries a retention deadline
 *     (SOURCE_RETENTION_DAYS.google_places = 30 days, matching Google's
 *     cache policy for place data) and expires ⇒ outreach refuses it until
 *     refreshed.
 *   • `manual` — leads supplied by an admin, with an attested contact basis
 *     and evidence strings the admin is responsible for.
 *
 * Honesty rules:
 *   • No key ⇒ `{ status: 'not_configured' }` and ZERO network calls. The
 *     scout never fakes candidates and never stores raw provider payloads.
 *   • Dedup is structural: the deterministic candidate id is derived from
 *     the source id, so ingesting the same business twice is one document.
 *   • Contact details come from the source (or the attesting admin) — never
 *     invented, never enriched from unknown services.
 *
 * `fetchImpl` is injectable so the normalisation/dedup/retention logic is
 * unit-testable without credentials or network.
 */

import {
  CANDIDATES_COLLECTION,
  DEFAULT_CATEGORIES,
  PILOT_AREA,
  SCOUT_LIMITS,
  SOURCE_ATTRIBUTION,
  candidateDocId,
  retentionDaysFor,
  type ContactBasis,
  type ContactChannel,
  type ScoutSource,
} from './types';

/* ── Provider status (honest, key-presence only) ─────────────────────────── */

export interface ProviderStatus {
  id: string;
  label: string;
  /** `configured` means credentials exist — NOT that the API has answered. */
  status: 'configured' | 'not_configured';
  requiredEnvVars: string[];
  note: string;
}

export function scoutProviderStatus(env: Record<string, string | undefined> = process.env): ProviderStatus {
  const configured = Boolean(env.GOOGLE_PLACES_API_KEY);
  return {
    id: 'google_places',
    label: 'Google Places API (New)',
    status: configured ? 'configured' : 'not_configured',
    requiredEnvVars: ['GOOGLE_PLACES_API_KEY'],
    note: configured
      ? 'Credentials present. Reachability is confirmed on the first real scout run — a key existing is not a connection.'
      : 'No credentials configured — the scout will not run and returns zero candidates.',
  };
}

/* ── Request configuration ───────────────────────────────────────────────── */

export interface ScoutRequest {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  categories?: string[];
  limit?: number;
}

export interface NormalizedCandidate {
  source: ScoutSource;
  sourceId: string;
  name: string;
  category: string;
  area: string | null;
  website: string | null;
  contact: ContactChannel | null;
  contactBasis: ContactBasis | null;
  evidence: string[];
}

/** Bounds a request to the pilot limits; never trusts client numbers blindly. */
export function normalizeScoutRequest(req: ScoutRequest = {}): Required<Omit<ScoutRequest, 'categories'>> & {
  categories: string[];
} {
  const num = (v: unknown, fallback: number): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const categories = (req.categories ?? [...DEFAULT_CATEGORIES])
    .map((c) => String(c).trim().toLowerCase())
    .filter((c) => (DEFAULT_CATEGORIES as readonly string[]).includes(c))
    .slice(0, DEFAULT_CATEGORIES.length);
  return {
    lat: Math.max(-90, Math.min(90, num(req.lat, PILOT_AREA.lat))),
    lng: Math.max(-180, Math.min(180, num(req.lng, PILOT_AREA.lng))),
    radiusKm: Math.max(0.5, Math.min(SCOUT_LIMITS.maxRadiusKm, num(req.radiusKm, PILOT_AREA.radiusKm))),
    limit: Math.max(1, Math.min(SCOUT_LIMITS.maxBatch, Math.floor(num(req.limit, SCOUT_LIMITS.defaultBatch)))),
    categories: categories.length ? categories : [...DEFAULT_CATEGORIES],
  };
}

/* ── Google Places (New) — Nearby Search ─────────────────────────────────── */

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchNearby';

/**
 * Vidnov pilot category → official Places API type identifiers (OR'ed by the
 * API). `local_services` deliberately maps to a generic type set — the scout
 * stays bounded by radius + limit rather than claiming a category match the
 * API does not offer.
 */
export const PLACE_TYPES: Record<string, string[]> = {
  clothing: ['clothing_store'],
  shoes: ['shoe_store'],
  electronics: ['electronics_store'],
  furniture: ['furniture_store'],
  beauty: ['beauty_salon', 'cosmetics_store'],
  restaurants: ['restaurant', 'cafe'],
  local_services: ['store', 'establishment'],
};

/** Only business fields we are permitted to keep. No ratings, no photos. */
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.types',
  'places.primaryType',
  'places.formattedAddress',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
].join(',');

interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  types?: string[];
  primaryType?: string;
  formattedAddress?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
}

export type ScoutRunResult =
  | { status: 'not_configured'; found: number; candidates: NormalizedCandidate[]; message: string }
  | { status: 'ok'; found: number; candidates: NormalizedCandidate[]; message?: undefined }
  | { status: 'error'; found: 0; candidates: []; message: string };

/**
 * Runs one bounded scout pass. `env` decides configuration (never a hard
 * crash), `fetchImpl` is injectable for tests. Response bodies are never
 * stored or echoed — only the normalised fields leave this function.
 */
export async function runPlacesScout(
  req: ScoutRequest,
  deps: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
    now?: Date;
  } = {},
): Promise<ScoutRunResult> {
  const env = deps.env ?? process.env;
  const key = env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return {
      status: 'not_configured',
      found: 0,
      candidates: [],
      message: 'Google Places API is not configured (GOOGLE_PLACES_API_KEY missing) — no scout run performed.',
    };
  }

  const cfg = normalizeScoutRequest(req);
  const radiusMeters = Math.round(cfg.radiusKm * 1000);
  const includedTypes = [...new Set(cfg.categories.flatMap((c) => PLACE_TYPES[c] ?? []))].slice(0, 50);

  try {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const res = await fetchImpl(PLACES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: { center: { latitude: cfg.lat, longitude: cfg.lng }, radius: radiusMeters },
        },
        // Only valid Places API type identifiers — Vidnov category labels are
        // mapped through PLACE_TYPES; an empty list means no type filter.
        ...(includedTypes.length ? { includedTypes } : {}),
        maxResultCount: Math.min(cfg.limit, 20), // API cap is 20 per page
      }),
      signal: typeof AbortSignal !== 'undefined' ? AbortSignal.timeout(15_000) : undefined,
    });

    if (!res.ok) {
      // Status code only — upstream bodies are never stored or echoed.
      return {
        status: 'error',
        found: 0,
        candidates: [],
        message: `Places request failed with HTTP ${res.status}. No candidates stored.`,
      };
    }

    const data = (await res.json()) as { places?: RawPlace[] };
    const now = deps.now ?? new Date();
    const seen = new Set<string>();
    const candidates: NormalizedCandidate[] = [];

    for (const place of data.places ?? []) {
      const normalized = normalizePlace(place, now);
      if (!normalized) continue;
      if (seen.has(normalized.sourceId)) continue; // in-batch dedup
      seen.add(normalized.sourceId);
      candidates.push(normalized);
      if (candidates.length >= cfg.limit) break;
    }

    return { status: 'ok', found: candidates.length, candidates };
  } catch {
    return {
      status: 'error',
      found: 0,
      candidates: [],
      message: 'Places request could not complete (network/timeout). No candidates stored.',
    };
  }
}

/**
 * Maps one provider place onto ONLY the permitted stored fields. Returns
 * null for unusable rows (no id or no name) — never a partial guess.
 */
export function normalizePlace(place: RawPlace, _now: Date = new Date()): NormalizedCandidate | null {
  const sourceId = (place.id ?? '').trim();
  const name = (place.displayName?.text ?? '').trim();
  if (!sourceId || !name) return null;

  const rawTypes = [...(place.types ?? [])];
  if (place.primaryType) rawTypes.unshift(place.primaryType);
  const category = mapCategory(rawTypes);

  const website = place.websiteUri?.trim() || null;
  const phoneRaw = (place.nationalPhoneNumber || place.internationalPhoneNumber || '').trim() || null;

  const contact: ContactChannel | null = phoneRaw
    ? { kind: 'phone', value: phoneRaw }
    : website
      ? { kind: 'website_form', value: website }
      : null;

  const area = extractArea(place.formattedAddress ?? null);

  // Source-derived evidence only — factual, checkable statements about the
  // retrieved record. Ratings/reviews are deliberately NOT evidence.
  const evidence: string[] = [
    `Listed by Google Places as a ${category} business${area ? ` serving ${area}` : ''}.`,
    website
      ? `Public website recorded: ${website}.`
      : 'No public website found in the source data — a Vidnov shop link can complement its existing presence.',
  ];
  if (phoneRaw) evidence.push('Business contact number published by the source.');

  return {
    source: 'google_places',
    sourceId,
    name,
    category,
    area,
    website,
    contact,
    // A contact channel PUBLISHED by an official business directory for
    // business purposes is the recorded basis; no basis ⇒ no outreach.
    contactBasis: contact ? 'public_directory_business_listing' : null,
    evidence,
  };
}

/** Maps provider types onto Vidnov's pilot categories; defaults to local services. */
export function mapCategory(types: string[]): string {
  const joined = types.map((t) => t.toLowerCase()).join(' ');
  const rules: Array<[RegExp, string]> = [
    [/clothing_store|clothes|apparel|fashion/, 'clothing'],
    [/shoe|footwear/, 'shoes'],
    [/electronics|computer|mobile_phone|appliance/, 'electronics'],
    [/furniture|home_goods|home_improvement/, 'furniture'],
    [/beauty|cosmetic|hair_care|spa|nail/, 'beauty'],
    [/restaurant|cafe|food|meal_takeaway|bar/, 'restaurants'],
  ];
  for (const [pattern, label] of rules) if (pattern.test(joined)) return label;
  return 'local_services';
}

/** Best-effort locality from a formatted address (last comma segment). */
function extractArea(address: string | null): string | null {
  if (!address) return null;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  const tail = parts[parts.length - 1] ?? '';
  return tail && !/^\d+$/.test(tail) ? tail.slice(0, 60) : null;
}

/* ── Manual leads (admin-supplied) ───────────────────────────────────────── */

export interface ManualLeadInput {
  name: string;
  category: string;
  area?: string | null;
  website?: string | null;
  contact?: ContactChannel | null;
  evidence?: string[];
}

const NAME_MAX = 120;
const AREA_MAX = 60;
const URL_MAX = 200;
const CONTACT_VALUE_MAX = 200;
const EVIDENCE_MAX = 5;

/**
 * Validates an admin-supplied lead into a normalized candidate. Rejects
 * anything that would be an invented field: no contact ⇒ the lead is stored
 * WITHOUT a basis (so it can never reach outreach until one is recorded).
 */
export function normalizeManualLead(input: ManualLeadInput): NormalizedCandidate {
  const name = String(input.name ?? '').trim().slice(0, NAME_MAX);
  if (!name) throw new Error('A business name is required.');
  const category = String(input.category ?? '').trim().toLowerCase().slice(0, 40) || 'local_services';
  const area = String(input.area ?? '').trim().slice(0, AREA_MAX) || null;
  const websiteRaw = String(input.website ?? '').trim().slice(0, URL_MAX);
  const website = websiteRaw ? websiteRaw : null;

  const contact = input.contact
    ? {
        kind: input.contact.kind,
        value: String(input.contact.value ?? '').trim().slice(0, CONTACT_VALUE_MAX),
      }
    : null;
  if (contact && !contact.value) {
    throw new Error('A contact channel needs a value.');
  }

  const evidence = (input.evidence ?? [])
    .map((e) => String(e).trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, EVIDENCE_MAX);

  return {
    source: 'manual',
    sourceId: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}:${category}`.slice(0, 120),
    name,
    category,
    area,
    website,
    contact,
    // Admin-entered leads REQUIRE an attested basis — recorded by the route
    // alongside the admin's identity, never client-supplied.
    contactBasis: contact ? 'admin_attested_lead' : null,
    evidence,
  };
}

/* ── Ingest payload (what the service persists) ──────────────────────────── */

export interface CandidateRecord {
  id: string;
  source: ScoutSource;
  sourceId: string;
  sourceAttribution: string;
  sourceRetrievedAt: string;
  expiresAt: string;
  name: string;
  category: string;
  area: string | null;
  website: string | null;
  contact: ContactChannel | null;
  contactBasis: ContactBasis | null;
  evidence: string[];
}

/** Builds the stored record: deterministic id, attribution, retention clock. */
export function toCandidateRecord(
  candidate: NormalizedCandidate,
  now: Date = new Date(),
): CandidateRecord {
  const retrievedAt = now.toISOString();
  const expires = new Date(now.getTime() + retentionDaysFor(candidate.source) * 86_400_000).toISOString();
  return {
    id: candidateDocId(candidate.source, candidate.sourceId),
    source: candidate.source,
    sourceId: candidate.sourceId,
    sourceAttribution: SOURCE_ATTRIBUTION[candidate.source],
    sourceRetrievedAt: retrievedAt,
    expiresAt: expires,
    name: candidate.name,
    category: candidate.category,
    area: candidate.area,
    website: candidate.website,
    contact: candidate.contact,
    contactBasis: candidate.contactBasis,
    evidence: candidate.evidence,
  };
}

/** True when the source data has passed its retention deadline. */
export function isExpired(expiresAt: string, now: Date = new Date()): boolean {
  const t = Date.parse(expiresAt);
  return !Number.isFinite(t) || t < now.getTime();
}

/** Collection name re-export so routes/services agree on one string. */
export const CANDIDATES = CANDIDATES_COLLECTION;
