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
 * SUPERUSER-ONLY API RULES — the correct way to lock a collection.
 *
 * PocketBase has three rule states, and two of them look almost identical:
 *
 *   null   → "locked": only an authorised superuser may perform the action.
 *            This is what a server-owned collection wants.
 *   ""     → NO restriction: every guest, every authenticated user, every
 *            scraper on the internet may perform the action.
 *   filter → allowed only when the expression matches.
 *
 * The empty string is therefore the opposite of "locked" — clearing a rule box
 * in the dashboard does not remove access, it opens the action to the world.
 * (https://pocketbase.io/docs/api-rules-and-filters/)
 *
 * This constant exists because the previous code used `''` with a comment
 * claiming it meant "nobody but the superuser". It did not: it published
 * every one of these collections — including `social_engine_connections`, whose
 * `data`/`tokens` field holds sealed provider credentials — for anonymous
 * read AND write. `null` is the fix.
 */
export const SUPERUSER_ONLY_RULES = {
  listRule: null,
  viewRule: null,
  createRule: null,
  updateRule: null,
  deleteRule: null,
} as const;

/** The `fsId` column name every section uses as its logical primary key. */
export const LOGICAL_ID_FIELD = 'fsId';

/** SQL for a unique index on the logical id — the duplicate-row safeguard. */
export function uniqueIndexSql(collection: string): string {
  // Identifier is the collection name, which is never user input: every caller
  // passes a module constant.
  return `CREATE UNIQUE INDEX \`idx_${collection}_fsid\` ON \`${collection}\` (\`fsId\`)`;
}

export interface PbCollectionRules {
  listRule: string | null;
  viewRule: string | null;
  createRule: string | null;
  updateRule: string | null;
  deleteRule: string | null;
}

/** Everything a verification run needs to know about one collection. */
export interface PbCollectionState {
  exists: boolean;
  /** Null when the collection is missing or unreadable. */
  rules: PbCollectionRules | null;
  /** True only when all five rules are `null` (superuser-only). */
  locked: boolean;
  indexes: string[];
  /** Row count, or null when it could not be read. */
  totalItems: number | null;
}

const EMPTY_RULES: PbCollectionRules = {
  listRule: null,
  viewRule: null,
  createRule: null,
  updateRule: null,
  deleteRule: null,
};

function rulesFrom(detail: Record<string, unknown>): PbCollectionRules {
  const pick = (key: keyof PbCollectionRules): string | null => {
    const value = detail[key];
    return typeof value === 'string' ? value : null;
  };
  return {
    listRule: pick('listRule'),
    viewRule: pick('viewRule'),
    createRule: pick('createRule'),
    updateRule: pick('updateRule'),
    deleteRule: pick('deleteRule'),
  };
}

function rulesAreLocked(rules: PbCollectionRules): boolean {
  return (Object.keys(EMPTY_RULES) as Array<keyof PbCollectionRules>).every(
    (key) => rules[key] === null,
  );
}

/**
 * Reads a collection's schema, rules and row count. Read-only: used by the
 * verification command, never by a request path.
 */
export async function pbGetCollection(name: string): Promise<PbCollectionState> {
  const res = await pbRequest(`/api/collections/${encodeURIComponent(name)}`);
  if (res.status === 404) return { exists: false, rules: null, locked: false, indexes: [], totalItems: null };
  if (!res.ok) return { exists: false, rules: null, locked: false, indexes: [], totalItems: null };

  const detail = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!detail) return { exists: false, rules: null, locked: false, indexes: [], totalItems: null };

  const rules = rulesFrom(detail);
  const indexes = Array.isArray(detail.indexes)
    ? detail.indexes.filter((i): i is string => typeof i === 'string')
    : [];

  let totalItems: number | null = null;
  const countRes = await pbRequest(
    `/api/collections/${encodeURIComponent(name)}/records?perPage=1&page=1`,
  );
  if (countRes.ok) {
    const page = (await countRes.json().catch(() => null)) as { totalItems?: unknown } | null;
    if (typeof page?.totalItems === 'number') totalItems = page.totalItems;
  }

  return { exists: true, rules, locked: rulesAreLocked(rules), indexes, totalItems };
}

/**
 * Ensures one collection exists with the correct schema, a unique index on the
 * logical id, and SUPERUSER-ONLY access rules.
 *
 * Sends `fields` for PocketBase ≥ 0.25 and falls back to `schema` for older
 * instances, so the same code works on any version the VPS installs.
 */
export async function ensureCollection(name: string, fields: PbField[]): Promise<void> {
  const existing = await pbRequest(`/api/collections/${encodeURIComponent(name)}`);

  if (!existing.ok) {
    if (await createCollection(name, fields)) return;

    // A concurrent request may have created it between our GET and POST. If it
    // now exists, fall through and repair it instead of failing the caller.
    const retry = await pbRequest(`/api/collections/${encodeURIComponent(name)}`);
    if (!retry.ok) {
      throw new Error(`Could not create PocketBase collection "${name}" (${retry.status})`);
    }
    await repairCollection(name, fields, await readDetail(retry));
    return;
  }

  await repairCollection(name, fields, await readDetail(existing));
}

async function readDetail(res: Response): Promise<Record<string, unknown> | null> {
  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}

