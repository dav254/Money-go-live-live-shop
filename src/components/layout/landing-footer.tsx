'use client';

import Link from 'next/link';
import { Logo } from '../logo';
import { requestConsentBanner } from '@/lib/cookie-consent';

/**
 * LANDING FOOTER — the public site footer.
 *
 * Every link points at a route that exists today. There is no invented contact
 * email (none is configured in the product), so "Contact" goes to the help
 * centre, which is where support actually happens. Social links are omitted
 * rather than pointed at accounts that may not be ours.
 */

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'VIDNOV',
    links: [
      { label: 'About Vidnov', href: '/about' },
      { label: 'How it works', href: '/how-it-works' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Android app', href: '/download' },
    ],
  },
  {
    title: 'DISCOVER',
    links: [
      { label: 'Discover everything', href: '/discovery' },
      { label: 'Explore businesses', href: '/discover?kind=businesses' },
      { label: 'Products', href: '/discover?kind=listings' },
      { label: 'Services', href: '/categories?type=services' },
      { label: 'Live shopping', href: '/live' },
    ],
  },
  {
    title: 'BUSINESS & CREATORS',
    links: [
      { label: 'For sellers', href: '/app/seller/create' },
      { label: 'For creators', href: '/ai-studio' },
      { label: 'Seller sign in', href: '/login' },
      { label: 'Help & support', href: '/faq' },
    ],
  },
  {
    title: 'LEGAL & SAFETY',
    links: [
      { label: 'Privacy policy', href: '/privacy' },
      { label: 'Terms of service', href: '/terms' },
      { label: 'Safety & community rules', href: '/terms' },
      { label: 'Contact', href: '/faq' },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto max-w-7xl px-4 py-14 lg:px-8">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-6">
          <div className="col-span-2 space-y-4">
            <Link href="/" aria-label="Vidnov home">
              <Logo className="text-3xl" />
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Discover businesses, explore products and services, connect with
              creators, and find new opportunities.
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <span>Marketplace</span>
              <span aria-hidden>·</span>
              <span>Live</span>
              <span aria-hidden>·</span>
              <span>Video</span>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                {col.title}
              </h4>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-foreground/80 vn-transition hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
              © 2026 Vidnov. All rights reserved.
            </p>
            <button
              type="button"
              onClick={requestConsentBanner}
              className="text-[11px] font-medium tracking-wide text-muted-foreground underline-offset-4 vn-transition hover:text-foreground hover:underline"
            >
              Cookie settings
            </button>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            Discover · Connect · Grow
          </p>
        </div>
      </div>
    </footer>
  );
}
