'use client';
import { LandingHeader } from './landing-header';

export function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-dark-bg">
      <LandingHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
