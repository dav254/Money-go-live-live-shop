'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { Logo } from '../logo';

export function LandingHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { label: "Features", href: "/features" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "For Sellers", href: "/login" },
    { label: "For Resellers", href: "/login" }
  ];

  return (
    <header className="sticky top-0 left-0 right-0 z-50 bg-dark-bg/60 backdrop-blur-xl border-b border-white/5">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg gradient-hero flex items-center justify-center shadow-lg glow-primary">
              <span className="font-cyber text-2xl font-bold text-dark-bg">G</span>
            </div>
            <span className="text-2xl font-bold font-cyber">GoEarn</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Log In</Link>
            </Button>
            <Button className="font-bold gradient-hero text-dark-bg" asChild>
              <Link href="/signup?role=seller">Start Selling</Link>
            </Button>
          </div>

          <div className="md:hidden">
            <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </Button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden animate-fade-in border-t border-white/5">
          <div className="container mx-auto px-4 py-6 flex flex-col gap-4">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href} className="text-muted-foreground hover:text-foreground transition-colors py-2" onClick={() => setIsMenuOpen(false)}>
                {item.label}
              </Link>
            ))}
            <div className="pt-4 border-t border-white/5 flex flex-col gap-3">
              <Button variant="ghost" className="w-full" asChild><Link href="/login">Log In</Link></Button>
              <Button className="w-full font-bold gradient-hero text-dark-bg" asChild><Link href="/signup?role=seller">Start Selling</Link></Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
