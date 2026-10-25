import { SellerLayout } from '@/components/layout/seller-layout';
import { VideoStudio } from '@/components/video-studio/video-studio';

/**
 * SELLER WEBSITE · VIDEO STUDIO (`/dashboard/seller/video-studio`).
 *
 * The dedicated studio surface (spec §A): record or upload, edit with music,
 * preview the server-rendered final file, publish into Discovery / the shop,
 * and manage drafts. The heavy lifting lives in
 * `src/components/video-studio/video-studio.tsx`; this page is just the
 * SellerLayout wrapper, matching how every other seller page is mounted.
 */
export default function VideoStudioPage() {
  return (
    <SellerLayout>
      <VideoStudio />
    </SellerLayout>
  );
}