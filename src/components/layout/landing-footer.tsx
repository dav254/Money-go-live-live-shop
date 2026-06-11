'use client';

import { Facebook, Twitter, Instagram, Youtube, Globe, Heart } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '../logo';

export function LandingFooter() {
  const quickLinks = [
    { label: "Home", href: "/" },
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
    { label: "For Sellers", href: "/signup?role=seller" }
  ];

  return (
    <footer className="relative bg-muted/30 border-t border-border pt-20 pb-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            <div className="space-y-6 text-left">
              <Link href="/" className="block">
                <Logo className="h-12 w-auto" />
              </Link>
              <p className="text-muted-foreground text-sm leading-relaxed">
                The world's next-generation social commerce platform. Where creative motion becomes financial yield.
              </p>
              <div className="flex gap-3">
                {[Facebook, Twitter, Instagram, Youtube].map((Icon, index) => (
                  <a 
                    key={index} 
                    href="#" 
                    className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-all duration-300"
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>

            <div className="text-left">
              <h4 className="font-cyber text-sm font-black uppercase tracking-widest mb-6">Quick Links</h4>
              <ul className="space-y-4">
                {quickLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-muted-foreground hover:text-primary text-sm transition-colors font-medium">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-left">
              <h4 className="font-cyber text-sm font-black uppercase tracking-widest mb-6">Support</h4>
              <ul className="space-y-4">
                {[
                  { label: "Help Center", href: "/faq" },
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" }
                ].map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-muted-foreground hover:text-primary text-sm transition-colors font-medium">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-6 text-left">
                <h4 className="font-cyber text-sm font-black uppercase tracking-widest mb-6">Global Protocol</h4>
                <div className="p-5 rounded-3xl bg-white border border-border shadow-sm">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">NETWORK STATUS</p>
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[11px] font-bold uppercase tracking-tighter">OPERATIONAL</span>
                    </div>
                </div>
            </div>
          </div>

          <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-center">
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">© 2026 GoEarnvid • High Velocity Social Earning</p>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <span>Made with</span>
              <Heart className="h-3 w-3 text-primary fill-primary" />
              <span>for the World</span>
              <Globe className="h-3 w-3 text-blue-500" />
            </div>
          </div>
        </div>
      </footer>
  )
}
