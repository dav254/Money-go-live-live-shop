'use client';

import Link from 'next/link';
import { Logo } from '../logo';

/**
 * LANDING FOOTER — compact, per the homepage spec.
 *
 * Every link points at a route that exists today. The "Contact" entry links
 * to the help centre rather than inventing an email address that is not
 * configured anywhere in the product.
 */

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'PLATFORM',
    links: [
      { label: 'About Vidnov', href: '/about' },
      { label: 'Marketplace', href: '/categories' },
      { label: 'AI Studio', href: '/ai-studio' },
      { label: 'Shops & services', href: '/search' },
    ],
  },
  {
    title: 'GET STARTED',
    links: [
      { label: 'Become a Seller', href: '/signup?role=seller' },
      { label: 'How it works', href: '/how-it-works' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Sign in', href: '/login' },
    ],
  },
  {
    title: 'SUPPORT',
    links: [
      { label: 'Help & Support', href: '/faq' },
      { label: 'Contact', href: '/faq' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto max-w-7xl px-4 py-14 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 space-y-5 md:col-span-1">
            <Link href="/" aria-label="Vidnov home">
              <Logo className="text-3xl" />
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Create. Discover. Sell. Grow. One platform for products, services
              and the content that sells them.
            </p>
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

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 md:flex-row">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
            © 2026 Vidnov
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            Create · Discover · Sell · Grow
          </p>
        </div>
      </div>
    </footer>
  );
}
