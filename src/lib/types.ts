import { Timestamp } from 'firebase/firestore';

// Represents the user's public profile
export interface UserProfile {
    id: string;
    uid: string;
    email?: string;
    displayName?: string;
    fullName: string;
    username: string;
    photoURL?: string;
    profilePictureUrl?: string;
    userRole: 'seller' | 'buyer' | 'admin' | 'reseller';
    aiPoints: number;
    createdAt: Timestamp;
    joinDate: string;
    phoneNumber?: string;
    bio?: string;
    location?: string;
    status: 'active' | 'suspended';
    verificationStatus?: 'pending' | 'verified' | 'rejected';
    following?: string[];
    shopName?: string; // For sellers
    walletBalance?: number;
    wishlist?: string[]; // Array of product IDs
    referredBy?: string; // ID of the user who referred this user
    referralBonusAwarded?: boolean; // New field to track if the bonus has been given
    connections?: {
      tiktok?: {
        openId: string;
        accessToken: string;
        refreshToken: string;
        expiresAt: Date;
        scopes: string[];
        connectedAt: Date;
      }
    }
}

export interface CommissionTier {
    id: string;
    sellerId: string;
    salesTarget: number;
    commissionBoost: number;
    description: string;
    createdAt: Timestamp;
}

// Targeting options for a boost campaign
export interface TargetingOptions {
    counties: string[];
    age: string; // e.g., '18-35'
    interests: string[];
}

// Represents a single TikTok boost request
export interface BoostRequest {
    id: string;
    sellerId: string;
    productId: string;
    videoUrl: string;
    caption: string;
    durationDays: number;
    pointsPaid: number;
    target: TargetingOptions;
    status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed' | 'draft';
    createdAt: Timestamp;
    updatedAt: Timestamp;
    // Analytics data for the boost
    analytics: {
        views: number;
        likes: number;
        clicks: number;
        shares: number;
        conversions: number;
    };
    // Optional fields for when the boost is processed
    tiktokVideoId?: string; // The ID of the video on TikTok
    rejectionReason?: string; // A reason if the boost was rejected
}

// Represents a product in the store
export interface Product {
    id: string;
    sellerId: string;
    name: string;
    description?: string;
    price: number;
    imageUrl: string;
    videoUrl?: string;
    videoUrls?: string[];
    imageUrls?: string[];
    stock: number;
    category?: string;
    tags?: string;
    location?: string;
    deliveryOptions?: string;
    wasPrice?: number;
    originalPrice?: number; // Keep for compatibility with old data if needed
    likes?: number;
    viewCount?: number;
    commissionRate?: number;
    image?: { imageUrl: string, imageHint: string };
    uploadDate: any; // Can be Timestamp or string
    rating?: number;
    shippingCost?: number;
    salesCount?: number;
    coupon?: {
        code: string;
        discount: number; // Percentage or fixed amount
        type: 'percentage' | 'fixed';
    };
    hasVideo?: boolean;
    updatedAt?: any;
}

export type Seller = {
  id: string;
  sellerId: string;
  name: string;
  avatar: {
    id: string;
    imageUrl: string;
    description: string;
    imageHint: string;
  };
  banner: {
    id: string;
    imageUrl: string;
    description: string;
    imageHint: string;
  };
  bio: string;
  description: string;
  isVerified: boolean;
  rating: number;
  reviewsCount: number;
  followers: number;
  location: string;
  joinedDate: string;
  returnPolicy?: string;
  deliveryPolicy?: string;
  storeHours?: string;
  deliversFast?: boolean;
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  contactWhatsapp?: string;
  contactPhone?: string;
  contactEmail?: string;
};

export type Comment = {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userAvatar: string;
  timestamp: any;
};

export type VideoFeedItem = {
  id: string;
  video: {
    id: string;
    imageUrl: string;
    description: string;
    imageHint: string;
    mediaType: 'image' | 'video';
  };
  seller: Seller;
  product: Product;
  viewers: number;
  likes: number;
  comments: Comment[];
};

export type Category = {
    id: string;
    name: string;
    image: {
        imageUrl: string;
        imageHint: string;
    };
}

export type Review = {
    id: string;
    buyerId: string;
    author: string;
    avatar: string;
    rating: number;
    comment: string;
    date: string;
    createdAt: any;
};

export type StoryHighlight = {
  id: string;
  title: string;
  imageUrl: string;
};

