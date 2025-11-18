
'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { VideoFeedItem } from '@/lib/types';
import { VideoInfo } from './video-info';
import { VideoActions } from './video-actions';
import { ProductDrawer } from './product-drawer';
import { Button } from '../ui/button';
import Link from 'next/link';
import { useUser } from '@/firebase';
import { ProductInfo } from '../live/product-info';

interface VideoCardProps {
  item: VideoFeedItem;
  onScroll?: (direction: 'up' | 'down') => void;
}

export function VideoCard({ item, onScroll }: VideoCardProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { user } = useUser();

  return (
    <div className="relative h-full w-full bg-black">
      {item.video.mediaType === 'video' ? (
        <video 
          src={item.video.imageUrl} // imageUrl now holds the media URL
          className="h-full w-full object-cover" 
          autoPlay 
          muted 
          loop 
          playsInline
          key={item.video.imageUrl}
        />
      ) : (
        <Image
          src={item.video.imageUrl}
          alt={item.video.description || item.product.name}
          fill
          className="object-cover"
          priority
          data-ai-hint={item.video.imageHint}
          key={item.video.imageUrl}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
      
      <VideoInfo seller={item.seller} viewers={item.viewers} />

       {/* Product Info (Bottom Center) */}
       <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-auto w-full max-w-sm px-4">
            {item.product && <ProductInfo product={item.product} />}
       </div>

      <VideoActions 
        initialLikes={item.likes}
        onProductClick={() => setIsDrawerOpen(true)}
        onScroll={onScroll}
      />

      <ProductDrawer 
        product={item.product}
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      />
    </div>
  );
}
