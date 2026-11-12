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
      /*
       * `message` first, then `details`, then `error`: some routes answer with
       * a code in `error` and the sentence a person can act on in `details`
       * ("You need 100 points to start a 70-minute session."). Showing the
       * raw code was the difference between a seller understanding the
       * refusal and reading "Insufficient AI Points" as a crash.
       */
      const message =
        (payload && typeof payload === 'object' &&
          (payload.message || payload.details || payload.error)) ||
        `Vidnov returned an error (${response.status}).`;
      throw new ApiError(String(message), response.status, payload?.code ?? payload?.error);
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
  /**
   * `/api/search` already accepts `location` and `inStockOnly` — the website's
   * search bar sends both. Passing them through here means the app filters on
   * the server over the whole collection instead of filtering a page of 30
   * results on the device.
   */
  search: (params: {
    q?: string;
    category?: string;
    location?: string;
    inStockOnly?: boolean;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.category) qs.set('category', params.category);
    if (params.location) qs.set('location', params.location);
    if (params.inStockOnly) qs.set('inStockOnly', '1');
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
  /**
   * The like button. The website increments `products/{id}.likes` from the
   * browser; the app has no Firestore client, so the same field is written
   * through a server route instead. Sending the intended end state (not a
   * toggle) keeps a retry from double-counting.
   */
  like: (token: string, listingId: string, liked: boolean) =>
    apiRequest<{ ok: boolean; liked: boolean; likes: number }>(
      `/api/mobile/listing/${encodeURIComponent(listingId)}/like`,
      { method: 'POST', body: { liked }, token },
    ),
  /** Public thread under a listing (`products/{id}/comments`). */
  comments: (listingId: string) =>
    apiRequest<{ comments: ListingComment[]; count: number }>(
      `/api/mobile/listing/${encodeURIComponent(listingId)}/comments`,
    ),
  comment: (token: string, listingId: string, text: string) =>
    apiRequest<{ ok: boolean; comment: ListingComment }>(
      `/api/mobile/listing/${encodeURIComponent(listingId)}/comments`,
      { method: 'POST', body: { text }, token },
    ),
};

/** One line under a listing — the shape both the web and this route write. */
export interface ListingComment {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  createdAt: string | null;
}

/* ── Discovery (the server query the website's Shop panel uses) ──────────── */

export type DiscoverKind = 'all' | 'listings' | 'businesses' | 'products' | 'services';
export type DiscoverSort = 'relevance' | 'newest' | 'nearby';

export interface DiscoverListingItem {
  kind: 'product' | 'service';
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  localPrice?: number;
  localCurrency?: string;
  priceMode?: 'quote' | 'hourly' | 'fixed';
  category?: string;
  location?: string;
  availabilityState?: string;
  availabilityLabel?: string;
  availableNow: boolean;
  sponsored: boolean;
  sellerId: string;
  sellerName?: string;
  shopHref: string;
  href: string;
  distanceKm?: number;
  score: number;
}

export interface DiscoverBusinessItem {
  kind: 'business';
  id: string;
  name: string;
  slug: string;
  category?: string;
  description?: string;
  logoUrl?: string;
  location?: string;
  verificationStatus?: string;
  verified: boolean;
  distanceKm?: number;
  shopHref: string;
  score: number;
}

export type DiscoverItem = DiscoverListingItem | DiscoverBusinessItem;

export interface DiscoverPage {
  items: DiscoverItem[];
  total: number;
  businesses: number;
  listings: number;
  page: number;
  limit: number;
  hasMore: boolean;
  scanned: number;
  windowCapped: boolean;
}

/**
 * `GET /api/discover` — the same ranked public query the website's Shop panel
 * calls, so the app cannot rank the catalogue differently. Rate limited by the
 * server; callers debounce.
 */
export const discover = {
  search: (params: {
    q?: string;
    kind?: DiscoverKind;
    category?: string;
    location?: string;
    availability?: 'any' | 'available';
    sort?: DiscoverSort;
    page?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.kind && params.kind !== 'all') qs.set('kind', params.kind);
    if (params.category) qs.set('category', params.category);
    if (params.location) qs.set('location', params.location);
    if (params.availability === 'available') qs.set('availability', 'available');
    if (params.sort && params.sort !== 'relevance') qs.set('sort', params.sort);
    qs.set('page', String(params.page ?? 1));
    qs.set('limit', String(params.limit ?? 24));
    return apiRequest<DiscoverPage>(`/api/discover?${qs.toString()}`);
  },
};

/* ── Home feed ───────────────────────────────────────────────────────────── */

/**
 * One shop on the home screen. Everything here is derived from a real
 * `businesses` document — there is no seeded or "featured" content.
 */
export interface HomeBusiness {
  id: string;
  sellerId: string;
  name: string;
  slug?: string;
  category?: string;
  logoUrl?: string;
  verified: boolean;
  area?: string;
  distanceKm?: number | null;
  location?: PublicBusinessLocation | null;
}

export interface PublicBusinessLocation {
  lat?: number;
  lng?: number;
  areaName?: string;
  cityName?: string;
  countyName?: string;
  address?: string;
  label: string;
  precise: boolean;
}

export interface HomeRequest {
  id: string;
  title: string;
  category: string;
  location: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  offersCount: number;
  createdAt: string | null;
  expiresAt: string | null;
}

export interface HomeFeed {
  signedIn: boolean;
  /** The signed-in buyer's own area label, or null when none is saved. */
  locationLabel?: string | null;
  categories: Array<{ id: string; label: string; count: number }>;
  nearby: { needsLocation: boolean; businesses: HomeBusiness[] };
  featured: HomeBusiness[];
  recommended: HomeBusiness[];
  listings: any[];
  live: Array<{ id: string; sellerId: string; title: string; viewerCount: number }>;
  requests: HomeRequest[];
  generatedAt: string;
}

/**
 * One composed read for the whole home screen — six round trips became one on
 * a phone, and every section is the same real data the website shows.
 */
export const home = {
  feed: () => apiRequest<HomeFeed>('/api/mobile/home', { timeoutMs: 30_000 }),
};

