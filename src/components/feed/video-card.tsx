'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { VideoFeedItem } from '@/lib/types';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { VideoInfo } from '@/components/feed/video-info';
import { VideoActions } from '@/components/feed/video-actions';
import { ProductDrawer } from '@/components/feed/product-drawer';
import { Button } from '@/components/ui/button';

interface VideoCardProps {
  item: VideoFeedItem;
  isIntersecting?: boolean;
  onScroll?: (direction: 'up' | 'down') => void;
  productHref?: string;
  shopLinkLabel?: string;
  checkoutHrefFor?: (orderId: string) => string;
  messageHref?: string;
}

/**
 * A full-screen feed card for the buyer live stream. Renders the product media
 * (image or video), the seller overlay, the action rail, and the product drawer.
 */
export function VideoCard({
  item,
  isIntersecting = false,
  onScroll,
  productHref,
  shopLinkLabel = 'Visit Shop',
  checkoutHrefFor,
  messageHref,
}: VideoCardProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const product = item.product;
  const isVideo = item.video.mediaType === 'video' || item.video.type === 'video';
  const mediaUrl = item.video.imageUrl && item.video.imageUrl !== '' ? item.video.imageUrl : getPlaceholderImage();
  const posterUrl = product.imageUrl && product.imageUrl !== '' ? product.imageUrl : getPlaceholderImage();

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      {/* Media layer */}
      {isVideo ? (
        <video
          src={mediaUrl}
          poster={posterUrl}
          className="h-full w-full object-cover"
          autoPlay={isIntersecting}
          loop
          muted
          playsInline
        />
      ) : (
        <Image
          src={mediaUrl}
          alt={product.name || 'Product'}
          fill
          priority={isIntersecting}
          className="object-cover"
          data-ai-hint={item.video.imageHint || 'product'}
        />
      )}

      {/* Seller overlay */}
      <VideoInfo seller={item.seller} />

      {/* Action rail */}
      <div className="absolute bottom-32 right-3 z-20 flex flex-col items-center gap-4">
        <VideoActions
          product={product}
          commentCount={item.comments?.length || 0}
          onProductClick={() => setDrawerOpen(true)}
          messageHref={messageHref}
        />
      </div>

      {/* Scroll controls */}
      {onScroll && (
        <div className="absolute bottom-32 left-3 z-20 flex flex-col items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Previous"
            className="rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur"
            onClick={() => onScroll('up')}
          >
            <ChevronUp className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Next"
            className="rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur"
            onClick={() => onScroll('down')}
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Product drawer */}
      <ProductDrawer
        product={product}
        isOpen={drawerOpen}
        onOpenChange={setDrawerOpen}
        shopHref={productHref || `/sellers/${product.sellerId}`}
        shopLabel={shopLinkLabel}
        checkoutHrefFor={checkoutHrefFor || ((orderId: string) => `/checkout/${orderId}`)}
        messageHref={messageHref}
      />
    </div>
  );
}
