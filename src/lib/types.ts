

import type { ImagePlaceholder } from './placeholder-images';
import type { Timestamp } from 'firebase/firestore';

export type AccentColor = 'red' | 'blue' | 'purple' | 'gold' | 'pink';
export type ButtonStyle = 'rounded' | 'square' | 'soft';

export interface ThemeSettings {
  darkMode?: boolean;
  accentColor?: AccentColor;
  buttonStyle?: ButtonStyle;
}

export interface HelpArticle {
  id: string;
  category: string;
  audience: ('buyer' | 'seller' | 'reseller')[];
  question: string;
  answer: string;
  createdAt: Timestamp;
}

export interface SellerShop {
  id: string;
  sellerId: string;
  shopName: string;
  description: string;
  logoUrl?: string;
  bannerUrl?: string;
  location?: string;
  contactEmail?: string;
  contactWhatsapp?: string;
  followers?: number;
  reviewsCount?: number;
}

export interface Seller {
  id: string;
  sellerId: string;
  name: string;
  description: string;
  avatar: ImagePlaceholder;
  banner: ImagePlaceholder;
  location: string;
  contactEmail?: string;
  contactWhatsapp?: string;
  isVerified: boolean;
  rating: number;
  reviewsCount: number;
  followers: number;
  joinedDate: string | Date;
  bio: string;
  returnPolicy?: string;
  deliveryPolicy?: string;
  storeHours?: string;
  deliversFast?: boolean;
  shopName?: string;
  logoUrl?: string;
  bannerUrl?: string;
  themeSettings?: ThemeSettings;
}

export interface StoryHighlight {
    id: string;
    title: string;
    imageUrl: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  username: string;
  email: string;
  joinDate: string;
  userRole: 'buyer' | 'seller' | 'reseller' | 'admin';
  profilePictureUrl?: string;
  following?: string[];
  bio?: string;
  location?: string;
  shopName?: string; // Added to potentially hold shop name
  phoneNumber?: string; // Added for seller info
  status?: 'active' | 'suspended';
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  aiPoints?: number;
  referredBy?: string; // ID of the reseller who referred this user
}

export interface Order {
  id: string;
  buyerId: string;
  sellerId: string;
  resellerId?: string;
  productId: string;
  productName?: string;
  productImage?: string;
  orderDate: Timestamp;
  productPrice: number;
  shippingCost: number;
  totalAmount: number;
  shippingAddress: string;
  orderStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'disputed' | 'in-cart';
  disputeReason?: string;
  paymentMethod: string;
  quantity: number;
  platformFee?: number;
  resellerCommission?: number;
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
  addedAt: Timestamp;
}

export interface Chat {
  id: string;
  participantIds: string[];
  lastMessage?: string;
  lastMessageTimestamp?: Timestamp;
  deletedFor?: string[]; // Array of user IDs who have "deleted" the chat
  // This will be populated client-side
  otherParticipant?: UserProfile;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  messageText: string;
  timestamp: Timestamp;
  messageType?: 'text' | 'product' | 'image' | 'video' | 'file';
  productId?: string;
  mediaUrl?: string;
  mediaMetadata?: {
    name: string;
    size: number;
    type: string;
  };
}


export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: Timestamp;
}

export interface Review {
  id: string;
  productId: string;
  buyerId: string;
  sellerId: string;
  rating: number;
  comment: string;
  createdAt: Timestamp;
}


export interface Product {
  id: string;
  name: string;
  price: number;
  wasPrice?: number;
  originalPrice?: number;
  shippingCost?: number;
  image?: ImagePlaceholder;
  imageUrl?: string; // Optional for cases where it's not a placeholder object
  imageUrls?: string[];
  videoUrl?: string;
  videoUrls?: string[];
  stock: number;
  sellerId: string;
  description?: string;
  category?: string;
  tags?: string;
  location?: string;
  deliveryOptions?: string;
  rating?: number; // Added for product-level rating
  likes?: number; // Added for product likes
  inCartCount?: number;
  viewCount?: number; // Added to track product views
  profitEstimate?: number;
  trendingScore?: number;
  commissionRate?: number; // Added for reseller commissions
  uploadDate?: Timestamp;
}

export interface Payment {
  id: string;
  orderId?: string; // Optional because points purchases don't have one
  userId?: string; // Optional for user-specific payments like buying points
  amount: number;
  paymentMethod: string;
  paymentStatus: 'completed' | 'pending' | 'failed';
  paymentDate: Timestamp;
  transactionType?: 'product-purchase' | 'points-purchase';
  transactionId?: string; // The ID from the payment gateway
}


export interface PayoutMethod {
  id: string;
  type: 'paypal' | 'bank';
  details: string; // e.g. user@example.com or Equity Bank - ...1234
  // PayPal specific
  paypalEmail?: string;
  // Bank specific
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  country?: string;
}

export interface Payout {
    id: string;
    sellerId: string;
    amount: number;
    payoutMethodId: string;
    payoutMethodInfo: string; // e.g., "PayPal: seller@example.com"
    status: 'pending' | 'processing' | 'completed' | 'failed';
    requestedAt: Timestamp;
    processedAt?: Timestamp;
    transactionId?: string; // ID from payment gateway
    adminNotes?: string;
}


export interface VideoFeedItem {
  id: string;
  video: ImagePlaceholder & { mediaType?: 'image' | 'video' };
  seller: Seller;
  viewers: number;
  likes: number;
  product: Product;
  comments: Comment[];
}

export interface Category {
  id: string;
  name: string;
  image: ImagePlaceholder;
}

export interface ResellerApplication {
  id: string;
  resellerId: string;
  sellerId: string;
  status: 'pending' | 'approved' | 'rejected';
  applicationDate: Timestamp;
}

export interface SupportTicket {
    id: string;
    userId: string;
    issueType: string;
    description: string;
    contactNumber?: string;
    status: 'pending' | 'open' | 'closed';
    createdAt: Timestamp;
}

export interface AIFraudAlert {
    id: string;
    type: 'High-Value Order' | 'Multiple Logins' | 'New Device Payment';
    riskScore: number;
    userId: string;
    details: string;
    timestamp: Timestamp;
    status: 'open' | 'investigating' | 'resolved' | 'dismissed';
}

export interface FraudDetectionSettings {
    isEngineActive: boolean;
    sensitivity: number;
}

export interface ContentModerationItem {
  id: string;
  contentType: 'Product Description' | 'User Review' | 'Profile Bio';
  userId: string;
  reason: 'Potential Spam' | 'Inappropriate Language' | 'Policy Violation';
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
}

export interface ContentModerationSettings {
  isSpamActive: boolean;
  isLanguageActive: boolean;
  isPolicyViolationActive: boolean;
}

    