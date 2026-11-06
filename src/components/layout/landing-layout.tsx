'use client';
import { LandingHeader } from './landing-header';
import { LandingFooter } from './landing-footer';
import { LandingBottomNav } from './landing-bottom-nav';
import { SmartInstallPrompt } from '@/components/app/smart-install-prompt';

/**
 * LANDING CHROME.
 *
 * `dark` renders the whole landing surface — header, page, footer, mobile bar —
 * on the dark token set with a deep charcoal base. The homepage uses it for the
 * black Vidnov identity; the other landing pages keep the light theme, so the
 * variant is opt-in per page and never a global switch.
 */
export function LandingLayout({
  children,
  dark = false,
}: {
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className={
        dark
          ? 'dark min-h-screen flex flex-col bg-[#0A0A0B]'
          : 'min-h-screen flex flex-col bg-background'
      }
    >
      <LandingHeader />
      <main className="flex-1">{children}</main>
      <LandingFooter />
      {/* Mobile bar overlays the page bottom; pad the flow so the footer's last
          row and any page CTA stay reachable above it. */}
      <div aria-hidden className="h-16 pb-[env(safe-area-inset-bottom)] md:hidden" />
      <LandingBottomNav />
      {/* Marketing surfaces only: the install prompt is mounted here and not in
          the app shell, so it can never interrupt a checkout or the seller
          studio. It renders nothing until it decides it is welcome. */}
      <SmartInstallPrompt />
    </div>
  );
}
