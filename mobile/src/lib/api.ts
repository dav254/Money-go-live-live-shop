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

export type DiscoverKind = 'all' | 'listings' | 'businesses';
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

export const live = {
  /** Signed-in discovery feed — richer cards than the public strip. */
  streams: (token: string) => apiRequest<{ streams: any[] }>('/api/live', { token }),

  /**
   * Seller: create the LiveStream record and receive a PUBLISH token.
   * The server decides the room name and the identity; the phone never does.
   */
  create: (
    token: string,
    body: {
      title: string;
      description?: string;
      category?: string;
      visibility?: 'PUBLIC' | 'FOLLOWERS' | 'CUSTOMERS' | 'PRIVATE';
    },
  ) => apiRequest<LiveSession>('/api/live/create', {
    method: 'POST',
    body,
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

  /** Host: mark the stream ended. Only the owner may call it. */
  end: (token: string, id: string) =>
    apiRequest<{ ok: boolean }>(`/api/live/${encodeURIComponent(id)}`, {
      method: 'DELETE',
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