/* ── Nearby ──────────────────────────────────────────────────────────────── */

/**
 * Shops that serve the signed-in buyer's area. The server derives the area from
 * the buyer's own profile — this client never sends coordinates, and the
 * response only ever contains approximate locations.
 */
export interface NearbyBusiness {
  id: string;
  sellerId: string;
  name: string;
  slug?: string;
  category?: string;
  verificationStatus?: string;
  rating?: number | null;
  tier?: { label?: string; name?: string } | null;
  completedTransactions?: number;
  approximateLocation?: string | null;
  distanceKm?: number | null;
}

export const nearby = {
  list: (token: string, radiusKm?: number) => {
    // Kept as concatenation rather than one template literal so the route is a
    // plain string the API-contract test can resolve to `api/nearby/route.ts`.
    const path = '/api/nearby' + (radiusKm ? `?radiusKm=${radiusKm}` : '');
    return apiRequest<{
      needsLocation: boolean;
      message?: string;
      yourArea?: string;
      businesses: NearbyBusiness[];
      listings: any[];
    }>(path, { token, timeoutMs: 30_000 });
  },
};

/* ── Reviews ─────────────────────────────────────────────────────────────── */

export const reviews = {
  /**
   * One review per direction per order. The server decides whether the caller
   * may review (must be a party to the order, order must be finished) — this
   * call only carries the rating and the words.
   */
  create: (token: string, body: { orderId: string; rating: number; text: string }) =>
    apiRequest<{ ok: boolean; side: 'byCustomer' | 'bySeller' }>('/api/reviews', {
      method: 'POST',
      body,
      token,
      timeoutMs: 30_000,
    }),
};

/* ── Account ─────────────────────────────────────────────────────────────── */

export const account = {
  profile: (token: string) => apiRequest<{ profile: any }>('/api/auth/profile', { token }),
  /**
   * Display name, phone, bio and avatar. The route is named for the seller
   * surface but only requires a verified account, so buyers edit the same
   * `userProfiles/{uid}` document the website writes — no second profile store.
   */
  updateProfile: (
    token: string,
    body: { fullName?: string; phoneNumber?: string; bio?: string; profilePictureUrl?: string },
  ) =>
    apiRequest<{ ok: boolean; profile: any }>('/api/mobile/seller/profile', {
      method: 'PATCH',
      body,
      token,
    }),
  ensureProfile: (token: string, body: { role: string; name?: string; phone?: string }) =>
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
    body: {
      clientMsgId: string;
      messageType: 'text' | 'location';
      messageText?: string;
      /** A point chosen once. Live shares are started through `liveLocation`. */
      location?: {
        kind?: 'static';
        lat: number;
        lng: number;
        address?: string;
        label?: string;
      };
    },
  ) =>
    apiRequest<{ message?: any; duplicate?: boolean }>(
      `/api/chat/${encodeURIComponent(chatId)}/messages`,
      { method: 'POST', body, token },
    ),
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
  /** Respond to a buyer brief. The server validates price, status and ownership. */
  submitOffer: (
    token: string,
    requestId: string,
    body: { price: number; message: string; deliveryDays?: number | null; availability?: string | null },
  ) =>
    apiRequest<{ offer: any }>(`/api/requests?action=offer&id=${encodeURIComponent(requestId)}`, {
      method: 'PATCH',
      body,
      token,
      timeoutMs: 30_000,
    }),
  myRequests: (token: string) => apiRequest<{ requests: any[] }>('/api/requests?scope=mine', { token }),
  openRequests: (token: string) => apiRequest<{ requests: any[] }>('/api/requests?scope=open', { token }),

  /* ── Buyer requests (the brief → offer → order flow) ─────────────────── */

  /** One brief the caller posted, with its uploaded media references. */
  request: (token: string, id: string) =>
    apiRequest<{ request: any; media: any[]; mediaAuthorized: boolean }>(
      `/api/requests?id=${encodeURIComponent(id)}`,
      { token },
    ),

  /**
   * Publish a brief. `mediaIds` are references the media pipeline already
   * accepted — the same `mediaId` `/api/media/upload` returns, so an image
   * cannot be attached unless the server actually stored it.
   */
  createRequest: (
    token: string,
    body: {
      title: string;
      description: string;
      category?: string;
      quantity?: number;
      budgetMin?: number | null;
      budgetMax?: number | null;
      location?: string;
      deadline?: string | null;
      fulfilment?: 'delivery' | 'collection' | 'either';
      mediaIds?: string[];
    },
  ) =>
    apiRequest<{ request: any }>('/api/requests', {
      method: 'POST',
      body,
      token,
      timeoutMs: 30_000,
    }),

  /** Offers a seller sent on a brief — owner-only, enforced server-side. */
  offersForRequest: (token: string, requestId: string) =>
    apiRequest<{ offers: any[] }>(
      `/api/requests/offers?requestId=${encodeURIComponent(requestId)}`,
      { token },
    ),

  /** Accepting an offer is what creates the order — the server does both. */
  acceptOffer: (token: string, requestId: string, offerId: string) =>
    apiRequest<{ ok: boolean; orderId?: string }>(
      `/api/requests?action=accept&id=${encodeURIComponent(requestId)}`,
      { method: 'PATCH', body: { offerId }, token, timeoutMs: 30_000 },
    ),

  declineOffer: (token: string, requestId: string, offerId: string) =>
    apiRequest<{ ok: boolean }>(
      `/api/requests?action=decline&id=${encodeURIComponent(requestId)}`,
      { method: 'PATCH', body: { offerId }, token },
    ),

  closeRequest: (token: string, requestId: string) =>
    apiRequest<{ ok: boolean }>(
      `/api/requests?action=close&id=${encodeURIComponent(requestId)}`,
      { method: 'PATCH', token },
    ),
};

/* ── Cart (read) ──────────────────────────────────────────────────────────── */

/**
 * `GET /api/cart` — the caller's own cart, VPS copy first, Firestore second.
 *
 * Read-only on purpose: the website changes cart lines from the browser and
 * there is no cart-write route, so the app shows what is actually in the cart
 * and says where it can be edited. An "Add" button here would have to invent a
 * backend that does not exist.
 */
