
import type { ImagePlaceholder } from './placeholder-images';

export interface Seller {
  id: string;
  name: string;
  avatar: ImagePlaceholder;
  isVerified: boolean;
  rating: number;
  reviewsCount: number;
  followers: number;
  location: string;
  joinedDate: string;
  bio: string;
  banner: ImagePlaceholder;
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
  imageUrl: string;
  stock: number;
  sellerId: string;
  description: string;
  category: string;
  tags?: string;
  location: string;
  deliveryOptions: string;
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
