
import { Timestamp } from 'firebase/firestore';
import type { SocialLink } from '@/lib/social-links';

export interface UserProfile {
    id: string;
    uid: string;
    email?: string;
    displayName?: string;
    fullName: string;
    username: string;
    photoURL?: string;
    profilePictureUrl?: string;
    role: 'seller' | 'buyer' | 'admin' | 'reseller';
    aiPoints: number;
    /**
     * Referral reward balance — distinct from `aiPoints` on purpose.
     *
     * `aiPoints` is a spendable AI currency already deducted by the AI tools.
     * Referral points are a reward that can be *converted* into aiPoints, cash
     * or delivery credits. Merging them would let a referrer cash out the same
     * balance twice and would make "how many AI runs can I afford" unanswerable.
     */
    referralPoints?: number;
    /**
     * The user's public invite slug, e.g. `david-chege`. Minted once on the
     * server because a name is not unique — see `lib/referrals/ensure-code.ts`.
     * Absent until then, in which case the legacy six-character token is used.
     */
    referralSlug?: string;
    /** When documents were last submitted, for the admin queue. */
    verificationSubmittedAt?: any;
    /**
     * Single-use free-delivery credits. Kept apart from points for the same
     * reason: credits cannot be cashed out, so they cannot cannibalise the
     * reward economy.
     */
    deliveryCredits?: number;
    /** Cached count of approved referrals; denormalised for cheap rendering. */
    referralCount?: number;
    /** Cached code so the invite screen does not recompute it per render. */
    referralCode?: string;
    createdAt: Timestamp;
    joinDate: string;
    phoneNumber?: string;
    bio?: string;
    location?: string;
    status: 'active' | 'suspended';
    verificationStatus?: 'pending' | 'verified' | 'rejected';
    following?: string[];
    /** Third-party connections (e.g. TikTok) used by boosts. */
    connections?: {
      tiktok?: {
        accessToken?: string;
        openId?: string;
        displayName?: string;
        connectedAt?: unknown;
      };
    };
    shopName?: string;
    walletBalance?: number;
    wishlist?: string[];
    referredBy?: string;
    referralBonusAwarded?: boolean;
    lastSeen?: any;
    freePointsAwardedAt?: string;
    userRole?: string; // Standardizing role field name across uses
}

export interface BuyerRequest {
  id: string;
  buyerId: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  minBudget: number;
  maxBudget: number;
  currency: string;
  country: string;
  county: string;
  area: string;
  latitude?: number;
  longitude?: number;
  requestType: 'video' | 'text';
  contactMethod: string;
  deadline: string;
  imageUrls: string[];
  videoUrl: string | null;
  status: 'open' | 'selected' | 'closed';
  offersCount: number;
  selectedSellerId: string | null;
  views: number;
  createdAt: any;
  updatedAt: any;
}

export interface Offer {
  id: string;
  requestId: string;
  sellerId: string;
  sellerName?: string;
  sellerAvatar?: string;
  price: number;
  message: string;
  videoUrl?: string;
  deliveryTime: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: any;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  /**
   * The body of a text message.
   *
   * `messageText` is the key every chat surface actually writes and reads — it
   * predates `text`, which was declared here but never used by any writer.
   * Both are optional so a message written by either surface type-checks; read
   * `messageText ?? text` rather than assuming one exists.
   */
  messageText?: string;
  /** Legacy alias, kept only so older documents still type-check. */
  text?: string;
  timestamp: any;
  messageType?: 'text' | 'image' | 'video' | 'file' | 'product' | 'voice' | 'order';
  mediaUrl?: string;
  mediaMetadata?: {
      name: string;
      size: number;
      type: string;
      duration?: number;
  };
  productId?: string;
  orderId?: string;
  isRead?: boolean;
  readAt?: any;
}

