'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { VideoFeedItem } from '@/lib/types';
import { VideoInfo } from './video-info';
import { VideoActions } from './video-actions';
import { ProductDrawer } from './product-drawer';
import { Button } from '../ui/button';

interface VideoCardProps {
  item: VideoFeedItem;
}

export function VideoCard({ item }: VideoCardProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="relative h-full w-full bg-black">
      <Image
        src={item.video.imageUrl}
        alt={item.video.description}
        fill
        className="object-cover"
        priority
        data-ai-hint={item.video.imageHint}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
      
      <VideoInfo seller={item.seller} viewers={item.viewers} />

      <div className="absolute bottom-4 left-4 z-20">
         <Button variant="secondary" className="bg-black/50 hover:bg-black/70">
            View Shop
          </Button>
      </div>

      <VideoActions 
        initialLikes={item.likes}
        onProductClick={() => setIsDrawerOpen(true)}
      />

      <ProductDrawer 
        product={item.product}
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      />
    </div>
  );
}
