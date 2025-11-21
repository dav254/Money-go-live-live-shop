

import type { ImagePlaceholder } from './placeholder-images';
import type { Timestamp } from 'firebase/firestore';

export type AccentColor = 'red' | 'blue' | 'purple' | 'gold' | 'pink';
export type ButtonStyle = 'rounded' | 'square' | 'soft';

export interface ThemeSettings {
  darkMode?: boolean;
  accentColor?: AccentColor;
  buttonStyle?: ButtonStyle;
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
}

export interface Order {
  id: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  productName?: string;
  productImage?: string;
  orderDate: Timestamp;
  productPrice: number;
  shippingCost: number;
  totalAmount: number;
  shippingAddress: string;
  orderStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'in-cart';
  paymentMethod: string;
  quantity: number;
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
  profitEstimate?: number;
  trendingScore?: number;
  commissionRate?: number; // Added for reseller commissions
  uploadDate?: Timestamp;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal';
  details: string; // e.g., 'Visa **** 4242' or 'user@example.com'
  isDefault?: boolean;
  providerToken?: string; // a token from Paystack/PayPal
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

    