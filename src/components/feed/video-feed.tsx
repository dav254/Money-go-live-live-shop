'use client';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { VideoCard } from './video-card';
import type { VideoFeedItem } from '@/lib/types';
import { useEffect, useState } from 'react';

interface VideoFeedProps {
  items: VideoFeedItem[];
}

export function VideoFeed({ items }: VideoFeedProps) {
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    if (!api) {
      return;
    }
    // You can add logic here when the slide changes, e.g., for analytics
    api.on('select', () => {
      // console.log(`Selected slide: ${api.selectedScrollSnap()}`);
    });
  }, [api]);

  return (
    <Carousel
      setApi={setApi}
      opts={{
        axis: 'y',
        loop: true,
      }}
      className="h-full w-full"
    >
      <CarouselContent className="-mt-0 h-full">
        {items.map((item) => (
          <CarouselItem key={item.id} className="pt-0">
            <VideoCard item={item} />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
