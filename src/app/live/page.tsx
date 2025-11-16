
'use client';

import { VideoCard } from '@/components/feed/video-card';
import { feedItems } from '@/lib/placeholder-data';
import { MainLayout } from '@/components/layout/main-layout';

export default function LiveFeedPage() {
  return (
    <MainLayout>
      <div className="relative h-full w-full">
        <div className="h-full w-full snap-y snap-mandatory overflow-y-scroll">
          {feedItems.map((item, index) => (
            <div key={item.id} className="h-full w-full snap-start flex-shrink-0">
              <VideoCard item={item} />
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
