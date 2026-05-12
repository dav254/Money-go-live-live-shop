
import { Timestamp } from 'firebase/firestore';

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
    createdAt: Timestamp;
    joinDate: string;
    phoneNumber?: string;
    bio?: string;
    location?: string;
    status: 'active' | 'suspended';
    verificationStatus?: 'pending' | 'verified' | 'rejected';
    following?: string[];
    shopName?: string;
    walletBalance?: number;
    wishlist?: string[];
    referredBy?: string;
    referralBonusAwarded?: boolean;
    lastSeen?: any;
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
  deliveryTime: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: any;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: any;
}

export interface Product {
    id: string;
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
    stock: number;
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
    salesCount?: number;
    coupon?: {
        code: string;
        discount: number;
        type: 'percentage' | 'fixed';
    };
    hasVideo?: boolean;
    updatedAt?: any;
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
    country?: string;
    stateProvince?: string;
    cityTown?: string;
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
  avatar: { imageUrl: string; imageHint: string };
  banner: { imageUrl: string; imageHint: string };
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
  contactPhone?: string;
  contactEmail?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  targetLocations?: string[];
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
  video: { imageUrl: string; type: 'image' | 'video' };
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
    type: 'order' | 'commission' | 'message' | 'announcement' | 'invoice';
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
    videosdkMeetingId?: string | null;
    viewerCount: number;
    startTime: any;
    endTime?: any;
    lastStartedAt?: any;
    timeRemainingMs: number;
    initialStartTime: any;
    pinnedProductId?: string | null;
    activeOffer?: {
        title: string;
        code: string;
        publishedAt: any;
    } | null;
    sales?: number;
}