export interface CartLine {
  id: string;
  productId?: string;
  name?: string;
  title?: string;
  price?: number;
  quantity?: number;
  imageUrl?: string;
  currency?: string;
  sellerId?: string;
}

export const cart = {
  list: (token: string) =>
    apiRequest<{ items: CartLine[]; source?: string }>('/api/cart', { token }),
};

/* ── Referrals ───────────────────────────────────────────────────────────── */

/**
 * Referral balance and redemptions.
 *
 * The balance and the invite slug are already on the profile document
 * `GET /api/auth/profile` returns, so reading them needs no second endpoint —
 * the app shows the same number the website shows. Redeeming is the server's
 * transaction (`/api/referrals/redeem`), never a client-side decrement.
 */
export const referrals = {
  redeem: (token: string, body: { redeem: 'live' | 'cash'; amount?: number; method?: string }) =>
    apiRequest<{ ok: boolean; kind: string; balance: number }>('/api/referrals/redeem', {
      method: 'POST',
      body,
      token,
      timeoutMs: 30_000,
    }),
};

/* ── Following ───────────────────────────────────────────────────────────── */

/**
 * `POST /api/follow` — the write side of `userProfiles/{uid}.following`.
 *
 * The read side needs no route: the field is already on the profile document
 * `GET /api/auth/profile` returns, which is how the website's My sellers page
 * builds its list too. One field, one source.
 */