export interface Product {
    id: string;
    /**
     * Reseller programme opt-in, toggled from the seller's commission table.
     */
    isResellable?: boolean;
    /**
     * Share counter shown on the reseller's share button.
     */
    clickCount?: number;
    /**
     * Stable AI image hint paired with `imageUrl` — read by the feed drawer
     * so a photo swap keeps its caption.
     */
    imageHint?: string;
    /**
     * A service is the same document as a product, not a parallel universe.
     *
     * A plumber has no stock, but a listing is still a name, a price (or a
     * quote), images, video, comments, likes and an order — so services live
     * in the same feed, shop, drawer and checkout. Absent means `product`, so
     * every listing that predates this field keeps working untouched.
     */
    listingType?: 'product' | 'service';
    /**
     * The business this listing belongs to.
     *
     * ADDITIVE, on purpose. Listings stay in `products` and keep `sellerId`;
     * nothing is re-parented under `businesses`. Moving them would break every
     * rule, query and screen for tidiness nobody outside the codebase sees.
     *
     * Absent means "not yet backfilled" and every screen falls back to
     * `sellerId`, so a listing is never invisible.
     */
    businessId?: string;
    /** Trade, when this is a service. See `lib/listings/limits.ts`. */
    serviceCategory?: string;
    /** How a service is charged: a quote, per hour, or one fixed price. */
    priceMode?: 'quote' | 'hourly' | 'fixed';
    /** Where the seller will travel, for a service. */
    serviceArea?: string;
    /** Earliest and latest days the seller is available, free text. */
    availability?: string;
    /** What is included — a service equivalent of the product description. */
    includes?: string;
    sellerId: string;
    name: string;
    brand?: string;
    description?: string;
    price: number; 
    localPrice?: number;
    localCurrency?: string;
    imageUrl: string;
    videoUrl?: string;
    videoUrls?: string[];
    imageUrls?: string[];
    /** Lightweight 400px previews (Vidnov media system) — used by feeds/cards. */
    thumbnailUrls?: string[];
    /** Per-video 400px poster frames (Vidnov media system). */
    videoThumbnailUrls?: string[];
    stock: number;
    /** Goods and services availability. Absent means available. */
    availabilityState?: 'available' | 'low_stock' | 'out_of_stock' | 'preorder' | 'on_request' | 'available_today' | 'available_tomorrow' | 'fully_booked' | 'accepting_requests';
    category?: string;
    tags?: string;
    location?: string;
    deliveryOptions?: string;
    condition?: 'new' | 'used';
    wasPrice?: number;
    originalPrice?: number;
    likes?: number;
    viewCount?: number;
    commissionRate?: number;
    uploadDate: any;
    rating?: number;
    shippingCost?: number;
    vendorLocation?: string;
    salesCount?: number;
    coupon?: {
        code: string;
        discount: number;
        type: 'percentage' | 'fixed';
    };
    hasVideo?: boolean;
    updatedAt?: any;
    /**
     * What kind of media leads this listing.
     *
     * ADDITIVE: absent means an ordinary product/photo, so every existing
     * listing is unchanged. `livingPicture` marks a still photo published with
     * OPTIONAL licensed music (Classic Studio → Living Pictures). Discovery
     * reads it to render the playback control and a distinct badge, keeping an
     * ordinary photo, a Living Picture and a video visually separate (spec B4).
     */
    mediaKind?: 'photo' | 'livingPicture';
    /**
     * The licensed music attached to a Living Picture, if any.
     *
     * OPTIONAL and snapshotted at publish: a Living Picture with NO music
     * simply omits this (music is never required). The snapshot carries the
     * licence id + licensor so the attribution travels with the document even
     * if the catalogue entry later changes. The stream URL is a same-origin
     * path the browser caches, so a re-view does not re-download the track.
     */
    musicTrack?: {
        id: string;
        title: string;
        artist: string;
        streamUrl: string;
        licenceId: string;
        licensor: string;
    };
    /**
     * Stock-keeping unit for a sized/variant product.
     *
     * Additive: a single-size listing just leaves this off and the product
     * records itself. A listing that publishes `variations` is expected to also
     * carry a SKU per published style (left optional here, the seller picks
     * the shape), so nothing older breaks.
     */
    SKU?: string;
    /**
     * Size / colour style options, when a seller has published any.
     *
     * OPTIONAL and currently write-only from Discovery's point of view: the
     * upload form does not collect variations yet, so most listings have none
     * and the details panel simply omits the block rather than rendering an
     * empty one. Adding it to the form is the missing piece — the shape is
     * declared here so that work does not have to invent a second schema.
     */
    variations?: { name: string; options: string[]; SKU?: string }[];
    /**
     * Sponsored placement.
     *
     * ADDITIVE: a listing is organic until it says otherwise, so nothing about
     * existing inventory changes. Discovery reads it as "the seller paid for
     * this slot", renders a visible Sponsored label, and never lets a paid
     * listing masquerade as an organic recommendation.
     */
    sponsored?: boolean;
    /**
     * When the paid placement lapses (ISO string or epoch ms). Absent means the
     * placement never expires — which is what keeps an old campaign from
     * running forever once the spend cap it was bought with has been retired.
     */
    promotedUntil?: any;
    /** Count of genuine customer reviews, mirrored from `reviews`. */
    reviewsCount?: number;
    /**
     * Admin "Feature Product" flag, toggled from the admin console's product
     * actions. ADDITIVE and optional: absent means not featured. Nothing about
     * organic ordering changes unless an admin sets it — see the admin
     * products list, which renders a Featured badge from this field.
     */
    featured?: boolean;
    /**
     * Admin "Unpublish" flag, toggled from the admin console's product
     * actions. ADDITIVE and optional: absent means published. Buyer-facing
     * pages (product detail, public shop) treat an unpublished listing as
     * unavailable; the seller's own inventory screens keep showing it.
     */
    unpublished?: boolean;
}

