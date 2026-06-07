
'use client';

import { Facebook, Twitter, Instagram, Youtube, Globe, Heart } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '../logo';

export function LandingFooter() {
  const quickLinks = [
    { label: "Home", href: "/" },
    { label: "Features", href: "/features" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "For Sellers", href: "/login" },
    { label: "Blog", href: "#" }
  ];
  return (
    <footer className="relative bg-neutral-950 border-t border-white/5 pt-20 pb-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12 mb-16">
            <div>
              <Link href="/" className="block mb-6">
                <Logo className="h-12 w-auto" />
              </Link>
              <p className="text-neutral-500 text-sm mb-6 leading-relaxed">
                The world's next-generation social commerce platform. Where videos become income.
              </p>
              <div className="flex gap-3">
                {[Facebook, Twitter, Instagram, Youtube].map((Icon, index) => (
                  <a key={index} href="#" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-primary transition-all">
                    <Icon className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-cyber text-lg font-bold mb-6 uppercase tracking-widest">Navigation</h4>
              <ul className="flex flex-col gap-3">
                {quickLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-neutral-500 hover:text-primary text-sm transition-colors uppercase font-bold tracking-tighter">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-cyber text-lg font-bold mb-6 uppercase tracking-widest">Legals</h4>
              <ul className="flex flex-col gap-3">
                {[
                  { label: "FAQs", href: "/faq" },
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" }
                ].map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-neutral-500 hover:text-primary text-sm transition-colors uppercase font-bold tracking-tighter">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
               <h4 className="font-cyber text-lg font-bold mb-6 uppercase tracking-widest">Global Vision</h4>
               <p className="text-neutral-500 text-sm leading-relaxed">
                  Empowering entrepreneurs across the globe through video-first commerce and AI intelligence. Join the movement.
               </p>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-neutral-600 text-xs font-bold uppercase tracking-widest">© 2026 GoEarnvid. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <span className="text-neutral-600 text-xs font-bold uppercase tracking-widest">Built with</span>
              <Heart className="w-3 h-3 text-primary fill-primary" />
              <span className="text-neutral-600 text-xs font-bold uppercase tracking-widest">for the Future</span>
              <Globe className="animate-spin-slow w-3 h-3 text-blue-500" />
            </div>
          </div>
        </div>
      </footer>
  )
}
