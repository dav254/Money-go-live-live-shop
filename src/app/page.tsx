import { MainLayout } from '@/components/layout/main-layout';
import { VideoFeed } from '@/components/feed/video-feed';
import { feedItems } from '@/lib/placeholder-data';

export default function HomePage() {
  return (
    <MainLayout>
      <div className="h-[calc(100vh-4rem)]">
        <VideoFeed items={feedItems} />
      </div>
    </MainLayout>
  );
}
