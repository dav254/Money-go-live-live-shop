
import { LivePreview } from '@/components/live/live-preview';
import { SellerLayout } from '@/components/layout/seller-layout';

export default function StartLivePage() {
  return (
    <SellerLayout>
        <div className="h-[calc(100vh-4rem)]">
         <LivePreview />
        </div>
    </SellerLayout>
  );
}
