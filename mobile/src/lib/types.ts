/**
 * Wire types for the shared Vidnov backend.
 *
 * Every type here is optional-heavy on purpose: the app renders documents
 * written by the website, the seller dashboard and older generations of the
 * schema. A missing field must degrade to a hidden line, never to a crash.
 */

export interface Product {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  tags?: string;
  location?: string;
  vendorLocation?: string;
  price?: number;
  localPrice?: number;
  localCurrency?: string;
  wasPrice?: number;
  stock?: number;
  availabilityState?: string;
  sellerId?: string;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  videoUrls?: string[];
  condition?: 'new' | 'used';
  listingType?: 'product' | 'service';
  priceMode?: 'quote' | 'hourly' | 'fixed';
  uploadDate?: unknown;
}

export interface Seller {
  id: string;
  fullName?: string;
  shopName?: string;
  username?: string;
  location?: string;
  profilePictureUrl?: string;
  userRole?: string;
}

export interface Profile {
  id?: string;
  uid?: string;
  userRole?: 'buyer' | 'seller' | 'reseller' | 'admin' | string;
  fullName?: string;
  email?: string;
  profilePictureUrl?: string;
  shopName?: string;
  location?: string;
}

export interface LiveRoom {
  id: string;
  sellerId: string;
  title: string;
  viewerCount: number;
  image?: string;
}

export interface ChatSummary {
  id: string;
  participantIds?: string[];
  lastMessage?: string;
  lastMessageTimestamp?: unknown;
  unreadCounts?: Record<string, number>;
  otherParticipant?: Seller;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  messageText?: string;
  text?: string;
  messageType?: string;
  mediaUrl?: string;
  timestamp?: unknown;
  isRead?: boolean;
}

export interface AppNotification {
  id: string;
  type?: string;
  title?: string;
  message?: string;
  category?: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  isRead?: boolean;
  createdAt?: string | null;
}

export interface OrderItem {
  name?: string;
  productName?: string;
  quantity?: number;
  price?: number;
  imageUrl?: string;
}

export interface Order {
  id: string;
  orderNumber?: string;
  status?: string;
  total?: number;
  totalAmount?: number;
  amount?: number;
  currency?: string;
  orderDate?: string | null;
  createdAt?: unknown;
  buyerId?: string;
  sellerId?: string;
  items?: OrderItem[];
  productName?: string;
  quantity?: number;
}

export interface Offer {
  id: string;
  requestId?: string;
  sellerId?: string;
  customerId?: string;
  amount?: number;
  price?: number;
  currency?: string;
  status?: string;
  message?: string;
  createdAt?: unknown;
  requestTitle?: string;
}

export interface Business {
  id?: string;
  name?: string;
  description?: string;
  area?: string;
  logoUrl?: string;
  category?: string;
  rating?: number;
  reviewsCount?: number;
  verified?: boolean;
}

/** The public listing projection returned by `/api/mobile/listing` and `/api/mobile/catalog`. */
export interface Listing {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  tags?: string;
  location?: string;
  vendorLocation?: string;
  price?: number;
  localPrice?: number;
  localCurrency?: string;
  wasPrice?: number;
  stock?: number;
  availabilityState?: string;
  sellerId?: string;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  videoUrls?: string[];
  condition?: 'new' | 'used';
  listingType?: 'product' | 'service';
  priceMode?: 'quote' | 'hourly' | 'fixed';
  uploadedAt?: string | null;
}

/** Four-field public seller card. */
export interface SellerCard {
  id: string;
  name?: string;
  shopName?: string;
  avatarUrl?: string;
  location?: string;
  role?: string;
  verified?: boolean;
}

/** One line on a mobile order. */
export interface MobileOrderLine {
  productId?: string;
  name: string;
  price?: number;
  quantity?: number;
  imageUrl?: string;
}

/** `/api/mobile/orders` — the buyer's own order. */
export interface MobileOrder {
  id: string;
  status: string;
  total?: number;
  currency?: string;
  placedAt: string | null;
  items: MobileOrderLine[];
  sellerId?: string;
  shippingAddress?: string;
  paymentMethod?: string;
  trackingNumber?: string;
  canReview: boolean;
}

export interface AiJob {
  id: string;
  type?: string;
  status?: 'queued' | 'processing' | 'completed' | 'failed' | string;
  progress?: number;
  prompt?: string;
  outputUrl?: string | null;
  thumbnailUrl?: string | null;
  errorMessage?: string | null;
  creditsUsed?: number;
  createdAt?: unknown;
}
