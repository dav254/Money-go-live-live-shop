'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { VideoEditorStudio } from '@/components/studio/editor/editor';

/**
 * CapCut-style video editing studio. Auth and role gating come from
 * SellerLayout (same contract as the record page), and the shell fills the
 * viewport below its header so the preview/timeline/toolbar layout stays
 * stable on phones.
 */
export default function StudioEditorPage() {
  return (
    <SellerLayout>
      <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-black text-white">
        <VideoEditorStudio />
      </div>
    </SellerLayout>
  );
}
