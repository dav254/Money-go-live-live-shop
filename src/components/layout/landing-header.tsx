'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { Logo } from '../logo';
import { ThemeToggle } from '../theme-toggle';

export function LandingHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { label: 'Discover', href: '/buyer/dashboard' },
    { label: 'Business', href: '/signup?role=seller' },
    { label: 'AI Studio', href: '/dashboard/seller/ai-studio' },
  ];

  return (
    <header className="sticky top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link href="/" className="flex items-center" aria-label="Vidnov home">
            <Logo className="text-2xl md:text-3xl" />
          </Link>

          <nav className="hidden md:flex items-center gap-10">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-[13px] font-medium text-muted-foreground hover:text-foreground vn-transition"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" asChild className="rounded-lg text-[13px] font-medium">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild className="rounded-lg px-6 text-[12px] font-semibold uppercase tracking-[0.15em]">
              <Link href="/signup?role=seller">Start a Business</Link>
            </Button>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </Button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-lg">
          <div className="container mx-auto px-4 py-6 flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="py-3 text-[15px] font-medium text-foreground border-b border-border last:border-0"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-5 flex flex-col gap-3">
              <Button variant="outline" className="w-full h-12 rounded-lg text-[13px] font-semibold uppercase tracking-[0.15em]" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button className="w-full h-12 rounded-lg text-[12px] font-semibold uppercase tracking-[0.15em]" asChild>
                <Link href="/signup?role=seller">Start a Business</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
