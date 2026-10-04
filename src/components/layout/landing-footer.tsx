'use client';

import Link from 'next/link';
import { Logo } from '../logo';

const COLUMNS = [
  {
    title: 'PLATFORM',
    links: [
      { label: 'Discover', href: '/buyer/dashboard' },
      { label: 'Start a Business', href: '/signup?role=seller' },
      { label: 'AI Studio', href: '/dashboard/seller/ai-studio' },
      { label: 'Request Marketplace', href: '/requests' },
    ],
  },
  {
    title: 'COMPANY',
    links: [
      { label: 'How It Works', href: '/how-it-works' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container max-w-7xl mx-auto px-4 lg:px-8 pt-16 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand column */}
          <div className="space-y-6">
            <Link href="/" className="block" aria-label="Vidnov home">
              <Logo className="text-4xl" withTagline />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              A different way to connect businesses and people. Built for speed, structure and reach.
            </p>
            <div className="space-y-2 pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">Support</p>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/dashboard/account?tab=security" className="text-foreground/80 hover:text-foreground vn-transition">
                    Account &amp; security
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="text-foreground/80 hover:text-foreground vn-transition">
                    Help Center
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground mb-6">
                {col.title}
              </h4>
              <ul className="space-y-3.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-foreground/80 hover:text-foreground vn-transition">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Status column */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground mb-6">NETWORK</h4>
            <div className="rounded-xl border border-border p-5 bg-card">
              <div className="flex items-center gap-2.5">
                <span className="vn-dot vn-dot-active" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">All systems operational</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">Marketplace · Payments · AI</p>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[11px] font-medium text-muted-foreground tracking-wide">
            © 2026 VIDNOV
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            Create · Connect · Move
          </p>
        </div>
      </div>
    </footer>
  );
}
