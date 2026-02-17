
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
    referralBonusAwarded?: boolean;
    lastSeen?: any; // Timestamp
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

export interface Product {
    id: string;
    sellerId: string;
    name: string;
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

export interface Chat {
    id: string;
    participantIds: string[];
    lastMessage: string;
    lastMessageTimestamp: any;
    otherParticipant?: UserProfile;
    deletedFor?: string[];
    unreadCount?: Record<string, number>;
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
    isRead?: boolean;
    readAt?: any;
}

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
  orderDate: any;
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
  productName?: string;
  productImage?: string;
  productPrice?: number;
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
    facebookUrl?: string;
    instagramUrl?: string;
    twitterUrl?: string;
    contactWhatsapp?: string;
    contactPhone?: string;
    contactEmail?: string;
    returnPolicy?: string;
    deliveryPolicy?: string;
    storeHours?: string;
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
