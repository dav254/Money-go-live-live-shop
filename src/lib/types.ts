
import type { ImagePlaceholder } from './placeholder-images';

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
  video: ImagePlaceholder;
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
