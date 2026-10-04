'use client';

import { useMemoFirebase, useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Product, Seller, SellerShop, UserProfile, VideoFeedItem, LiveSession } from '@/lib/types';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { VideoCard } from '@/components/feed/video-card';
import { Badge } from '@/components/ui/badge';

/**
 * REALTIME VIDEO CARD — one product, wired to its seller and live session.
 *
 * It lives here rather than inside either feed page because both the website
 * Discovery Feed and the app's seller feed render the same card: the card owns
 * the three reads (seller shop, seller profile, live session) and the
 * translation from a `Product` into the `VideoFeedItem` the player expects, so
 * duplicating it would mean duplicating that wiring too.
 *
 * The card fills its parent, which is what lets the feed use scroll snapping —
 * every card is one viewport tall.
 */
export function RealtimeVideoCard({
  product,
  isIntersecting,
  productHref,
  shopLinkLabel,
  checkoutHrefFor,
  messageHref,
}: {
  product: Product;
  isIntersecting: boolean;
  /** Where the card's SHOP button goes — resolved by the feed, not by the card. */
  productHref: string;
  /** Label for the drawer's seller link, so the wording matches the destination. */
  shopLinkLabel: string;
  /** Where the drawer's "Buy now" goes once the order exists. */
  checkoutHrefFor: (orderId: string) => string;
  /** Where the rail's CHAT button goes — the conversation with this seller. */
  messageHref: string;
}) {
  const firestore = useFirestore();

  const sellerShopRef = useMemoFirebase(() => {
    if (!firestore || !product.sellerId) return null;
    return doc(firestore, 'sellerShops', product.sellerId);
  }, [firestore, product.sellerId]);

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !product.sellerId) return null;
    return doc(firestore, 'userProfiles', product.sellerId);
  }, [firestore, product.sellerId]);

  const liveSessionRef = useMemoFirebase(() => {
    if (!firestore || !product.sellerId) return null;
    return doc(firestore, 'liveSessions', product.sellerId);
  }, [firestore, product.sellerId]);

  const { data: sellerData } = useDoc<SellerShop>(sellerShopRef);
  const { data: userProfileData } = useDoc<UserProfile>(userProfileRef);
  const { data: liveSession } = useDoc<LiveSession>(liveSessionRef);

  const isLive = liveSession?.status === 'live';
  const sellerName = sellerData?.shopName || userProfileData?.fullName || 'Seller Store';
  const sellerFollowers = sellerData?.followers || 0;
  const sellerReviews = sellerData?.reviewsCount || 0;

  const seller: Seller = {
    id: product.sellerId,
    sellerId: product.sellerId,
    name: sellerName,
    avatar: {
      imageUrl: sellerData?.logoUrl || userProfileData?.profilePictureUrl || getPlaceholderImage(),
      imageHint: 'seller avatar',
    },
    banner: {
      imageUrl: sellerData?.bannerUrl || getPlaceholderImage(),
      imageHint: 'store banner',
    },
    bio: sellerData?.description || userProfileData?.bio || 'Welcome!',
    rating: 0,
    followers: sellerFollowers,
    reviewsCount: sellerReviews,
    isVerified: userProfileData?.verificationStatus === 'verified',
    isLive: isLive,
    joinedDate: userProfileData?.joinDate || new Date().toISOString(),
    location: sellerData?.location || userProfileData?.location || 'Unknown',
    description: sellerData?.description || userProfileData?.bio || 'Welcome!',
  };

  const feedItem: VideoFeedItem = {
    id: product.id,
    product: product,
    seller: seller,
    video: {
      imageUrl: product.imageUrl || getPlaceholderImage(),
      type: product.videoUrl && product.videoUrl.trim() !== '' ? 'video' : 'image',
    },
    likes: product.likes || 0,
    viewers: isLive ? liveSession?.viewerCount || 0 : 0,
    comments: [],
  };

  return (
    <div className="relative h-full w-full flex-shrink-0 snap-start">
      <VideoCard
        item={feedItem}
        isIntersecting={isIntersecting}
        productHref={productHref}
        shopLinkLabel={shopLinkLabel}
        checkoutHrefFor={checkoutHrefFor}
        messageHref={messageHref}
      />
      <div className="absolute bottom-24 right-4 z-20">
        <Badge
          variant={product.condition === 'new' ? 'default' : 'secondary'}
          className="capitalize text-sm py-1 px-3 shadow-lg"
        >
          {product.condition}
        </Badge>
      </div>
    </div>
  );
}

export default RealtimeVideoCard;