export interface SellerShop {
    id: string;
    sellerId: string;
    shopName: string;
    description: string;
    logoUrl?: string;
    bannerUrl?: string;
    followers: number;
    reviewsCount: number;
    location: string;
    isVerified: boolean;
    rating: number;
    /** Primary business category — used by the request matching engine. */
    category?: string;
    county?: string;
    subCounty?: string;
    area?: string;
    country?: string;
    stateProvince?: string;
    cityTown?: string;
    /**
     * Free-form social links. The three fields below are the original,
     * platform-limited design and are still read as a fallback — see
     * `mergeSocialLinks` in `src/lib/social-links.ts`. New links go here.
     */
    socialLinks?: SocialLink[];
    facebookUrl?: string;
    instagramUrl?: string;
    twitterUrl?: string;
    contactWhatsapp?: string;
    contactPhone?: string;
    contactEmail?: string;
    returnPolicy?: string;
    deliveryPolicy?: string;
    storeHours?: string;
    targetLocations?: string[];
}

export type Seller = {
  id: string;
  sellerId: string;
  name: string;
  avatar: { id?: string; imageUrl: string; description?: string; imageHint: string };
  banner: { id?: string; imageUrl: string; description?: string; imageHint: string };
  bio: string;
  description: string;
  isVerified: boolean;
  isLive?: boolean;
  rating: number;
  reviewsCount: number;
  followers: number;
  location: string;
  joinedDate: string;
  returnPolicy?: string;
  deliveryPolicy?: string;
  storeHours?: string;
  contactWhatsapp?: string;
  contactPhone?: string;contactEmail?: string;
    socialLinks?: SocialLink[];
    facebookUrl?: string;
    instagramUrl?: string;
    twitterUrl?: string;
    targetLocations?: string[];
    /**
     * Drives the "Fast Delivery" badge. Declared optional because the shop page
   * sets it from shop data that predates the flag — an absent value means the
   * badge simply does not render, which is the safe reading of unknown.
   */
  deliversFast?: boolean;
};

/**
 * One highlight tile in a shop's story row.
 *
 * Imported by `shop-story-highlights` but never declared, so the component could
 * not compile. The shape matches the `defaultHighlights` it constructs.
 */
export interface StoryHighlight {
  id: string;
  title: string;
  imageUrl: string;
  link?: string;
}

export type Comment = {
  id: string;
  text: string;
  userId: string;
  userName: string;
  /**
   * Written alongside `userName` so a commenter whose Firebase account has no
   * `displayName` still resolves to something human — see `lib/comments.ts`.
   * Absent on comments written before it existed.
   */
  userEmail?: string;
  userAvatar: string;
  timestamp: any;
};

export type VideoFeedItem = {
  id: string;
  video: {
    id?: string;
    imageUrl: string;
    description?: string;
    imageHint?: string;
    /** The discriminator the feed cards were typed against. */
    type?: 'image' | 'video';
    /** What the producing page set from the product's video URL. */
    mediaType?: 'image' | 'video';
  };
  seller: Seller;
  product: Product;
  viewers: number;
  likes: number;
  comments: Comment[];
};

export interface Payout {
  id: string;
  sellerId: string;
  amount: number;
  payoutMethodId: string;
  payoutMethodInfo: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: any;
  processedAt?: any;
  transactionId?: string;
}

/**
 * A destination the platform can pay a seller into.
 *
 * Stored as a document under `userProfiles/{uid}/payoutMethods`, so it is
 * always scoped to the seller who owns it — the admin finance console reads
 * them through the seller id rather than listing the collection.
 */