export const following = {
  set: (token: string, sellerId: string, action: 'follow' | 'unfollow') =>
    apiRequest<{ success?: boolean }>('/api/follow', {
      method: 'POST',
      body: { sellerId, action },
      token,
    }),
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

/** The seller's own storefront document (`sellerShops/{uid}`). */
export interface SellerShop {
  id?: string;
  shopName?: string;
  category?: string;
  description?: string;
  phoneNumber?: string;
  businessEmail?: string;
  location?: string;
  cityTown?: string;
  county?: string;
  website?: string;
  socialLinks?: Array<{ label: string; url: string }>;
  logoUrl?: string;
  bannerUrl?: string;
  businessType?: string;
  offering?: string;
  offersDelivery?: boolean;
  offersPickup?: boolean;
  operatingHours?: string;
  serviceAreas?: string;
  published?: boolean;
  publishedAt?: string;
  updatedAt?: string;
  /** Profile-side fields saved alongside the shop. */
  fullName?: string;
  bio?: string;
}

export interface SellerProductInput {
  name: string;
  description: string;
  category: string;
  listingType: 'product' | 'service';
  condition?: 'new' | 'used';
  price: number;
  currency: string;
  wasPrice?: number | null;
  stock?: number;
  location?: string;
  deliveryOptions?: string;
  tags?: string;
  imageUrls?: string[];
}

export const seller = {
  overview: (token: string) =>
    apiRequest<{
      orders: { total: number; needsAction: number; delivered: number; cancelled: number };
      listings: { total: number; outOfStock: number };
      deliveredRevenue: number;
    }>('/api/mobile/seller/overview', { token }),
  products: (token: string) =>
    apiRequest<{ products: any[]; source?: string }>('/api/products/mine', { token }),
  /** Create a listing — ownership is taken from the bearer token server-side. */
  createProduct: (token: string, body: SellerProductInput) =>
    apiRequest<{ ok: boolean; product: any }>('/api/mobile/seller/products', {
      method: 'POST',
      body,
      token,
      timeoutMs: 45_000,
    }),
  updateProduct: (token: string, id: string, body: SellerProductInput) =>
    apiRequest<{ ok: boolean; product: any }>(
      `/api/mobile/seller/products/${encodeURIComponent(id)}`,
      { method: 'PATCH', body, token, timeoutMs: 45_000 },
    ),
  deleteProduct: (token: string, id: string) =>
    apiRequest<{ ok: boolean }>(`/api/mobile/seller/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      token,
    }),
  /** Own storefront — Firestore first, the VPS copy as the fallback. */
  shop: (token: string) =>
    apiRequest<{ shop: SellerShop | null; source?: string }>('/api/mobile/seller/shop', { token }),
  saveShop: (token: string, body: Partial<SellerShop>) =>
    apiRequest<{ ok: boolean; shop: SellerShop; mirrored?: boolean }>(
      '/api/mobile/seller/shop',
      { method: 'PUT', body, token, timeoutMs: 45_000 },
    ),
  /** Records the buy/sell/both intent and enables seller tools. */
  setAccountType: (token: string, accountType: 'buyer' | 'seller' | 'both') =>
    apiRequest<{ ok: boolean; accountType: string; role: string; canSell: boolean }>(
      '/api/mobile/seller/role',
      { method: 'POST', body: { accountType }, token },
    ),
  /** Own display name, phone, bio and avatar (never email or role). */
  updateProfile: (
    token: string,
    body: { fullName?: string; phoneNumber?: string; bio?: string; profilePictureUrl?: string },
  ) =>
    apiRequest<{ ok: boolean; profile: any }>('/api/mobile/seller/profile', {
      method: 'PATCH',
      body,
      token,
    }),
  /** Real money records: delivered order value, payouts, payout method count. */
  wallet: (token: string) =>
    apiRequest<{
      deliveredSales: number;
      inTransitSales: number;
      paidOut: number;
      pendingPayouts: number;
      payoutMethods: number;
      orderCount: number;
      payouts: Array<{
        id: string;
        amount: number;
        currency: string;
        status: string;
        method?: string;
        createdAt?: string | null;
      }>;
    }>('/api/mobile/seller/wallet', { token }),
};

/* ── Product Growth ──────────────────────────────────────────────────────── */

/**
 * The seller Growth Centre, served by `/api/seller/product-growth`.
 *
 * This is the same endpoint the website's `/dashboard/seller/product-growth`
 * calls, so a campaign started on the phone and one started on the desktop are
 * the same campaign in the same engine — not two lists that have to be kept in
 * step. Free jobs go through the Core Engine; a paid boost is a points-priced
 * request an administrator reviews, with the points held server-side.
 */
export interface GrowthProduct {
  id: string;
  name: string;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
  listingType: 'product' | 'service';
  eligible: boolean;
  reasons: string[];
  publicPath: string | null;
  suggestedCaption: string;
}

export interface GrowthDestination {
  id: string;
  label: string;
  kind: string;
  group: 'vidnov' | 'search' | 'commerce';
  configured: boolean;
  canSubmit: boolean;
  quotas: { perRun: number; perDay: number };
}

export interface GrowthSocial {
  id: string;
  label: string;
  connected: boolean;
  accountLabel: string | null;
  publishReady: boolean;
  note: string;
}

export interface GrowthCampaign {
  id: string;
  productId: string | null;
  channel: string | null;
  status: string;
  integrationStatus: string;
  attempts: number;
  lastError: { message: string; at: string | null } | null;
  updatedAt: string | null;
}

export interface GrowthBoost {
  id: string;
  productId: string | null;
  status: string;
  pointsPaid: number;
  durationDays: number | null;
  caption: string;
  rejectionReason: string | null;
  createdAt: string | null;
}

export interface GrowthCentre {
  points: { balance: number; perDay: number; minDays: number; maxDays: number };
  products: GrowthProduct[];
  destinations: GrowthDestination[];
  social: GrowthSocial[];
  campaigns: GrowthCampaign[];
  boosts: GrowthBoost[];
}

export interface GrowthFreeResult {
  productId: string;
  channel: string;
  ok: boolean;
  status?: string;
  duplicate?: boolean;
  message?: string;
}

export const growth = {
  centre: (token: string) =>
    apiRequest<GrowthCentre>('/api/seller/product-growth', { token, timeoutMs: 45_000 }),
  submitFree: (token: string, body: { productIds: string[]; channels: string[] }) =>
    apiRequest<{ ok: boolean; submitted: number; skipped: number; results: GrowthFreeResult[]; note: string }>(
      '/api/seller/product-growth',
      { method: 'POST', body: { action: 'free', ...body }, token, timeoutMs: 60_000 },
    ),
  submitPaid: (
    token: string,
    body: {
      productId: string;
      durationDays: number;
      caption?: string;
      targeting?: { age?: string; counties?: string[]; interests?: string[] };
    },
  ) =>
    apiRequest<{
      ok: boolean;
      boostId: string;
      status: string;
      costPoints: number;
      remainingPoints: number;
      days: number;
      note: string;
    }>('/api/seller/product-growth', {
      method: 'POST',
      body: { action: 'paid', ...body },
      token,
      timeoutMs: 60_000,
    }),
};

/* ── Live ────────────────────────────────────────────────────────────────── */

export type LiveSession = {
  provider?: 'livekit';
  stream?: { id: string; roomName?: string; title?: string; status?: string; sellerId?: string;
    viewerCount?: number; featuredProductId?: string | null };
  wsUrl?: string;
  token?: string;
  identity?: string;
  id?: string;
  roomName?: string;
  title?: string;
  status?: string;
  [key: string]: unknown;
};

/**
 * What `POST /api/live-session` answers with — the website's go-live response.
 * The session id is the seller's uid (one live session per seller) and is the
 * same id `/api/live-session/token` and the buyer watch screen expect.
 */
export type LiveBroadcast = {
  success?: boolean;
  liveSessionId: string;
  token: string;
  wsUrl: string;
  provider?: 'livekit';
  livekitRoomName?: string;
  newBalance?: number;
  /** True when this call rejoined a room that was already live (no charge). */
  reused?: boolean;
};

export const live = {
  /** Signed-in discovery feed — richer cards than the public strip. */
  streams: (token: string) => apiRequest<{ streams: any[] }>('/api/live', { token }),

  /**
   * Seller: start the live session and receive a PUBLISH token.
   *
   * This is the SAME endpoint the website's Go-live button calls, writing the
   * same `liveSessions` record (`status: 'live'`, `provider: 'livekit'`,
   * `livekitRoomName`) and charging the same 100 points. It used to call
   * `/api/live/create`, which wrote a different document with a different
   * status field — so the seller broadcast fine and every viewer was refused
   * with "this live session is not active". The server decides the room name
   * and the identity; the phone never does.
   */
  create: (token: string, body: { title: string }) =>
    apiRequest<LiveBroadcast>('/api/live-session', {
      method: 'POST',
      body: { title: body.title, status: 'live' },
      token,
      timeoutMs: 45_000,
    }),

  /** Stream detail + a viewer token, for a signed-in caller. */
  detail: (token: string, id: string) =>
    apiRequest<LiveSession & { token: string; wsUrl: string }>(
      `/api/live/${encodeURIComponent(id)}`,
      { token, timeoutMs: 30_000 },
    ),

  /**
   * Public subscribe-only token for one session. Works signed out — the
   * server mints an anonymous viewer identity when no bearer token is sent.
   */
  viewerToken: (sessionId: string, token?: string | null) =>
    apiRequest<{ token: string; wsUrl: string; identity?: string; room?: string }>(
      `/api/live-session/token?sessionId=${encodeURIComponent(sessionId)}`,
      { token: token ?? undefined, timeoutMs: 30_000 },
    ),

  /**
   * Host: mark the session ended. Idempotent, only the owner (or an admin)
   * may call it, and it never charges points.
   */
  end: (token: string, liveSessionId: string) =>
    apiRequest<{ success?: boolean; message?: string }>('/api/live-session', {
      method: 'PUT',
      body: { liveSessionId },
      token,
    }),

  /** Live comments, oldest first. */
  chat: (token: string, id: string) =>
    apiRequest<{ messages: Array<{ id?: string; message: string; senderName?: string; uid?: string }> }>(
      `/api/live/${encodeURIComponent(id)}/chat`,
      { token, timeoutMs: 20_000 },
    ),

  sendChat: (token: string, id: string, message: string) =>
    apiRequest<{ ok: boolean }>(`/api/live/${encodeURIComponent(id)}/chat`, {
      method: 'POST',
      body: { message },
      token,
    }),
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

/* ── Location sharing ────────────────────────────────────────────────────── */

/** One place from the seeded hierarchy — the manual-selection path. */
export interface AreaOption {
  id: string;
  name: string;
  level: 'country' | 'county' | 'city' | 'area';
  label: string;
  lat?: number;
  lng?: number;
}

export interface SavedBuyerLocation {
  lat?: number;
  lng?: number;
  areaId?: string;
  areaName?: string;
  cityName?: string;
  countyName?: string;
  label?: string;
  address?: string;
  source: 'gps' | 'manual_tree' | 'manual_label';
  updatedAt?: string;
}

export interface SellerLocationState {
  businessId: string | null;
  visible: boolean;
  kind: string;
  preciseAllowed: boolean;
  address: string;
  location: {
    lat?: number;
    lng?: number;
    areaId?: string;
    cityId?: string;
    countyId?: string;
    areaName?: string;
    cityName?: string;
    countyName?: string;
    label?: string;
    publicPrecision?: 'exact' | 'area_only';
  } | null;
  publicLocation: PublicBusinessLocation | null;
}

export interface LiveShare {
  id: string;
  chatId: string;
  ownerId: string;
  mine: boolean;
  active: boolean;
  expiresAtMs: number;
  minutesLeft: number;
  updatedAt: number;
  lat?: number;
  lng?: number;
  address?: string;
  label?: string;
}

/**
 * The area list behind manual selection. Public — it is the seed hierarchy, not
 * anybody's data — so a buyer who refuses the permission prompt still has a
 * working, first-class way to say where they are.
 */
export const locations = {
  areas: (params: { q?: string; lat?: number; lng?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (typeof params.lat === 'number') qs.set('lat', String(params.lat));
    if (typeof params.lng === 'number') qs.set('lng', String(params.lng));
    return apiRequest<{ areas: AreaOption[]; note?: string | null; point?: { formatted: string } }>(
      `/api/mobile/locations/areas?${qs.toString()}`,
      { timeoutMs: 15_000 },
    );
  },

  buyer: {
    get: (token: string) =>
      apiRequest<{
        location: SavedBuyerLocation | null;
        address: string;
        label: string;
        source: string | null;
        usable: boolean;
      }>('/api/mobile/buyer/location', { token }),
    save: (
      token: string,
      body: {
        lat?: number;
        lng?: number;
        areaId?: string;
        address?: string;
        source?: 'gps' | 'manual';
      },
    ) =>
      apiRequest<{ ok: boolean; location: SavedBuyerLocation; label: string; usable: boolean }>(
        '/api/mobile/buyer/location',
        { method: 'PUT', body, token },
      ),
    clear: (token: string) =>
      apiRequest<{ ok: boolean }>('/api/mobile/buyer/location', { method: 'DELETE', token }),
  },

  seller: {
    get: (token: string) =>
      apiRequest<SellerLocationState>('/api/mobile/seller/location', { token }),
    save: (
      token: string,
      body: {
        visible: boolean;
        lat?: number;
        lng?: number;
        areaId?: string;
        address?: string;
      },
    ) =>
      apiRequest<{
        ok: boolean;
        businessId: string;
        visible: boolean;
        location: SellerLocationState['location'];
        publicLocation: PublicBusinessLocation | null;
        preciseAllowed: boolean;
        note: string;
      }>('/api/mobile/seller/location', { method: 'PUT', body, token, timeoutMs: 30_000 }),
  },
};

/**
 * LIVE LOCATION — foreground only.
 *
 * `start` creates the server-side session (with its expiry); `update` sends a
 * new pin while the screen is open. Nothing here runs in the background: if the
 * app is closed the updates simply stop and the share expires on its own.
 */
export const liveLocation = {
  start: (
    token: string,
    body: { chatId: string; minutes: number; lat: number; lng: number; address?: string },
  ) =>
    apiRequest<{ share: LiveShare }>('/api/location/share', {
      method: 'POST',
      body,
      token,
      timeoutMs: 20_000,
    }),
  active: (token: string, chatId: string) =>
    apiRequest<{ shares: LiveShare[]; mine: LiveShare | null; active: LiveShare[] }>(
      `/api/location/share?chatId=${encodeURIComponent(chatId)}`,
      { token },
    ),
  get: (token: string, id: string) =>
    apiRequest<{ share: LiveShare }>(`/api/location/share/${encodeURIComponent(id)}`, { token }),
  update: (token: string, id: string, body: { lat: number; lng: number }) =>
    apiRequest<{ share: LiveShare }>(`/api/location/share/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body,
      token,
    }),
  stop: (token: string, id: string) =>
    apiRequest<{ ok: boolean; share: LiveShare }>(
      `/api/location/share/${encodeURIComponent(id)}`,
      { method: 'DELETE', token },
    ),
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

/* ── Admin AI Command Centre ─────────────────────────────────────────────── */

/**
 * ADMIN-ONLY. Every call below targets `/api/mobile/admin/*`, which verifies
 * the bearer token server-side with the same admin check the web console uses.
 * A `userRole` in the local profile only decides whether the entry point is
 * shown; it can never grant access to the data.
 */

/** `unknown` means the check was not performed — never render it as green. */
export type AdminCheckState = 'online' | 'degraded' | 'offline' | 'unknown';

export interface AdminCheckFigure {
  label: string;
  value: string;
}

export interface AdminCheck {
  id: 'vidnov' | 'vps' | 'pocketbase' | 'firestore' | 'ollama' | 'paperclip' | 'opencode' | 'backups';
  label: string;
  state: AdminCheckState;
  detail: string;
  checkedAt: string;
  figures?: AdminCheckFigure[];
}

export interface AdminReportSummary {
  id: string;
  title: string;
  status: string;
  model: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  preview: string;
  executed: false;
  proposedOnly: true;
}

export interface AdminReport {
  id: string;
  title: string;
  instruction: string;
  model: string;
  status: string;
  result: string;
  error: string | null;
  executed: false;
  proposedOnly: true;
  filesInspected: string[];
  filesChanged: string[];
  verification: string;
  nextStep: string | null;
  startedAt: string;
  completedAt: string | null;
  latencyMs: number | null;
  note: string;
}

export interface AdminConversation {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  model?: string | null;
  latencyMs?: number | null;
}

export interface AdminOllamaModel {
  name: string;
  sizeBytes: number | null;
  modifiedAt: string | null;
}

export interface AdminOllamaStatus {
  configured: boolean;
  state: AdminCheckState;
  reachable: boolean;
  version: string | null;
  models: AdminOllamaModel[];
  activeModel: string;
  activeModelInstalled: boolean;
  hasApiKey: boolean;
  latencyMs: number | null;
  checkedAt: string;
  lastOkAt: string | null;
  error: string | null;
}

export interface AdminPaperclipAgent {
  id: string;
  name: string;
  role: string | null;
  status: string | null;
  lastActiveAt: string | null;
}

export interface AdminPaperclipStatus {
  configured: boolean;
  state: AdminCheckState;
  reachable: boolean;
  detail: string;
  agents: AdminPaperclipAgent[];
  agentsAvailable: boolean;
  activityAvailable: boolean;
  reportsAvailable: boolean;
  pendingAvailable: boolean;
  latencyMs: number | null;
  checkedAt: string;
  error: string | null;
}

export interface AdminOverview {
  admin: { uid: string };
  generatedAt: string;
  assistant: {
    state: AdminCheckState;
    model: string | null;
    detail: string;
    lastOkAt: string | null;
  };
  checks: AdminCheck[];
  configuration: {
    ollama: { configured: boolean; model: string | null; hasApiKey: boolean };
    paperclip: { configured: boolean };
    historyStore: boolean;
  };
  approvals: { pending: number; available: boolean; error: string | null };
  reports: { items: AdminReportSummary[]; available: boolean };
}

export interface AdminProposal {
  id: string;
  kind: string;
  title: string;
  summary: string;
  action: Record<string, unknown>;
  actionDigest: string;
  requestedBy: { agentId: string; name: string; department: string; uid?: string };
  status: string;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
}

export interface AdminApprovalPolicy {
  statement: string;
  noAutonomousExecution: boolean;
  allowedWithoutApproval: string[];
  neverAutomatic: string[];
  approvalMustShow: string[];
}

/* ── Admin Operations ─────────────────────────────────────────────────────── */

/** The marketplace sections that live beside the AI Command Centre. */
export type AdminOpsSection = 'summary' | 'users' | 'sellers' | 'market' | 'finance' | 'safety' | 'growth';

export interface AdminOpsUser {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  verificationStatus: string | null;
  shopName: string | null;
  joinDate: string | null;
  profilePictureUrl: string | null;
  aiPoints: number;
}

export interface AdminOpsUserCounts {
  total: number;
  buyers: number;
  sellers: number;
  resellers: number;
  admins: number;
  suspended: number;
  pendingVerification: number;
}

export interface AdminOpsSeller extends AdminOpsUser {
  productCount: number;
  orderCount: number;
  gmv: number;
  live: boolean;
}

export interface AdminOpsProduct {
  id: string;
  name: string;
  sellerId: string;
  sellerName: string | null;
  imageUrl: string | null;
  price: number;
  stock: number;
  category: string | null;
  listingType: string;
  featured: boolean;
  unpublished: boolean;
  uploadDate: string | null;
}

export interface AdminOpsOrder {
  id: string;
  productName: string;
  totalAmount: number;
  status: string;
  orderDate: string | null;
  buyerId: string;
  buyerName: string | null;
  sellerId: string;
  sellerName: string | null;
  paymentMethod: string | null;
}

export interface AdminOpsRequest {
  id: string;
  title: string;
  category: string;
  status: string;
  customerName: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  offersCount: number;
  reports: number;
  location: string | null;
  createdAt: string | null;
}

export interface AdminOpsComplaint {
  id: string;
  targetType: string;
  targetId: string | null;
  targetName: string | null;
  reason: string | null;
  details: string | null;
  status: string;
  reporterId: string | null;
  reporterName: string | null;
  orderId: string | null;
  createdAt: string | null;
}

export interface AdminOpsPayout {
  id: string;
  sellerId: string;
  sellerName: string | null;
  amount: number;
  status: string;
  method: string | null;
  requestedAt: string | null;
}

export interface AdminOpsPayment {
  id: string;
  userId: string | null;
  userName: string | null;
  orderId: string | null;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  kind: string | null;
  createdAt: string | null;
}

export interface AdminOpsLive {
  id: string;
  title: string;
  sellerId: string;
  sellerName: string | null;
  viewerCount: number;
  startedAt: string | null;
}

export interface AdminOpsGrowthPost {
  id: string;
  productName: string;
  caption: string;
  status: string;
  sharePath: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminOpsCampaign {
  id: string;
  sellerId: string;
  sellerName: string | null;
  budget: number;
  currency: string;
  status: string;
  createdAt: string | null;
}

export interface AdminOpsOrderFigures {
  total: number;
  open: number;
  delivered: number;
  disputed: number;
  gmv: number;
  revenue7d: number;
  revenueToday: number;
}

export interface AdminOpsSummary {
  generatedAt: string;
  section: 'summary';
  available: Record<'profiles' | 'products' | 'orders' | 'complaints' | 'live' | 'payouts' | 'growth', boolean>;
  notices: string[];
  users: AdminOpsUserCounts;
  products: { total: number; reported: number; unpublished: number; featured: number };
  orders: AdminOpsOrderFigures;
  finance: { total: number; pending: number; processing: number; completed: number; failed: number; pendingTotal: number };
  safety: { total: number; open: number; investigating: number; resolved: number; dismissed: number };
  live: { active: number };
  growth: { draft: number; approved: number; rejected: number; published: number; failed: number; unknown: number };
  approvals: { pending: number; available: boolean };
}

export interface AdminOpsUsersResponse {
  generatedAt: string;
  section: 'users';
  available: boolean;
  notice: string | null;
  users: AdminOpsUser[];
  counts: AdminOpsUserCounts;
}

export interface AdminOpsSellersResponse {
  generatedAt: string;
  section: 'sellers';
  available: boolean;
  notice: string | null;
  sellers: AdminOpsSeller[];
  counts: AdminOpsUserCounts & { verified: number; pending: number; live: number };
}

export interface AdminOpsMarketResponse {
  generatedAt: string;
  section: 'market';
  available: { profiles: boolean; products: boolean; orders: boolean; requests: boolean; live: boolean; complaints: boolean };
  notices: string[];
  products: AdminOpsProduct[];
  orders: AdminOpsOrder[];
  requests: AdminOpsRequest[];
  live: AdminOpsLive[];
  counts: AdminOpsOrderFigures & {
    products: number;
    productsReported: number;
    unpublished: number;
    featured: number;
    requests: number;
    live: number;
  };
}

export interface AdminOpsFinanceResponse {
  generatedAt: string;
  section: 'finance';
  available: { profiles: boolean; orders: boolean; payouts: boolean; payments: boolean };
  notices: string[];
  orders: AdminOpsOrderFigures;
  payouts: { total: number; pending: number; processing: number; completed: number; failed: number; pendingTotal: number };
  payoutRows: AdminOpsPayout[];
  paymentRows: AdminOpsPayment[];
  currency: string;
}

export interface AdminOpsSafetyResponse {
  generatedAt: string;
  section: 'safety';
  available: boolean;
  notice: string | null;
  complaints: AdminOpsComplaint[];
  counts: { total: number; open: number; investigating: number; resolved: number; dismissed: number };
}

export interface AdminOpsGrowthResponse {
  generatedAt: string;
  section: 'growth';
  available: boolean;
  notice: string | null;
  posts: AdminOpsGrowthPost[];
  campaigns: AdminOpsCampaign[];
  counts: { draft: number; approved: number; rejected: number; published: number; failed: number; unknown: number };
  campaignCounts: Record<string, number>;
}

export const adminOps = {
  summary: (token: string) =>
    apiRequest<AdminOpsSummary>('/api/mobile/admin/operations?section=summary', { token }),
  users: (token: string) =>
    apiRequest<AdminOpsUsersResponse>('/api/mobile/admin/operations?section=users', { token }),
  sellers: (token: string) =>
    apiRequest<AdminOpsSellersResponse>('/api/mobile/admin/operations?section=sellers', { token }),
  market: (token: string) =>
    apiRequest<AdminOpsMarketResponse>('/api/mobile/admin/operations?section=market', { token }),
  finance: (token: string) =>
    apiRequest<AdminOpsFinanceResponse>('/api/mobile/admin/operations?section=finance', { token }),
  safety: (token: string) =>
    apiRequest<AdminOpsSafetyResponse>('/api/mobile/admin/operations?section=safety', { token }),
  growth: (token: string) =>
    apiRequest<AdminOpsGrowthResponse>('/api/mobile/admin/operations?section=growth', { token }),

  setUserStatus: (token: string, uid: string, status: 'active' | 'suspended') =>
    apiRequest<{ success: true; status: string }>(`/api/admin/users/${encodeURIComponent(uid)}`, {
      method: 'PUT',
      body: { status },
      token,
    }),
  setVerification: (token: string, uid: string, status: 'pending' | 'verified' | 'rejected') =>
    apiRequest<{ ok: true; uid: string; status: string }>('/api/mobile/admin/operations', {
      method: 'PATCH',
      body: { action: 'verification', uid, status },
      token,
    }),
  setProductFlags: (token: string, id: string, patch: { featured?: boolean; unpublished?: boolean }) =>
    apiRequest<{ success: true; patched: Record<string, unknown> }>(`/api/admin/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
      token,
    }),
  setOrderStatus: (token: string, id: string, status: string) =>
    apiRequest<{ success: true; message: string }>(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      body: { status },
      token,
    }),
  setComplaintStatus: (token: string, id: string, status: 'open' | 'investigating' | 'resolved' | 'dismissed') =>
    apiRequest<{ success: true; status: string }>(`/api/admin/support/complaints/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: { status },
      token,
    }),
  setPayoutStatus: (token: string, id: string, status: 'processing' | 'completed' | 'failed') =>
    apiRequest<{ ok: true; id: string; status: string }>('/api/mobile/admin/operations', {
      method: 'PATCH',
      body: { action: 'payout-status', id, status },
      token,
    }),
  decideGrowthPost: (token: string, id: string, decision: 'approve' | 'reject') =>
    apiRequest<{ post: unknown }>('/api/admin/growth-posts', {
      method: 'POST',
      body: { action: 'decide', id, decision },
      token,
    }),
};

/* ── OpenCode task centre ───────────────────────────────────────────────── */

export interface AdminOpenCodeAgent {
  name: string;
  description: string | null;
  mode: string;
  builtIn: boolean;
  model: string | null;
  temperature: number | null;
  editPermission: string | null;
  bashPermission: string | null;
}

export interface AdminOpenCodeStatus {
  configured: boolean;
  explicit: boolean;
  state: AdminCheckState;
  reachable: boolean;
  authenticated: boolean;
  version: string | null;
  latencyMs: number | null;
  checkedAt: string;
  agent: string;
  model: string | null;
  workspaceConfigured: boolean;
  hasPassword: boolean;
  agents: AdminOpenCodeAgent[];
  agentsAvailable: boolean;
  agentAvailable: boolean;
  detail: string;
  error: string | null;
}

export type AdminOpenCodeTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AdminOpenCodeTask {
  id: string;
  proposalId: string;
  sessionId: string;
  title: string;
  prompt: string;
  agent: string;
  model: string | null;
  status: AdminOpenCodeTaskStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  dispatchedAt?: string | null;
  completedAt?: string | null;
  lastError?: string | null;
  progress?: { completed: number; total: number } | null;
  changedFileCount?: number;
}

export interface AdminOpenCodeApprovedProposal {
  id: string;
  title: string;
  summary: string;
  actionDigest: string;
  approvedDigest: string | null;
  decidedAt: string | null;
  createdAt: string;
  agent: string | null;
  started: boolean;
}

export interface AdminOpenCodeTodo {
  id: string;
  content: string;
  status: string;
  priority: string;
}

export interface AdminOpenCodeTool {
  tool: string;
  status: string;
  title: string | null;
  command: string | null;
  output: string | null;
  error: string | null;
}

export interface AdminOpenCodeTest {
  command: string;
  status: string;
  output: string;
}

export interface AdminOpenCodeChangedFile {
  file: string;
  additions: number;
  deletions: number;
}

export interface AdminOpenCodeMessage {
  id: string;
  role: string;
  text: string;
  createdAt: string | null;
  error: string | null;
}

export interface AdminOpenCodeTaskDetail {
  task: AdminOpenCodeTask;
  sessionStatus: 'idle' | 'busy' | 'retry' | 'unknown';
  output: string;
  changedFiles: AdminOpenCodeChangedFile[];
  tests: AdminOpenCodeTest[];
  tools: AdminOpenCodeTool[];
  todos: AdminOpenCodeTodo[];
  messages: AdminOpenCodeMessage[];
  error: string | null;
  syncError: string | null;
}

export interface AdminOpenCodeOverview {
  checkedAt: string;
  status: AdminOpenCodeStatus;
  tasks: AdminOpenCodeTask[];
  approvedProposals: AdminOpenCodeApprovedProposal[];
}

export const adminOpenCode = {
  overview: (token: string) =>
    apiRequest<AdminOpenCodeOverview>('/api/mobile/admin/opencode', {
      token,
      timeoutMs: ADMIN_AI_TIMEOUT,
    }),
  plan: (token: string, body: { request: string; title?: string; agent?: string; model?: string }) =>
    apiRequest<{
      proposal: AdminProposal;
      plan: string;
      task: string;
      title: string;
      model: string;
      latencyMs: number;
      notice: string;
    }>('/api/mobile/admin/intelligence/plan', {
      method: 'POST',
      body,
      token,
      timeoutMs: ADMIN_AI_MODEL_TIMEOUT,
    }),
  start: (token: string, proposalId: string) =>
    apiRequest<{
      task: AdminOpenCodeTask;
      dispatched: boolean;
      error: string | null;
      notice: string;
    }>('/api/mobile/admin/opencode', {
      method: 'POST',
      body: { proposalId },
      token,
      timeoutMs: ADMIN_AI_MODEL_TIMEOUT,
    }),
  abort: (token: string, id: string) =>
    apiRequest<{ task: AdminOpenCodeTask; notice: string }>('/api/mobile/admin/opencode', {
      method: 'PATCH',
      body: { id },
      token,
    }),
  task: (token: string, id: string) =>
    apiRequest<AdminOpenCodeTaskDetail>(
      `/api/mobile/admin/opencode/task?id=${encodeURIComponent(id)}`,
      { token, timeoutMs: ADMIN_AI_TIMEOUT },
    ),
};

/** Model work can legitimately take over a minute on a 3B model. */
const ADMIN_AI_TIMEOUT = 30_000;
const ADMIN_AI_MODEL_TIMEOUT = 150_000;

export const adminAi = {
  overview: (token: string) =>
    apiRequest<AdminOverview>('/api/mobile/admin/overview', { token, timeoutMs: ADMIN_AI_TIMEOUT }),

  chat: {
    conversations: (token: string) =>
      apiRequest<{ conversations: AdminConversation[]; saved: boolean; error?: string }>(
        '/api/mobile/admin/chat',
        { token },
      ),
    history: (token: string, id: string) =>
      apiRequest<{ conversation: AdminConversation; messages: AdminMessage[]; saved: boolean }>(
        `/api/mobile/admin/chat?id=${encodeURIComponent(id)}`,
        { token },
      ),
    send: (token: string, body: { message: string; conversationId?: string; model?: string }) =>
      apiRequest<{
        conversation: AdminConversation;
        messages: AdminMessage[];
        reply: AdminMessage;
        model: string;
        latencyMs: number;
        saved: boolean;
      }>('/api/mobile/admin/chat', {
        method: 'POST',
        body,
        token,
        timeoutMs: ADMIN_AI_MODEL_TIMEOUT,
      }),
  },

  ollama: (token: string) =>
    apiRequest<AdminOllamaStatus>('/api/mobile/admin/ollama', { token, timeoutMs: ADMIN_AI_TIMEOUT }),

  paperclip: (token: string) =>
    apiRequest<AdminPaperclipStatus>('/api/mobile/admin/paperclip', {
      token,
      timeoutMs: ADMIN_AI_TIMEOUT,
    }),

  system: (token: string) =>
    apiRequest<{ checkedAt: string; signals: AdminCheck[] }>('/api/mobile/admin/system', {
      token,
      timeoutMs: ADMIN_AI_TIMEOUT,
    }),

  instructions: {
    list: (token: string) =>
      apiRequest<{ reports: AdminReportSummary[]; available: boolean; error?: string }>(
        '/api/mobile/admin/instructions',
        { token },
      ),
    send: (token: string, instruction: string) =>
      apiRequest<{ report: AdminReport; saved: boolean }>('/api/mobile/admin/instructions', {
        method: 'POST',
        body: { instruction },
        token,
        timeoutMs: ADMIN_AI_MODEL_TIMEOUT,
      }),
  },

  reports: {
    list: (token: string) =>
      apiRequest<{ reports: AdminReportSummary[]; available: boolean; error?: string }>(
        '/api/mobile/admin/reports',
        { token },
      ),
    get: (token: string, id: string) =>
      apiRequest<{ report: AdminReport; available: boolean }>(
        `/api/mobile/admin/reports?id=${encodeURIComponent(id)}`,
        { token },
      ),
  },

  approvals: {
    list: (token: string) =>
      apiRequest<{
        pending: AdminProposal[];
        policy: AdminApprovalPolicy;
        checkedAt: string;
        error?: string;
      }>('/api/mobile/admin/approvals', { token }),
    decide: (token: string, body: { id: string; decision: 'approve' | 'reject'; digest: string }) =>
      apiRequest<{ proposal: AdminProposal; executed: false; message: string }>(
        '/api/mobile/admin/approvals',
        { method: 'POST', body, token },
      ),
  },
};
