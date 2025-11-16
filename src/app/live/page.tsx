
'use client';

import { useRef, useCallback } from 'react';
import { VideoCard } from '@/components/feed/video-card';
import { feedItems } from '@/lib/placeholder-data';
import { MainLayout } from '@/components/layout/main-layout';

export default function LiveFeedPage() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((direction: 'up' | 'down') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = container.clientHeight; // Each video is the height of the container
    const currentScroll = container.scrollTop;

    let targetScroll;
    if (direction === 'down') {
      targetScroll = currentScroll + scrollAmount;
    } else {
      targetScroll = currentScroll - scrollAmount;
    }
    
    container.scrollTo({
        top: targetScroll,
        behavior: 'smooth',
    });

  }, []);


  return (
    <MainLayout>
      <div className="relative h-full w-full">
        <div 
          ref={scrollContainerRef}
          className="h-full w-full snap-y snap-mandatory overflow-y-scroll"
        >
          {feedItems.map((item, index) => (
            <div key={item.id} className="h-full w-full snap-start flex-shrink-0">
              <VideoCard item={item} onScroll={handleScroll} />
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