export interface PayoutMethod {
  id: string;
  type: 'paypal' | 'bank' | 'phone';
  /** Human summary shown in the withdrawal picker, e.g. "KCB Bank - *...6789". */
  details: string;
  paypalEmail?: string;
  /** Phone number (M-PESA) the payout is sent to, in international form. */
  phoneNumber?: string;
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  /** Bank code used by the payout provider (e.g. "001" for KCB). */
  bankCode?: string;
  country?: string;
}

/** Status of a withdrawal request, as shown to the seller. */
export const PAYOUT_STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting review',
  processing: 'Processing',
  completed: 'Paid',
  failed: 'Failed',
};

export interface WalletTransaction {
    id: string;
    userId: string;
    orderId: string;
    type: 'SALE_EARNING' | 'SHIPPING_FEE' | 'COMMISSION' | 'PLATFORM_FEE' | 'TAX' | 'PAYOUT_REQUEST' | 'PAYOUT_COMPLETED' | 'REFUND';
    amount: number;
    description: string;
    timestamp: any;
}

export interface Notification {
    id: string;
    userId: string;
    type: 'order' | 'commission' | 'message' | 'announcement' | 'invoice' | 'payout';
    title: string;
    message: string;
    link?: string;
    status: 'read' | 'unread';
    timestamp: any;
}

export interface SupportTicket {
    id: string;
    userId: string;
    issueType: string;
    description: string;
    status: 'pending' | 'open' | 'closed';
    createdAt: any;
    contactNumber?: string;
}

export interface ResellActivity {
    id: string;
    resellerId: string;
    productId: string;
    sellerId: string;
    sharedAt: Timestamp;
}

export interface HomepageSlide {
    id: string;
    title: string;
    description?: string;
    imageUrl: string;
    imageHint?: string;
    href: string;
    order: number;
}

export interface LiveSession {
    id: string;
    sellerId: string;
    title: string;
    status: 'upcoming' | 'live' | 'paused' | 'ended';
    /**
     * Video transport backing this session. LiveKit is the only transport
     * (VideoSDK was removed); sessions without `provider` predate the
     * migration and have no watchable transport anymore.
     */
    provider?: 'livekit';
    /** LiveKit room — minted server-side only. */
    livekitRoomName?: string | null;
    /**
     * Legacy VideoSDK meeting id. No longer read or written by any code
     * path — kept only so old session documents still satisfy this type.
     */
    videosdkMeetingId?: string | null;
    viewerCount: number;
    startTime: any;
    endTime?: any;
    lastStartedAt?: any;
    timeRemainingMs: number;
    initialStartTime: any;
    pinnedProductId?: string | null;
    activeOffer?: {
        type: 'flash' | 'limited' | 'countdown';
        title: string;
        code: string;
        discountValue: string;
        expiresAt: any;
    } | null;
    sales?: number;
}

export interface Chat {
    id: string;
    participantIds: string[];
    lastMessage?: string;
    lastMessageTimestamp?: any;
    deletedFor?: string[];
    otherParticipant?: UserProfile;
    unreadCounts?: { [userId: string]: number };
}

/** One invited signup. Created once by the invitee, adjudicated by an admin. */
export interface Referral {
    id: string;
    /** The uid of the person who shared the code. */
    referrerId: string;
    /** The uid of the person who signed up. Never equal to `referrerId`. */
    refereeId: string;
    /** The code as typed, kept for audit even if the referrer's code changes. */
    code: string;
    status: 'pending' | 'approved' | 'flagged' | 'rejected';
    /** Points credited at approval time; 0 while pending. */
    pointsAwarded?: number;
    /** The band the signup landed in, for explaining the amount. */
    tierName?: string;
    createdAt?: unknown;
    reviewedAt?: unknown;
    reviewedBy?: string;
    /** Admin note — why something was flagged or rejected. */
    note?: string;
    /** Snapshot of the invitee for the admin table, so it renders without a join. */
    refereeName?: string;
    refereeEmail?: string;
}

/**
 * A row in the admin leaderboard: one referrer and their totals.
 *
 * Built by aggregating `referrals` client-side rather than stored, so it can
 * never disagree with the underlying documents.
 */
export interface ReferralLeaderboardRow {
    referrerId: string;
    referrerName: string;
    referrerEmail?: string;
    role: string;
    /** Approved signups — the only ones that earned points. */
    approved: number;
    pending: number;
    flagged: number;
    rejected: number;
    totalPoints: number;
    deliveryCredits: number;
    /** Most recent signup, epoch ms. */
    lastSignupAt: number;
}

