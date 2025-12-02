
import { Timestamp } from 'firebase-admin/firestore';

// Represents the user's public profile
export interface UserProfile {
    uid: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
    userRole: 'seller' | 'buyer' | 'admin' | 'reseller';
    aiPoints: number;
    createdAt: Timestamp;
}

// Targeting options for a boost campaign
export interface TargetingOptions {
    counties: string[];
    age: string; // e.g., '18-34'
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
    description: string;
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
    inCartCount?: number;
    commissionRate?: number;
    image?: { imageUrl: string, imageHint: string };
    uploadDate: any; // Can be Timestamp or string
}

// The old AdCampaign type, kept for reference or potential future use if needed.
// We are now using BoostRequest for the new TikTok feature.
export interface AdCampaign {
  id: string;
  sellerId: string;
  productId: string;
  productName: string;
  status: 'active' | 'paused' | 'completed' | 'draft';
  budget: number;
  spend: number;
  clicks: number;
  conversions: number;
  startDate: Timestamp;
}
