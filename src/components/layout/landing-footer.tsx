
'use client';

import { Facebook, Twitter, Instagram, Youtube, Globe, Heart } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '../logo';

export function LandingFooter() {
  const quickLinks = [
    { label: "Home", href: "/" },
    { label: "Features", href: "/features" },
    { label: "How It Works", href: "/how-it-works" },
    { label: "For Sellers", href: "/login" }
  ];

  return (
<<<<<<< HEAD
    <footer className="relative bg-muted/30 border-t border-border pt-20 pb-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            <div className="space-y-6">
              <Link href="/" className="block">
                <Logo className="h-12 w-auto" />
              </Link>
              <p className="text-muted-foreground text-sm max-w-xs">
=======
    <footer className="relative bg-neutral-950 border-t border-white/5 pt-20 pb-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12 mb-16">
            <div>
              <Link href="/" className="block mb-6">
                <Logo className="h-12 w-auto" />
              </Link>
              <p className="text-neutral-500 text-sm mb-6 leading-relaxed">
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
                The world's next-generation social commerce platform. Where videos become income.
              </p>
              <div className="flex gap-3">
                {[Facebook, Twitter, Instagram, Youtube].map((Icon, index) => (
<<<<<<< HEAD
                  <a 
                    key={index} 
                    href="#" 
                    className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-all duration-300"
                  >
=======
                  <a key={index} href="#" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-primary transition-all">
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
                    <Icon className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>

            <div>
<<<<<<< HEAD
              <h4 className="font-cyber text-foreground font-bold mb-6">Quick Links</h4>
              <ul className="space-y-4">
                {quickLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-muted-foreground hover:text-primary text-sm transition-colors">{link.label}</Link>
=======
              <h4 className="font-cyber text-lg font-bold mb-6 uppercase tracking-widest">Navigation</h4>
              <ul className="flex flex-col gap-3">
                {quickLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-neutral-500 hover:text-primary text-sm transition-colors uppercase font-bold tracking-tighter">{link.label}</Link>
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
                  </li>
                ))}
              </ul>
            </div>

            <div>
<<<<<<< HEAD
              <h4 className="font-cyber text-foreground font-bold mb-6">Support</h4>
              <ul className="space-y-4">
=======
              <h4 className="font-cyber text-lg font-bold mb-6 uppercase tracking-widest">Legals</h4>
              <ul className="flex flex-col gap-3">
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
                {[
                  { label: "FAQs", href: "/faq" },
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" }
                ].map((link) => (
                  <li key={link.label}>
<<<<<<< HEAD
                    <Link href={link.href} className="text-muted-foreground hover:text-primary text-sm transition-colors">{link.label}</Link>
=======
                    <Link href={link.href} className="text-neutral-500 hover:text-primary text-sm transition-colors uppercase font-bold tracking-tighter">{link.label}</Link>
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
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

<<<<<<< HEAD
          <div className="pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-6">
            <p className="text-muted-foreground text-sm">© 2026 GoEarn. All rights reserved.</p>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-sm">Made with</span>
              <Heart className="w-4 h-4 text-primary fill-primary" />
              <span className="text-muted-foreground text-sm">for the World</span>
              <Globe className="w-4 h-4 text-blue-500 animate-spin-slow" />
=======
          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-neutral-600 text-xs font-bold uppercase tracking-widest">© 2026 GoEarnvid. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <span className="text-neutral-600 text-xs font-bold uppercase tracking-widest">Built with</span>
              <Heart className="w-3 h-3 text-primary fill-primary" />
              <span className="text-neutral-600 text-xs font-bold uppercase tracking-widest">for the Future</span>
              <Globe className="animate-spin-slow w-3 h-3 text-blue-500" />
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
            </div>
          </div>
        </div>
      </footer>
  )
}