/** A user's own reward-grant history, shown on their rewards screen. */
export interface ReferralGrant {
    id: string;
    userId: string;
    points: number;
    deliveryCredits: number;
    /** Why the admin gave it — "Top recruiter, March", not a blank field. */
    reason: string;
    grantedBy?: string;
    grantedAt?: unknown;
}

/** A complaint/report filed against a product or user (admin moderation). */
export interface Complaint {
  id?: string;
  complainantId?: string;
  targetType: 'product' | 'user' | 'order' | 'other';
  targetId?: string;
  reason?: string;
  description?: string;
  details?: string;
  /** The order a report is about, when the reporter filed it against one. */
  orderId?: string;
  /** `investigating` is a real state — the violations console filters on it. */
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  createdAt?: unknown;
  resolvedAt?: unknown;
}

/** A saved buyer payment method (`userProfiles/{uid}/paymentMethods`). */
export interface PaymentMethod {
  type: 'card' | 'paypal';
  /** Human-readable summary, e.g. `Visa **** 1234` or the PayPal email. */
  details: string;
  providerToken?: string;
}

/** A knowledge-base article shown in the role help centres (`helpArticles`). */
export interface HelpArticle {
  /** Present on every document read from Firestore (`WithId` adds it too). */
  id: string;
  question: string;
  answer: string;
  category?: string;
  /** Which sections the article is served to, e.g. `['buyer', 'seller']`. */
  audience?: string[];
}

/** A captured payment/transaction record surfaced in admin finance. */
export interface Payment {
  id?: string;
  orderId?: string;
  userId?: string;
  sellerId?: string;
  amount: number;
  currency?: string;
  method?: string;
  status?: 'pending' | 'completed' | 'failed' | 'refunded';
  /** 'order' | 'points-purchase' | … — used by the finance table. */
  transactionType?: string;
  /** Legacy aliases used by the payments table. */
  paymentMethod?: string;
  paymentStatus?: string;
  paymentDate?: unknown;
  createdAt?: unknown;
}

/** Admin audit-trail entry (written by client code or Cloud Functions). */
export interface ActivityLog {
  id?: string;
  userId?: string;
  userName?: string;
  action: string;
  details?: string;
  timestamp?: unknown;
}

/** Frontend error captured by the error boundary / error logging service. */
export interface ErrorLog {
  id?: string;
  message: string;
  /** Some writers use errorMessage instead of message. */
  errorMessage?: string;
  stack?: string;
  status?: 'new' | 'resolved' | 'ignored';
  userId?: string;
  context?: unknown;
  timestamp?: unknown;
}

/** Message in the admin AI chat console (adminChat/{chatId}/messages). */
export interface AdminChatMessage {
  id?: string;
  text: string;
  sender: 'user' | 'ai';
  createdAt?: unknown;
}

/** A flagged content item awaiting admin moderation. */
export interface ContentModerationItem {
  id?: string;
  targetType: 'post' | 'product' | 'comment' | 'message' | 'profile';
  /** Legacy alias used by the moderation queue table. */
  contentType?: string;
  targetId?: string;
  userId?: string;
  reason?: string;
  flaggedBy?: string;
  confidence?: number;
  status: 'pending' | 'approved' | 'removed';
  content?: string;
  createdAt?: unknown;
}

/** Toggleable auto-moderation settings (single settings doc). */
export interface ContentModerationSettings {
  autoFlagProfanity: boolean;
  autoFlagNudity: boolean;
  autoFlagSpam: boolean;
  requireManualReview: boolean;
  /** Toggle keys used by the admin settings UI. */
  isSpamActive?: boolean;
  isLanguageActive?: boolean;
  isPolicyViolationActive?: boolean;
}

/** A fraud alert raised by the detection heuristics. */
export interface AIFraudAlert {
  id?: string;
  userId?: string;
  orderId?: string;
  type?: string;
  /** 0–100 risk score used by the alerts table. */
  riskScore?: number;
  severity?: 'low' | 'medium' | 'high';
  reason?: string;
  details?: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  createdAt?: unknown;
}

/** Fraud detection settings (single settings doc). */
export interface FraudDetectionSettings {
  enabled: boolean;
  blockOnHighSeverity: boolean;
  maxOrdersPerHour: number;
  maxFailedPaymentsPerDay: number;
  /** UI keys used by the admin fraud page. */
  isEngineActive?: boolean;
  sensitivity?: number;
}

