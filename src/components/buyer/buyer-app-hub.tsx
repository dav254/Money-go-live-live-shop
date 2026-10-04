'use client';

/**
 * BuyerAppHub — "Get the app" section inside the buyer experience.
 * Promotes the PWA install (Play Store / App Store later — the manifest
 * and icons are already production-grade) and previews the mobile app
 * design so users know what to expect.
 */

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { InstallAppButton } from '@/components/install-app-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Smartphone, Zap, ShieldCheck, Sparkles, Bell, Home, Inbox, Plus, ShoppingCart, User } from 'lucide-react';

const PERKS = [
  { icon: Zap, title: 'Instant access', desc: 'Full-screen, offline-ready, no browser tabs.' },
  { icon: Bell, title: 'Push alerts', desc: 'Orders, offers and messages the moment they land.' },
  { icon: Sparkles, title: 'AI Studio on the go', desc: 'Create product media from your pocket.' },
  { icon: ShieldCheck, title: 'Secure by design', desc: 'Your session stays in your section.' },
];

export function BuyerAppHub() {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-ember-navy text-white">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 md:p-10">
        <div className="space-y-5">
          <Badge className="rounded-full bg-primary/15 text-primary border border-primary/30 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
            <Smartphone className="mr-1.5 h-3 w-3" /> Vidnov App
          </Badge>
          <h2 className="font-grotesk text-2xl md:text-3xl font-bold leading-tight">
            Vidnov in your pocket.
          </h2>
          <p className="max-w-sm text-sm text-white/60 leading-relaxed">
            Install Vidnov as a real app on your phone — full screen, fast, and always one tap
            away. Same account, same everything, better experience.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {PERKS.map((p) => (
              <div key={p.title} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                  <p.icon className="h-4 w-4 text-primary" />
                </span>
                <span>
                  <span className="block text-[12px] font-semibold text-white">{p.title}</span>
                  <span className="block text-[11px] leading-snug text-white/50">{p.desc}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <InstallAppButton className="h-12 rounded-xl border-primary/30 bg-primary px-6 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-primary/90 vn-shadow-glow" />
            <Link
              href="/app-preview"
              className="text-[11px] font-bold uppercase tracking-widest text-white/60 underline-offset-4 transition hover:text-white hover:underline"
            >
              See the app design →
            </Link>
          </div>
        </div>

        {/* Mini phone mock */}
        <div className="flex items-center justify-center">
          <div className="w-[220px] rounded-[32px] border border-white/15 bg-black/50 p-2 vn-shadow">
            <div className="relative h-[420px] rounded-[26px] bg-[#0A1224] overflow-hidden">
              <div className="pt-8 pb-2 px-4 flex items-center justify-between">
                <span className="text-[8px] font-semibold text-white/40">9:41</span>
                <span className="text-[8px] font-bold tracking-[0.2em] text-white/40">Vidnov</span>
              </div>
              <div className="px-3 space-y-2.5">
                <div className="h-8 rounded-lg border border-white/10 bg-white/5 flex items-center px-2.5">
                  <span className="text-[9px] text-white/30">Search Vidnov…</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="relative aspect-[3/4] overflow-hidden rounded-lg">
                      <Image
                        src={`https://picsum.photos/seed/vnapp${n}/240/320`}
                        alt={`App preview ${n}`}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      {n === 1 && (
                        <span className="absolute top-1.5 left-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-widest text-white">
                          Live
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="h-9 rounded-lg vn-grad-coral flex items-center justify-center vn-shadow-glow">
                  <span className="text-[8px] font-bold uppercase tracking-[0.25em] text-white">Create</span>
                </div>
                {/* bottom tabs */}
                <div className="flex items-center justify-around rounded-t-xl border-t border-white/10 bg-black/40 px-1 pt-1.5 pb-2">
                  {[Home, Inbox, Plus, ShoppingCart, User].map((Icon, i) => (
                    <Icon
                      key={i}
                      className={
                        i === 2
                          ? 'h-5 w-5 -mt-3 rounded-md vn-grad-coral p-0.5 text-white'
                          : 'h-3.5 w-3.5 text-white/40'
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
