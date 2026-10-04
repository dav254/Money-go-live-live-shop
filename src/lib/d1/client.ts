/**
 * CLOUDFLARE D1 — server-only REST client.
 *
 * Next.js server routes can't receive Wrangler bindings, so D1 is queried
 * over Cloudflare's REST API:
 *   POST /accounts/{account_id}/d1/database/{database_id}/query
 *
 * Required keys (Settings → Environment):
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_API_TOKEN
 *   D1_DATABASE_ID
 *
 * This module is the ONLY place D1 configuration is read — the browser
 * never sees the account ID, token or database ID.
 */

export interface D1QueryResultRow {
  [column: string]: unknown;
}

export interface D1QueryResult<T extends D1QueryResultRow = D1QueryResultRow> {
  results: T[];
  success: boolean;
  meta: {
    changes?: number;
    duration?: number;
    last_row_id?: number;
    rows_read?: number;
    rows_written?: number;
    [key: string]: unknown;
  };
}

interface CloudflareQueryResponse<T extends D1QueryResultRow> {
  success?: boolean;
  errors?: { code?: number; message?: string }[];
  messages?: { message?: string }[];
  result?: D1QueryResult<T>[];
}

/** True when all three D1 keys are present — controls graceful degradation. */
export function d1Configured(): boolean {
  return !!(
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() &&
    process.env.CLOUDFLARE_API_TOKEN?.trim() &&
    process.env.D1_DATABASE_ID?.trim()
  );
}

/**
 * Run one SQL statement (optionally parameterized) against the D1 database.
 * Returns every statement result; `SELECT 1` yields one entry, batches more.
 */
export async function d1Query<T extends D1QueryResultRow = D1QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<D1QueryResult<T>[]> {
  const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID ?? '').trim();
  const apiToken = (process.env.CLOUDFLARE_API_TOKEN ?? '').trim();
  const databaseId = (process.env.D1_DATABASE_ID ?? '').trim();

  if (!accountId || !apiToken || !databaseId) {
    throw new Error(
      'Cloudflare D1 is not configured. Add CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN and D1_DATABASE_ID in Settings → Environment.',
    );
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
      cache: 'no-store',
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `D1 query failed (HTTP ${res.status})${text ? `: ${text.slice(0, 300)}` : ''}`,
    );
  }

  const json = (await res.json()) as CloudflareQueryResponse<T>;
  if (json.success === false) {
    const message =
      json.errors?.map((e) => e.message).filter(Boolean).join('; ') ||
      'D1 query rejected by Cloudflare.';
    throw new Error(message);
  }

  return json.result ?? [];
}
