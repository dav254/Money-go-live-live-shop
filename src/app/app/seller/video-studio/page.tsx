'use client';

import { VideoEditorStudio } from '@/components/studio/editor/editor';

/**
 * APP SELLER — VIDEO STUDIO (`/app/seller/video-studio`).
 *
 * The CapCut-style editor on the application surface — the same
 * `VideoEditorStudio` the website mounts at `/seller/studio/editor`, so both
 * surfaces share one preview/timeline/export pipeline instead of drifting
 * into two editors.
 *
 * The shell renders this route IMMERSIVE (see IMMERSIVE_ROUTES in
 * seller-app-shell), so the tab bar is not rendered and the content box is
 * the full screen below the 3rem top bar (h-12 header + pb-2 main) — a video
 * editor needs every pixel a phone has, and two navigation surfaces under
 * the timeline was exactly what the website layout avoids too. Leaving is
 * the editor's own Close (back into the drawer's route) or the hamburger.
 *
 * Auth and role gating come from SellerAppShell, same contract as every
 * other `/app/seller/*` screen.
 */
export default function AppSellerVideoStudioPage() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-black text-white">
      <VideoEditorStudio />
    </div>
  );
}
