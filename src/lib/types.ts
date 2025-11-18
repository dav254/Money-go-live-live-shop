
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
  themeSettings?: ThemeSettings;
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

export interface Review {
    id: string;
    author: string;
    avatar: string;
    rating: number;
    comment: string;
    date: string;
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
  user: {
    name: string;
    avatar: ImagePlaceholder;
  };
  text: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  wasPrice?: number;
  originalPrice?: number;
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