/** A TikTok/ads boost request awaiting admin approval. */
export interface BoostRequest {
  id?: string;
  sellerId: string;
  productId?: string;
  postUrl?: string;
  budget?: number;
  currency?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'completed' | 'active';
  connections?: number;
  createdAt?: unknown;
  reviewedAt?: unknown;
  note?: string;
  rejectionReason?: string;
  /** Audience targeting captured on the request form. */
  targeting?: {
    age?: string;
    counties?: string[];
    interests?: string[];
  };
  /** Boosted TikTok content + paid plan details. */
  videoUrl?: string;
  tiktokVideoId?: string;
  caption?: string;
  pointsPaid?: number;
  durationDays?: number;
  /**
   * The audience the boost targets — written as an object by the ads form
   * (`{ age, counties, interests }`) and read as one by both admin consoles.
   * It was declared `string` here, which made every one of those reads a type
   * error.
   */
  target?: {
    age?: string;
    counties?: string[];
    interests?: string[];
  };
  updatedAt?: unknown;
  analytics?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    clicks?: number;
    conversions?: number;
    updatedAt?: unknown;
  };
}

/** A cart line. Documents live in `userProfiles/{uid}/cart/{productId}`. */
export interface CartItem {
    id: string;
    productId: string;
    sellerId: string;
    name: string;
    price: number;
    quantity: number;
    imageUrl?: string;
    addedAt?: any;
}

/** One line of an order, snapshotted at checkout. */
export interface OrderItem {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    imageUrl?: string;
}

export interface Order {
    id: string;
    buyerId: string;
    sellerId: string;
    resellerId?: string;
    /**
     * Share attribution (Growth Engine Phase 1): the normalised `?ref=` code
     * the buyer arrived with, captured client-side at order creation for
     * measurement. Optional, never used for pricing, rewards or authorization —
     * those continue to flow through the server-validated referral claim.
     */
    shareRef?: string;
    /**
     * The business the order was placed with. Additive; falls back to
     * `sellerId` when absent so nothing about an existing order changes.
     */
    businessId?: string;
    /**
     * 1 when a referral free-delivery credit paid for the shipping on this
     * order. Recorded rather than inferred from a zero shippingCost, so support
     * can tell "delivery was free because of a credit" apart from "shipping was
     * genuinely zero" without joining the profile.
     */
    deliveryCreditApplied?: number;
    productId?: string;
    productName?: string;
    productImage?: string;
    productPrice?: number;
    shippingCost?: number;
    totalAmount: number;
    subtotal?: number;
    quantity?: number;
    /** Line items. Written by the cart checkout; absent on older orders. */
    items?: OrderItem[];
    orderDate: any;
    shippingAddress: string;
    // `paid` and `packed` are written by the checkout/seller status flows but
    // were missing from the union, so those paths failed to typecheck.
    orderStatus: 'pending' | 'paid' | 'processing' | 'packed' | 'shipped' | 'delivery' | 'delivered' | 'cancelled' | 'disputed' | 'refunded';
    disputeReason?: string;
    paymentMethod?: string;
    trackingNumber?: string;
    shippingProvider?: string;
    courierName?: string;
    dispatchNote?: string;
    buyerConfirmed?: boolean;
    /**
     * Set once the delivery points have been paid (seller + buyer, see
     * `lib/points/delivery.ts`). Guards every writer against paying the same
     * order twice when `delivered` is re-set.
     */
    deliveryPointsAwarded?: boolean;
    deliveredAt?: any;
    deliveryProof?: string;
    timeline?: { status: string; date: any; updatedBy?: string }[];
    platformFee?: number;
    resellerCommission?: number;
}

export interface ProductUploadFormProps {
  productToEdit?: Product;
  onFormSubmit?: () => void;
}

// NOTE: the admin finance view on the incoming branch declared a second, 
// stricter `Payment` interface here. It clashed with the canonical one above
// (TS2687/TS2717) and its `source` discriminator is referenced nowhere, so
// the canonical all-optional shape is the only declaration.
export interface Report {
    id: string;
    reportType: 'video' | 'user';
    reportedId: string;
    reporterId: string;
    reason: string;
    createdAt: Timestamp;
}

export interface Video {
    id: string;
    createdAt: Timestamp;
    isFlagged: boolean;
}

export interface Activity {
    id: string;
    timestamp: Timestamp;
    type: 'new_seller' | 'order_completed' | 'video_flagged' | 'withdrawal_requested' | 'new_buyer';
    description: string;
    details: string;
    icon: string;
    color: string;
}
