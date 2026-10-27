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

/**
 * Firestore Timestamp / Date → ISO string; anything else passes through
 * structurally (arrays/objects recursed), primitives kept, FieldValue
 * sentinels dropped. This is what lets a document full of server Timestamps
 * live in a PocketBase JSON field.
 */
export function scrubForPocketBase(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) return value.map(scrubForPocketBase);
  // Plain JS `Date` (the live/request services stamp `new Date()`): it has no
  // `toDate()`, so without this branch it fell through to the object walk and
  // serialised as `{}` — a whole timestamp lost.
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const maybeDate = value as { toDate?: () => Date };
  if (typeof maybeDate.toDate === 'function') {
    try {
      return maybeDate.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // FieldValue sentinels (server SDK) have no meaningful JSON form.
      if (v && typeof v === 'object' && '_methodName' in (v as object)) continue;
      out[k] = scrubForPocketBase(v);
    }
    return out;
  }
  return null;
}

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
  if (existing.ok) {
    /*
     * Collection already exists — but a section gaining a new column (e.g.
     * `user_profiles` gaining `aiPoints` when the live-session charge moved
     * over) must still land on it. Diff the schema and PATCH in only what is
     * missing; an unchanged collection costs one GET and no write.
     */
    const detail = (await existing.json().catch(() => null)) as
      | { fields?: { name: string }[]; schema?: { name: string }[] }
      | null;
    const current = detail?.fields ?? detail?.schema ?? null;
    if (!current) return;
    const have = new Set(current.map((f) => f.name));
    const missing = fields.filter((f) => !have.has(f.name));
    if (missing.length === 0) return;
    const schemaKey = detail?.fields ? 'fields' : 'schema';
    const res = await pbRequest(`/api/collections/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      body: JSON.stringify({ [schemaKey]: [...current, ...missing] }),
    });
    if (!res.ok) {
      // Non-fatal: record writes will report the missing column themselves.
      console.error(`[pocketbase] adding fields to "${name}" failed (${res.status})`);
    }
    return;
  }

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

/** Delete a record by id. Throws on failure (callers that must not throw catch). */
export async function pbDelete(collection: string, id: string): Promise<boolean> {
  const res = await pbRequest(`/api/collections/${encodeURIComponent(collection)}/records/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) {
    const detail = await res.text().catch(() => '');
    throw new Error(`PocketBase delete "${collection}/${id}" failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return true;
}

/** One page of records plus the collection total — the pagination contract. */
export interface PbRecordPage {
  items: PbRecord[];
  totalItems: number;
}

/**
 * One paginated page of a collection. `totalItems` lets callers walk pages
 * until every record is read (the sitemap's catalogue pass needs the whole
 * collection, capped) without a second count request.
 */
export async function pbListRecordsPage(
  collection: string,
  params: { sort?: string; perPage?: number; page?: number; filter?: string; fields?: string } = {},
): Promise<PbRecordPage> {
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
  const data = (await res.json()) as { items?: PbRecord[]; totalItems?: number };
  const items = data.items ?? [];
  const totalItems =
    typeof data.totalItems === 'number' && Number.isFinite(data.totalItems)
      ? data.totalItems
      : items.length;
  return { items, totalItems };
}

export async function pbListRecords(
  collection: string,
  params: { sort?: string; perPage?: number; page?: number; filter?: string; fields?: string } = {},
): Promise<PbRecord[]> {
  return (await pbListRecordsPage(collection, params)).items;
}
