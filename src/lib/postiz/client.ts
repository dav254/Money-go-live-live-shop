/**
 * Server-only HTTP client for a self-hosted Postiz instance
 * (https://social.vidnov.com → 127.0.0.1:4007 on the VPS).
 *
 * Contracts, verified against https://docs.postiz.com/public-api:
 *   GET  /public/v1/integrations → [{ id, name, identifier, disabled, profile }]
 *   POST /public/v1/posts        → [{ postId, integration }]   (types: draft|schedule|now)
 *
 * Rules honoured here:
 *   • the API key never leaves the server and never appears in any message;
 *   • upstream response bodies are never echoed — failures return a static
 *     message plus a safe error class (same contract as Vidnov's other
 *     outbound adapters);
 *   • Vidnov only ever sends `draft` or `schedule` — never `now`.
 */

// Guard: this module carries the API key. Importing it from a client
// component would put the key in the browser bundle; refuse loudly.
if (typeof window !== 'undefined') {
  throw new Error('[postiz] server-only module imported in the browser');
}

export type PostizErrorClass =
  | 'not_configured'
  | 'auth'
  | 'validation'
  | 'rate_limited'
  | 'transient'
  | 'unknown';

export interface PostizConfig {
  /** Base URL, no trailing slash, e.g. https://social.vidnov.com */
  url: string;
  key: string;
}

/** Resolves config from server env vars. Returns null when unset/invalid. */
export function getPostizConfig(
  env: Record<string, string | undefined> = process.env,
): PostizConfig | null {
  const url = (env.POSTIZ_API_URL ?? '').trim().replace(/\/+$/, '');
  const key = (env.POSTIZ_API_KEY ?? '').trim();
  if (!url || !key) return null;
  if (!/^https?:\/\/.+/i.test(url)) return null;
  return { url, key };
}

/** Static, secret-free failure copy — one per class, never upstream text. */
const STATIC_ERROR: Record<PostizErrorClass, string> = {
  not_configured: 'Postiz is not configured on the server (POSTIZ_API_URL / POSTIZ_API_KEY missing).',
  auth: 'Postiz rejected the API key.',
  validation: 'Postiz could not accept this request.',
  rate_limited: 'Postiz rate limit reached — try again later.',
  transient: 'Postiz is unreachable right now.',
  unknown: 'Postiz returned an unexpected result.',
};

export function classifyHttpStatus(status: number): PostizErrorClass {
  if (status === 401 || status === 403) return 'auth';
  if (status === 400 || status === 404 || status === 413) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'transient';
  return 'unknown';
}

export interface PostizResult<T> {
  ok: boolean;
  value?: T;
  errorClass?: PostizErrorClass;
  message?: string;
  httpStatus?: number;
}

export interface PostizChannel {
  id: string;
  /** Provider identifier — becomes settings.__type when creating a post. */
  identifier: string;
  name: string;
  profile?: string;
  disabled: boolean;
}

type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

const DEFAULT_TIMEOUT_MS = 10_000;

function failure<T>(errorClass: PostizErrorClass, httpStatus?: number): PostizResult<T> {
  return {
    ok: false,
    errorClass,
    message: STATIC_ERROR[errorClass],
    ...(httpStatus !== undefined ? { httpStatus } : {}),
  };
}

async function request<T>(
  config: PostizConfig,
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
  deps: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<PostizResult<T>> {
  const fetchImpl = (deps.fetchImpl ?? fetch) as unknown as FetchLike;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${config.url}${path}`, {
      method: init.method,
      headers: {
        Authorization: config.key,
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      signal: controller.signal,
    });
    if (!res.ok) {
      // Read the body only to settle the connection — never echoed.
      await res.text().catch(() => '');
      return failure<T>(classifyHttpStatus(res.status), res.status);
    }
    try {
      return { ok: true, value: (await res.json()) as T, httpStatus: res.status };
    } catch {
      return failure<T>('unknown', res.status);
    }
  } catch {
    // Network error or timeout — classified as transient, no details kept.
    return failure<T>('transient');
  } finally {
    clearTimeout(timer);
  }
}

/** GET /public/v1/integrations — connected channels (and a live key check). */
export async function postizListChannels(
  config: PostizConfig,
  deps: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<PostizResult<PostizChannel[]>> {
  const res = await request<unknown[]>(config, '/public/v1/integrations', { method: 'GET' }, deps);
  if (!res.ok || !Array.isArray(res.value)) {
    return { ...res, value: undefined, ...(res.ok ? { errorClass: 'unknown' as const } : {}) };
  }
  const channels: PostizChannel[] = [];
  for (const raw of res.value) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id : '';
    const identifier = typeof row.identifier === 'string' ? row.identifier : '';
    if (!id || !identifier) continue;
    channels.push({
      id,
      identifier,
      name: typeof row.name === 'string' && row.name ? row.name : identifier,
      ...(typeof row.profile === 'string' ? { profile: row.profile } : {}),
      disabled: row.disabled === true,
    });
  }
  return { ok: true, value: channels, httpStatus: res.httpStatus };
}

export interface CreatePostInput {
  /** Vidnov only ever creates drafts or scheduled posts. */
  type: 'draft' | 'schedule';
  /** ISO 8601 date (required by the API; informational for drafts). */
  date: string;
  content: string;
  /** Channel ids validated against GET /integrations (provider implied). */
  channels: Array<{ id: string; identifier: string }>;
}

export interface CreatedPost {
  postId: string;
}

/** POST /public/v1/posts — create one post across the given channels. */
export async function postizCreatePost(
  config: PostizConfig,
  input: CreatePostInput,
  deps: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<PostizResult<CreatedPost[]>> {
  const body = {
    type: input.type,
    date: input.date,
    shortLink: false,
    tags: [],
    posts: input.channels.map((channel) => ({
      integration: { id: channel.id },
      value: [{ content: input.content, image: [] }],
      settings: { __type: channel.identifier },
    })),
  };
  const res = await request<unknown[]>(config, '/public/v1/posts', { method: 'POST', body }, deps);
  if (!res.ok) return { ...res, value: undefined };
  const rows = Array.isArray(res.value) ? res.value : [];
  const created: CreatedPost[] = [];
  for (const row of rows) {
    const postId =
      row && typeof row === 'object' && typeof (row as { postId?: unknown }).postId === 'string'
        ? ((row as { postId: string }).postId)
        : '';
    if (postId) created.push({ postId });
  }
  // 200 with no parsable ids is not a success we can report — honest unknown.
  if (created.length === 0) return failure<CreatedPost[]>('unknown', res.httpStatus);
  return { ok: true, value: created, httpStatus: res.httpStatus };
}
