/**
 * Request Marketplace domain models (spec §24, §29, §37).
 *
 * A customer describes a NEED; businesses answer with OFFERS; the customer
 * accepts one offer which becomes an order. Request media is private and
 * only visible to the matching audience (see media authorization rules).
 */

export type RequestStatus = 'draft' | 'active' | 'closed' | 'deleted';
export type OfferStatus = 'draft' | 'submitted' | 'declined' | 'accepted' | 'withdrawn';

/** The categories a request can belong to (aligned with business verticals). */
export const REQUEST_CATEGORIES = [
  'Furniture & Decor',
  'Photography & Video',
  'Events & Catering',
  'Construction & Repair',
  'Fashion & Tailoring',
  'Beauty & Wellness',
  'Transport & Logistics',
  'Technology & Digital',
  'Education & Training',
  'Agriculture',
  'Other',
] as const;

export interface MarketplaceRequest {
  id: string;
  /** Human-facing number, e.g. REQ-1001. */
  requestNumber?: string;
  customerId: string;
  customerName?: string;
  title: string;
  description: string;
  category: string;
  quantity?: number;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency: string;
  location?: string;
  deadline?: string | null; // ISO date
  /** ISO — when the brief stops counting as open (30 days, renewable). */
  expiresAt?: string | null;
  /** How many times the customer has renewed this brief. */
  renewCount?: number;
  /** ISO — set when the nearing-expiry notice went out (notification dedupe). */
  expiryNoticeAt?: string | null;
  /** ISO — stamped when the very first offer lands (admin time-to-first-offer). */
  firstOfferAt?: string | null;
  /** Delivery / collection preference shown to sellers. */
  fulfilment?: 'delivery' | 'collection' | 'either';
  /** Media record ids attached to this request (private delivery). */
  mediaIds: string[];
  status: RequestStatus;
  offersCount: number;
  acceptedOfferId?: string | null;
  acceptedOfferSellerId?: string | null;
  /** Order created after acceptance, when the flow completes. */
  orderId?: string | null;
  /** One entry per reporter uid — feeds the admin moderation queue. */
  reports?: Array<{ by: string; reason: string; at: string }>;
  /** Sellers the fan-out already alerted (renewals only add to this). */
  matchedSellers?: string[];
  matchedAt?: unknown;
  views?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  closedAt?: unknown;
}

export interface MarketplaceOffer {
  id: string;
  requestId: string;
  sellerId: string;
  sellerName?: string;
  sellerBusinessName?: string;
  price: number;
  currency: string;
  message: string;
  deliveryDays?: number | null;
  /** Stock position: in stock / made to order / out of stock (free text, ≤80). */
  availability?: string | null;
  /** Media record ids attached to this offer (private delivery). */
  mediaIds: string[];
  status: OfferStatus;
  /** One entry per reporter uid — feeds the admin moderation queue. */
  reports?: Array<{ by: string; reason: string; at: string }>;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** Payload for creating a request (API + form share this shape). */
export interface CreateRequestInput {
  title: string;
  description: string;
  category: string;
  quantity?: number;
  budgetMin?: number | null;
  budgetMax?: number | null;
  location?: string;
  deadline?: string | null;
  currency?: string;
  fulfilment?: 'delivery' | 'collection' | 'either';
  mediaIds?: string[];
}

/** Payload for submitting an offer. */
export interface CreateOfferInput {
  requestId: string;
  price: number;
  message: string;
  deliveryDays?: number | null;
  availability?: string | null;
  currency?: string;
  mediaIds?: string[];
}
