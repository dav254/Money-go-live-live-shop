
import { LivePreview } from '@/components/live/live-preview';
import { MainLayout } from '@/components/layout/main-layout';

export default function HomePage() {
  return (
    <MainLayout>
      <div className="h-[calc(100vh-4rem)]">
        <LivePreview />
      </div>
    </MainLayout>
  );
}
