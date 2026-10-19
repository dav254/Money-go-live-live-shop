'use client';

import { SellerLiveStudio } from '@/components/live/seller-live-studio';

/**
 * APP SELLER — LIVE STUDIO (`/app/seller/live`).
 *
 * The same studio the website runs at `/dashboard/seller/live`, mounted inside
 * the app's seller shell rather than the website's. The camera, the 100-point
 * session cost, the LiveKit room and the "you are live" toast are all the same
 * code path — only the chrome around it and where "Back" point differ, which is
 * why the component takes its back link as a prop instead of hard-coding the
 * website route.
 *
 * ## Full screen, for real
 * This route is immersive in the seller shell (see `IMMERSIVE_ROUTES`), so the
 * tab bar is gone. The stage is then `fixed` from just under the shell's h-12
 * header straight to the bottom of the viewport: a calculated height always
 * left a seam (shell padding, the header's 1px border, dvh rounding on mobile),
 * and a seam under a broadcast is exactly the "looks bad" gap. The header sits
 * at z-50 above the stage, so menu and back stay reachable while live.
 */
export default function AppSellerLivePage() {
  return (
    <div className="fixed inset-x-0 bottom-0 top-12 z-40 mx-auto w-full max-w-md overflow-hidden bg-black">
      <SellerLiveStudio backHref="/app/seller" backLabel="Overview" />
    </div>
  );
}
