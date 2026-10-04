'use client';

import { SellerLiveStudio } from '@/components/live/seller-live-studio';

/**
 * APP SELLER — LIVE STUDIO (`/app/seller/live`).
 *
 * The same studio the website runs at `/dashboard/seller/live`, mounted inside
 * the app's seller shell rather than the website's. The camera, the 100-point
 * session cost, the VideoSDK room and the "you are live" toast are all the same
 * code path — only the chrome around it and where "Back" points differ, which
 * is why the component takes its back link as a prop instead of hard-coding the
 * website route.
 *
 * The full-bleed black preview has to fill the shell's content box, so the
 * wrapper only supplies height; the studio paints the rest.
 */
export default function AppSellerLivePage() {
  return (
    <div className="-mx-4 -mt-4 h-[calc(100dvh-11.5rem)] w-full overflow-hidden bg-black">
      <SellerLiveStudio backHref="/app/seller" backLabel="Overview" />
    </div>
  );
}