'use client';
import { LandingHeader } from './landing-header';
import { LandingFooter } from './landing-footer';
import { LandingBottomNav } from './landing-bottom-nav';

export function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
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