/** POST the collection, trying the modern and legacy schema key. */
async function createCollection(name: string, fields: PbField[]): Promise<boolean> {
  const base: Record<string, unknown> = {
    name,
    type: 'base',
    ...SUPERUSER_ONLY_RULES,
  };
  // A unique index on the logical id is what stops a race (or a retried write)
  // from silently accumulating two rows for one logical document. Only added
  // when the section actually keys on fsId.
  if (fields.some((f) => f.name === LOGICAL_ID_FIELD)) {
    base.indexes = [uniqueIndexSql(name)];
  }

  for (const schemaKey of ['fields', 'schema'] as const) {
    const res = await pbRequest('/api/collections', {
      method: 'POST',
      body: JSON.stringify({ ...base, [schemaKey]: fields }),
    });
    if (res.ok) return true;
    // A 400 on the first attempt may mean "already exists" (legacy vs modern),
    // or a legacy instance rejecting `fields`. Try the other key; the caller
    // re-checks existence afterwards either way.
  }
  return false;
}

/**
 * Brings an existing collection up to the current contract: missing columns are
 * added, access rules are locked to superusers, and the fsId uniqueness index
 * is present.
 *
 * Every step here only ever TIGHTENS the collection (a `null` rule is more
 * restrictive than `""`). Nothing is dropped and no column is removed.
 */
async function repairCollection(
  name: string,
  fields: PbField[],
  detail: Record<string, unknown> | null,
): Promise<void> {
  if (!detail) return;

  // ── 1. Rules ──────────────────────────────────────────────────────────────
  const rules = rulesFrom(detail);
  if (!rulesAreLocked(rules)) {
    const res = await pbRequest(`/api/collections/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      body: JSON.stringify(SUPERUSER_ONLY_RULES),
    });
    if (!res.ok) {
      // Loud on purpose: this is the difference between a private store and a
      // publicly writable one, so it must never fail silently.
      console.error(
        `[pocketbase] SECURITY: could not lock access rules on "${name}" (${res.status}). ` +
          'This collection may be publicly readable/writable until it is fixed.',
      );
    }
  }

  // ── 2. Columns ────────────────────────────────────────────────────────────
  const current = (detail.fields ?? detail.schema) as { name: string }[] | undefined;
  if (Array.isArray(current)) {
    const have = new Set(current.map((f) => f.name));
    const missing = fields.filter((f) => !have.has(f.name));
    if (missing.length > 0) {
      const schemaKey = detail.fields ? 'fields' : 'schema';
      const res = await pbRequest(`/api/collections/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        body: JSON.stringify({ [schemaKey]: [...current, ...missing] }),
      });
      if (!res.ok) {
        // Non-fatal: record writes will report the missing column themselves.
        console.error(`[pocketbase] adding fields to "${name}" failed (${res.status})`);
      }
    }
  }

  // ── 3. fsId uniqueness ────────────────────────────────────────────────────
  if (!fields.some((f) => f.name === LOGICAL_ID_FIELD)) return;
  const indexes = Array.isArray(detail.indexes)
    ? detail.indexes.filter((i): i is string => typeof i === 'string')
    : [];
  const alreadyUnique = indexes.some(
    (sql) => /unique/i.test(sql) && sql.toLowerCase().includes(LOGICAL_ID_FIELD.toLowerCase()),
  );
  if (alreadyUnique) return;

  const res = await pbRequest(`/api/collections/${encodeURIComponent(name)}`, {
    method: 'PATCH',
    body: JSON.stringify({ indexes: [...indexes, uniqueIndexSql(name)] }),
  });
  if (!res.ok) {
    // Existing duplicate rows are the usual cause. Report it as an integrity
    // problem to fix — but never delete anyone's data to make the index fit.
    console.error(
      `[pocketbase] could not add the fsId unique index to "${name}" (${res.status}). ` +
        'Duplicate logical ids may already exist; resolve them before relying on uniqueness.',
    );
  }
}

/**
 * Race-safe create for an fsId-keyed row.
 *
 * The read-then-create flow in the writers has a window: two concurrent writes
 * for the same logical id both see "no row" and both POST. With the unique index
 * in place the loser gets a 400 — so instead of throwing, re-read the winner and
 * PATCH it. The result is exactly one row per logical id, always.
 */
export async function pbCreateRecordKeyed(
  collection: string,
  fsId: string,
  body: Record<string, unknown>,
): Promise<'created' | 'merged'> {
  const res = await pbRequest(`/api/collections/${encodeURIComponent(collection)}/records`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (res.ok) return 'created';

  const detail = await res.text().catch(() => '');
  if (res.status === 400 || res.status === 409) {
    const escaped = fsId.replace(/'/g, "\\'");
    const rows = await pbListRecords(collection, {
      filter: `${LOGICAL_ID_FIELD} = '${escaped}'`,
      perPage: 1,
    });
    const winner = rows[0];
    if (winner) {
      const patched = await pbRequest(
        `/api/collections/${encodeURIComponent(collection)}/records/${winner.id}`,
        { method: 'PATCH', body: JSON.stringify(body) },
      );
      if (!patched.ok) {
        throw new Error(`PocketBase update "${collection}/${fsId}" failed (${patched.status})`);
      }
      return 'merged';
    }
  }

  throw new Error(
    `PocketBase create "${collection}/${fsId}" failed (${res.status}): ${detail.slice(0, 300)}`,
  );
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
