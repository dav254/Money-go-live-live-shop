
'use client';

import { Facebook, Twitter, Instagram, Youtube, Globe, Heart } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '../logo';

export function LandingFooter() {
  const quickLinks = [
    { label: "Home", href: "/" },
    { label: "Features", href: "/features" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "For Sellers", href: "/login" }
  ];

  return (
    <footer className="relative bg-muted/30 border-t border-border pt-20 pb-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            <div className="space-y-6">
              <Link href="/" className="block">
                <Logo className="h-12 w-auto" />
              </Link>
              <p className="text-muted-foreground text-sm max-w-xs">
                The world's next-generation social commerce platform. Where videos become income.
              </p>
              <div className="flex gap-3">
                {[Facebook, Twitter, Instagram, Youtube].map((Icon, index) => (
                  <a 
                    key={index} 
                    href="#" 
                    className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-all duration-300"
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-cyber text-foreground font-bold mb-6">Quick Links</h4>
              <ul className="space-y-4">
                {quickLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-muted-foreground hover:text-primary text-sm transition-colors">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-cyber text-foreground font-bold mb-6">Support</h4>
              <ul className="space-y-4">
                {[
                  { label: "Help Center", href: "#" },
                  { label: "FAQs", href: "/faq" },
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" }
                ].map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-muted-foreground hover:text-primary text-sm transition-colors">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="space-y-6">
              <h4 className="font-cyber text-foreground font-bold">Commerce Protocol</h4>
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Live Status</p>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Global Nodes Active</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-6">
            <p className="text-muted-foreground text-sm">© 2026 GoEarn. All rights reserved.</p>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-sm">Made with</span>
              <Heart className="w-4 h-4 text-primary fill-primary" />
              <span className="text-muted-foreground text-sm">for the World</span>
              <Globe className="w-4 h-4 text-blue-500 animate-spin-slow" />
            </div>
          </div>
        </div>
      </footer>
  )
}
