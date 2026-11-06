import { API_BASE_URL } from './config';

/**
 * NETWORK LAYER.
 *
 * One place that knows how to talk to Vidnov: absolute base URL, bearer token,
 * JSON, a hard timeout (a hung socket must become a visible error, not an
 * endless spinner) and error messages the UI can show verbatim.
 *
 * Every call below targets an endpoint that already exists on vidnov.com and is
 * shared with the website. The app does not have its own database, and it does
 * not talk to Firestore directly — the server owns every read and write, and
 * the mobile routes added for this client (`/api/mobile/*`) return strict
 * public projections rather than raw documents.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const DEFAULT_TIMEOUT_MS = 20_000;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  timeoutMs?: number;
};

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? safeJson(text) : null;

    if (!response.ok) {
      const message =
        (payload && typeof payload === 'object' && (payload.error || payload.message)) ||
        `Vidnov returned an error (${response.status}).`;
      throw new ApiError(String(message), response.status, payload?.code);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as Error)?.name === 'AbortError') {
      throw new ApiError('That took too long. Check your connection and try again.', 0, 'timeout');
    }
    throw new ApiError('Could not reach Vidnov. Check your connection and try again.', 0, 'network');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Multipart upload — the media pipeline is one file per request and answers
 * with the processed asset synchronously for images.
 */
export async function apiUpload<T>(
  path: string,
  form: FormData,
  token: string,
  timeoutMs = 90_000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: form as unknown as BodyInit,
      signal: controller.signal,
    });
    const text = await response.text();
    const payload = text ? safeJson(text) : null;
    if (!response.ok) {
      const message =
        (payload && typeof payload === 'object' && (payload.error || payload.message)) ||
        `Upload failed (${response.status}).`;
      throw new ApiError(String(message), response.status, payload?.code);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as Error)?.name === 'AbortError') {
      throw new ApiError('The upload took too long. Try a smaller file.', 0, 'timeout');
    }
    throw new ApiError('Could not upload. Check your connection and try again.', 0, 'network');
  } finally {
    clearTimeout(timer);
  }
}

/** Human-readable message for any thrown value. */
export function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong.';
}

/* ── Public catalog ──────────────────────────────────────────────────────── */

export const catalog = {
  search: (params: { q?: string; category?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.category) qs.set('category', params.category);
    qs.set('limit', String(params.limit ?? 30));
    return apiRequest<{ products: any[]; sellers: any[] }>(`/api/search?${qs.toString()}`);
  },
  listing: (id: string) =>
    apiRequest<{ listing: any; seller: any | null }>(
      `/api/mobile/listing/${encodeURIComponent(id)}`,
    ),
  shopListings: (sellerId: string, limit = 40) =>
    apiRequest<{ listings: any[] }>(
      `/api/mobile/catalog?sellerId=${encodeURIComponent(sellerId)}&limit=${limit}`,
    ),
  shelf: (params: { category?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.category) qs.set('category', params.category);
    qs.set('limit', String(params.limit ?? 20));
    return apiRequest<{ listings: any[] }>(`/api/mobile/catalog?${qs.toString()}`);
  },
  liveNow: () =>
    apiRequest<{ rooms?: Array<{ id: string; sellerId: string; title: string; viewerCount: number }> }>(
      '/api/home/live',
    ),
  business: (sellerId: string) =>
    apiRequest<any>(`/api/public/business/${encodeURIComponent(sellerId)}`),
};

/* ── Account ─────────────────────────────────────────────────────────────── */

export const account = {
  profile: (token: string) => apiRequest<{ profile: any }>('/api/auth/profile', { token }),
  ensureProfile: (token: string, body: { role: string; name?: string }) =>
    apiRequest<{ ok: boolean; profile: any }>('/api/auth/profile', { method: 'POST', body, token }),
  /** Records a dated deletion request — support performs the purge. */
  requestDeletion: (token: string, reason?: string) =>
    apiRequest<{ ok: boolean; message: string }>('/api/account/delete-request', {
      method: 'POST',
      body: { reason },
      token,
    }),
};

/* ── Messaging ───────────────────────────────────────────────────────────── */

export const messaging = {
  /** Inbox with the other participant already resolved (server-side join). */
  threads: (token: string) => apiRequest<{ chats: any[] }>('/api/mobile/chats', { token }),
  chats: (token: string) => apiRequest<{ chats: any[] }>('/api/chat', { token }),
  messages: (token: string, chatId: string) =>
    apiRequest<{ messages: any[] }>(`/api/chat/${encodeURIComponent(chatId)}/messages?limit=200`, {
      token,
    }),
  send: (
    token: string,
    chatId: string,
    body: { clientMsgId: string; messageType: 'text'; messageText: string },
  ) =>
    apiRequest<{ message?: any }>(`/api/chat/${encodeURIComponent(chatId)}/messages`, {
      method: 'POST',
      body,
      token,
    }),
  open: (token: string, participantId: string) =>
    apiRequest<{ chat?: any; chatId?: string; id?: string }>('/api/chat', {
      method: 'POST',
      body: { participantId },
      token,
    }),
};