export interface Order {
  id: string;
  buyerId: string;
  sellerId: string;
  items?: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    imageUrl: string;
  }[];
  subtotal?: number;
  shippingCost: number;
  totalAmount: number;
  orderDate: any; // Can be Timestamp or string
  shippingAddress: string;
  orderStatus: 'pending' | 'processing' | 'shipped' | 'delivery' | 'delivered' | 'cancelled' | 'disputed' | 'refunded';
  paymentMethod: string;
  resellerId?: string;
  platformFee?: number;
  resellerCommission?: number;
  commissionEarned?: number;
  disputeReason?: string;
  buyerConfirmed?: boolean;
  deliveredAt?: any;
  deliveryProof?: string | null;
  courierName?: string | null;
  dispatchNote?: string | null;
  // Deprecated fields, kept for backward compatibility if needed.
  productId?: string;
  productName?: string;
  productImage?: string;
  quantity?: number;
  productPrice?: number;
  commissionRate?: number;
}

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

export interface CartItem {
  id: string;
  productId: string;
  sellerId: string;
  buyerId: string;
  quantity: number;
  price: number;
  name: string;
  imageUrl: string;
  addedAt: any;
}

export interface Chat {
    id: string;
    participantIds: string[];
    lastMessage: string;
    lastMessageTimestamp: any;
    otherParticipant?: UserProfile;
    deletedFor?: string[];
}

export interface ChatMessage {
    id: string;
    senderId: string;
    messageText?: string;
    messageType: 'text' | 'image' | 'video' | 'file' | 'product';
    mediaUrl?: string;
    mediaMetadata?: {
        name: string;
        size: number;
        type: string;
    };
    productId?: string;
    timestamp: any;
}

export interface Notification {
    id: string;
    userId: string;
    type: 'order' | 'commission' | 'message' | 'announcement' | 'invoice';
    title: string;
    message: string;
    link?: string;
    status: 'read' | 'unread';
    timestamp: any;
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
    county?: string;
    subCounty?: string;
    area?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    twitterUrl?: string;
    contactWhatsapp?: string;
    contactPhone?: string;
    contactEmail?: string;
}

export interface ResellerApplication {
    id: string;
    resellerId: string;
    sellerId: string;
    status: 'pending' | 'approved' | 'rejected';
    applicationDate: any;
}


export interface LiveSession {
    id: string;
    sellerId: string;
    title: string;
    status: 'upcoming' | 'live' | 'ended';
    youtubeUrl?: string; 
    productIds?: string[];
    pinnedProductId?: string | null;
    viewerCount?: number;
    startTime: any;
    endTime?: any;
    videosdkMeetingId?: string;
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

export interface Complaint {
  id: string;
  complainantId: string;
  targetId: string;
  targetType: 'user' | 'product';
  reason: string;
  description: string;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  createdAt: any;
}

export interface PayoutMethod {
  id: string;
  type: 'paypal' | 'bank';
  details: string;
  paypalEmail?: string;
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  country?: string;
}

export interface PaymentMethod {
  id: string;
  type: string;
  details: string;
  isDefault?: boolean;
  providerToken?: string;
}

export interface Payment {
  id: string;
  orderId?: string;
  userId?: string;
  amount: number;
  paymentMethod: string;
  paymentStatus: 'completed' | 'pending' | 'failed';
  paymentDate: any;
  transactionType: 'product-purchase' | 'points-purchase';
  transactionId: string;
}

export interface ErrorLog {
  id: string;
  errorMessage: string;
  errorStack?: string | null;
  timestamp: any;
  userId?: string;
  context?: any;
  status: 'new' | 'analyzed' | 'fixed';
  aiAnalysis?: string;
  aiSuggestedFix?: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  status: 'Success' | 'Failure';
  details: string;
  ipAddress?: string;
  timestamp: any;
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


export interface ContentModerationSettings {
    isSpamActive: boolean;
    isLanguageActive: boolean;
    isPolicyViolationActive: boolean;
}

export interface ContentModerationItem {
    id: string;
    contentType: 'Product Description' | 'User Review' | 'Profile Bio';
    userId: string;
    reason: 'Potential Spam' | 'Inappropriate Language' | 'Policy Violation';
    content: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: any;
}

export interface FraudDetectionSettings {
    isEngineActive: boolean;
    sensitivity: number;
}

export interface AIFraudAlert {
    id: string;
    type: 'High-Value Order' | 'Multiple Logins' | 'New Device Payment';
    riskScore: number;
    userId: string;
    details: string;
    timestamp: any;
    status: 'open' | 'investigating' | 'resolved' | 'dismissed';
}

export interface WalletTransaction {
    id: string;
    userId: string;
    orderId: string;
    type: 'SALE_EARNING' | 'SHIPPING_FEE' | 'COMMISSION' | 'PLATFORM_FEE' | 'TAX' | 'PAYOUT_REQUEST' | 'PAYOUT_COMPLETED' | 'REFUND';
    amount: number;
    description: string;
    timestamp: any;
}

export interface Coupon {
    id: string;
    sellerId: string;
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    expires: any;
    status: 'active' | 'expired' | 'archived';
    isResellerOnly: boolean;
}

export interface ResellActivity {
    id: string;
    resellerId: string;
    productId: string;
    sellerId: string;
    sharedAt: Timestamp;
}
