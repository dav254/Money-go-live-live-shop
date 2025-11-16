
'use client';

import { useRef, useCallback } from 'react';
import { VideoCard } from '@/components/feed/video-card';
import { feedItems } from '@/lib/placeholder-data';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown } from 'lucide-react';

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
              <VideoCard item={item} />
            </div>
          ))}
        </div>
        
        {/* Scroll Buttons */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-20 z-20">
            <Button 
                size="icon" 
                variant="ghost" 
                className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70"
                onClick={() => handleScroll('up')}
                aria-label="Scroll Up"
            >
                <ChevronUp className="h-6 w-6 text-white" />
            </Button>
            <Button 
                size="icon" 
                variant="ghost" 
                className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70"
                onClick={() => handleScroll('down')}
                aria-label="Scroll Down"
            >
                <ChevronDown className="h-6 w-6 text-white" />
            </Button>
        </div>
      </div>
    </MainLayout>
  );
}
