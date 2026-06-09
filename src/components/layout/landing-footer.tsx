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
    <footer style={{ position: 'relative', background: 'hsl(240, 20%, 4%)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '5rem', paddingBottom: '2.5rem' }}>
        <div className="container" style={{ padding: '0 1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '3rem', marginBottom: '4rem' }}>
            <div>
              <Link href="/" className="block mb-6">
                <Logo className="h-12 w-auto" />
              </Link>
              <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                The world's next-generation social commerce platform. Where videos become income.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {[Facebook, Twitter, Instagram, Youtube].map((Icon, index) => (
                  <a key={index} href="#" style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'all 0.3s' }}>
                    <Icon style={{ width: '1.25rem', height: '1.25rem' }} />
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-cyber" style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem' }}>Quick Links</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {quickLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '0.875rem', transition: 'color 0.3s' }}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-cyber" style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem' }}>Support</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { label: "Help Center", href: "#" },
                  { label: "FAQs", href: "/faq" },
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" }
                ].map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '0.875rem', transition: 'color 0.3s' }}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div style={{ paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.875rem' }}>© 2026 GoEarn. All rights reserved.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.875rem' }}>Made with</span>
              <Heart style={{ width: '1rem', height: '1rem', color: 'hsl(270, 100%, 65%)', fill: 'hsl(270, 100%, 65%)' }} />
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.875rem' }}>for the World</span>
              <Globe className="animate-spin-slow" style={{ width: '1rem', height: '1rem', color: 'hsl(200, 100%, 55%)' }} />
            </div>
          </div>
        </div>
      </footer>
  )
}
