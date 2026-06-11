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
    { label: "Features", href: "/features" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "For Sellers", href: "/login" }
  ];

  return (
    <header className="sticky top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center">
            <Logo className="h-10 w-auto text-primary" />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">Log In</Link>
            </Button>
            <Button className="font-bold bg-primary text-white hover:bg-primary/90" asChild>
              <Link href="/signup?role=seller">Start Selling</Link>
            </Button>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </Button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden animate-fade-in border-t border-border bg-background/95 backdrop-blur-lg">
          <div className="container mx-auto px-4 py-6 flex flex-col gap-4">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href} className="text-muted-foreground hover:text-foreground transition-colors py-2" onClick={() => setIsMenuOpen(false)}>
                {item.label}
              </Link>
            ))}
            <div className="pt-4 border-t border-border flex flex-col gap-3">
              <Button variant="ghost" className="w-full" asChild><Link href="/login">Log In</Link></Button>
              <Button className="w-full font-bold bg-primary text-white" asChild><Link href="/signup?role=seller">Start Selling</Link></Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
