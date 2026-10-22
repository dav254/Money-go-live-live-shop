'use client';
import { LandingHeader } from './landing-header';
import { LandingFooter } from './landing-footer';
import { LandingBottomNav } from './landing-bottom-nav';

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
    </div>
  );
}
