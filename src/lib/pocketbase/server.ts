/**
 * PocketBase REST client — server-only.
 *
 * Part of the gradual self-hosting migration: sections move off Firestore
 * one at a time onto PocketBase running on our own VPS. This module talks to
 * PocketBase's HTTP API directly (no SDK dependency), authenticating as the
 * instance superuser with a short-lived cached token.
 *
 * Configuration (all required to enable PocketBase for a section):
 *   POCKETBASE_URL          e.g. http://127.0.0.1:8090
 *   POCKETBASE_ADMIN_EMAIL    superuser email
 *   POCKETBASE_ADMIN_PASSWORD superuser password
 *
 * When any key is missing every helper reports "not configured" and callers
 * fall back to Firestore, so deploying this code changes nothing until the
 * env vars are set on the VPS.
 */

export interface PocketBaseConfig {
  url: string;
  identity: string;
  password: string;
}

/** Returns the PB config, or null when unset / running in a browser bundle. */
export function getPocketBaseConfig(): PocketBaseConfig | null {
  if (typeof window !== 'undefined') return null;
  const url = (process.env.POCKETBASE_URL ?? '').trim().replace(/\/+$/, '');
  const identity = (process.env.POCKETBASE_ADMIN_EMAIL ?? '').trim();
  const password = (process.env.POCKETBASE_ADMIN_PASSWORD ?? '').trim();
  if (!url || !identity || !password) return null;
  return { url, identity, password };
}

/** True when the app should read/write this section through PocketBase. */
export function pocketBaseEnabled(): boolean {
  return getPocketBaseConfig() !== null;
}

// ---------------------------------------------------------------------------
// Auth — token cached per URL; refreshed once on 401.
// ---------------------------------------------------------------------------

let tokenCache: { url: string; token: string } | null = null;

async function authenticate(cfg: PocketBaseConfig): Promise<string> {
  if (tokenCache?.url === cfg.url) return tokenCache.token;
  // v0.23+ instances use superuser auth; older ones use admin auth.
  const endpoints = [
    '/api/collections/_superusers/auth-with-password',
    '/api/admins/auth-with-password',
  ];
  let lastError = 'PocketBase authentication failed';
  for (const endpoint of endpoints) {
    const res = await fetch(cfg.url + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: cfg.identity, password: cfg.password }),
    });
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as { token?: string } | null;
      if (data?.token) {
        tokenCache = { url: cfg.url, token: data.token };
        return data.token;
      }
    } else {
      lastError = `PocketBase auth ${endpoint} failed (${res.status})`;
    }
  }
  throw new Error(lastError);
}

/** Authenticated request against a PocketBase instance; retries once on 401. */
export async function pbRequest(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<Response> {
  const cfg = getPocketBaseConfig();
  if (!cfg) throw new Error('PocketBase is not configured');
  const token = await authenticate(cfg);
  const res = await fetch(cfg.url + path, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      'Content-Type': 'application/json',
      Authorization: token,
    },
  });
  if (res.status === 401 && retry) {
    tokenCache = null; // token expired — re-auth once
    return pbRequest(path, init, false);
  }
  return res;
}

// ---------------------------------------------------------------------------
// Records + collections
// ---------------------------------------------------------------------------

export interface PbField {
  name: string;
  type: 'text' | 'bool' | 'date' | 'number' | 'json' | 'select';
  required?: boolean;
  options?: string[];
}

export interface PbRecord {
  id: string;
  created: string;
  updated: string;
  [key: string]: unknown;
}

/**
 * Creates a collection (admin-only API rules) unless it already exists.
 * Sends `fields` for PocketBase ≥ 0.25 and falls back to `schema` for older
 * instances, so the same script works on any version the VPS installs.
 */
export async function ensureCollection(name: string, fields: PbField[]): Promise<void> {
  const existing = await pbRequest(`/api/collections/${encodeURIComponent(name)}`);
  if (existing.ok) return;

  const base = {
    name,
    type: 'base',
    // Empty rules = nobody but the superuser can touch it; only server code
    // reads/writes these collections.
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
  };
  for (const schemaKey of ['fields', 'schema'] as const) {
    const res = await pbRequest('/api/collections', {
      method: 'POST',
      body: JSON.stringify({ ...base, [schemaKey]: fields }),
    });
    if (res.ok) return;
    const detail = await res.text().catch(() => '');
    if (schemaKey === 'schema') {
      throw new Error(`Could not create PocketBase collection "${name}" (${res.status}): ${detail.slice(0, 300)}`);
    }
  }
}

export async function pbCreateRecord(collection: string, data: Record<string, unknown>): Promise<PbRecord> {
  const res = await pbRequest(`/api/collections/${encodeURIComponent(collection)}/records`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`PocketBase create "${collection}" failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as PbRecord;
}

export async function pbListRecords(
  collection: string,
  params: { sort?: string; perPage?: number; page?: number; filter?: string; fields?: string } = {},
): Promise<PbRecord[]> {
  const qs = new URLSearchParams();
  if (params.sort) qs.set('sort', params.sort);
  if (params.filter) qs.set('filter', params.filter);
  if (params.fields) qs.set('fields', params.fields);
  qs.set('perPage', String(params.perPage ?? 100));
  qs.set('page', String(params.page ?? 1));
  const res = await pbRequest(`/api/collections/${encodeURIComponent(collection)}/records?${qs}`);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`PocketBase list "${collection}" failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { items?: PbRecord[] };
  return data.items ?? [];
}