/* ── Notifications ───────────────────────────────────────────────────────── */

export const notifications = {
  list: (token: string) =>
    apiRequest<{ items: any[]; unread: number }>('/api/notifications?limit=50', { token }),
  unread: (token: string) => apiRequest<{ unread: number }>('/api/notifications?count=unread', { token }),
  markAllRead: (token: string) =>
    apiRequest<{ ok?: boolean }>('/api/notifications/read-all', { method: 'POST', token }),
  markRead: (token: string, id: string) =>
    apiRequest<{ ok?: boolean }>(`/api/notifications/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { isRead: true },
      token,
    }),
};

/* ── Commerce ────────────────────────────────────────────────────────────── */

export const commerce = {
  buyerOrders: (token: string) =>
    apiRequest<{ orders: any[]; source?: string }>('/api/mobile/orders', { token }),
  sellerOrders: (token: string) => apiRequest<any[]>('/api/seller/orders', { token }),
  /** Seller fulfilment transition — the route is PUT and enforces the allowed set. */
  setOrderStatus: (token: string, orderId: string, status: string) =>
    apiRequest<{ ok?: boolean; order?: any }>(`/api/seller/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PUT',
      body: { status },
      token,
    }),
  sellerOffers: (token: string) => apiRequest<{ offers: any[] }>('/api/requests/offers?mine=1', { token }),
  myRequests: (token: string) => apiRequest<{ requests: any[] }>('/api/requests?scope=mine', { token }),
  openRequests: (token: string) => apiRequest<{ requests: any[] }>('/api/requests?scope=open', { token }),
};

/* ── Saved items ─────────────────────────────────────────────────────────── */

/**
 * `userProfiles/{uid}.wishlist` — the same field the website's saved-items page
 * reads. Writes go through the server so the array update is atomic.
 */
export const saved = {
  list: (token: string) => apiRequest<{ items: any[] }>('/api/mobile/saved', { token }),
  set: (token: string, listingId: string, value: boolean) =>
    apiRequest<{ ok: boolean; saved: boolean }>('/api/mobile/saved', {
      method: 'POST',
      body: { listingId, saved: value },
      token,
    }),
};

/* ── Seller ──────────────────────────────────────────────────────────────── */

export const seller = {
  overview: (token: string) =>
    apiRequest<{
      orders: { total: number; needsAction: number; delivered: number; cancelled: number };
      listings: { total: number; outOfStock: number };
      deliveredRevenue: number;
    }>('/api/mobile/seller/overview', { token }),
  products: (token: string) =>
    apiRequest<{ products: any[]; source?: string }>('/api/products/mine', { token }),
};

/* ── Live ────────────────────────────────────────────────────────────────── */

export const live = {
  /** Signed-in discovery feed — richer cards than the public strip. */
  streams: (token: string) => apiRequest<{ streams: any[] }>('/api/live', { token }),
};

/* ── AI Studio ───────────────────────────────────────────────────────────── */

export const ai = {
  generate: (token: string, body: Record<string, unknown>) =>
    apiRequest<{ jobId: string }>('/api/ai/generate', {
      method: 'POST',
      body,
      token,
      timeoutMs: 90_000,
    }),
  job: (token: string, id: string) =>
    apiRequest<{ job: any }>(`/api/ai/jobs?id=${encodeURIComponent(id)}`, { token }),
  jobs: (token: string) => apiRequest<{ jobs: any[] }>('/api/ai/jobs', { token }),
};

/* ── Media ───────────────────────────────────────────────────────────────── */

export const media = {
  /**
   * Uploads one image to the shared media pipeline. `folder` is validated
   * server-side (avatars/<uid>, products/<uid>, …) — the client cannot invent
   * a destination.
   */
  uploadImage: async (token: string, uri: string, folder: string, name = 'upload.jpg') => {
    const form = new FormData();
    form.append('folder', folder);
    // React Native's FormData accepts this file descriptor shape.
    form.append('file', { uri, name, type: 'image/jpeg' } as unknown as Blob);
    return apiUpload<{ accepted?: boolean; url?: string; mediaId?: string; id?: string }>(
      '/api/media/upload',
      form,
      token,
    );
  },
};
