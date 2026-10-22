'use client';

import Link from 'next/link';
import { ArrowRight, Play, ShoppingBag, Radio, Sparkles, Zap, Star, Users, TrendingUp } from 'lucide-react';

import { LandingLayout } from '@/components/layout/landing-layout';
import { Button } from '@/components/ui/button';

const highlights = [
  { label: 'Live shoppers', value: '12.4k', icon: Users },
  { label: 'Creator sales', value: '+28%', icon: TrendingUp },
  { label: 'Avg. watch time', value: '9m 42s', icon: Star },
];

const featureCards = [
  { title: 'Shop live', desc: 'Watch products in motion, ask questions, and buy in one tap.', icon: Radio },
  { title: 'Create content', desc: 'Turn product photos into polished promos and short-form video.', icon: Sparkles },
  { title: 'Grow faster', desc: 'Turn interest into real conversations and conversion-ready offers.', icon: Zap },
];

export default function VidnovHomePage() {
  return (
    <LandingLayout>
      <div className="relative overflow-hidden bg-[#F7F1E8] text-[#171717]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,77,54,0.14),transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(52,77,232,0.12),transparent_30%)]" />

        <section className="relative mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#171717] bg-[#D9F36A] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-[#171717] shadow-[3px_3px_0_0_#171717]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF4D36] shadow-[0_0_0_3px_rgba(255,77,54,0.15)]" />
                LIVE COMMERCE
              </div>

              <h1 className="mt-6 font-grotesk text-[clamp(3.1rem,7vw,6rem)] font-black leading-[0.92] tracking-[-0.06em] text-[#171717]">
                MAKE YOUR
                <span className="block text-[#FF4D36]">NEXT SALE</span>
                HAPPEN NOW.
              </h1>

              <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#524f4b]">
                Discover products, build trust with live moments, and turn creative ideas into conversion-ready storefronts.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-full border-2 border-[#171717] bg-[#FF4D36] px-7 text-sm font-bold text-[#171717] shadow-[4px_4px_0_0_#171717] hover:-translate-y-0.5 hover:bg-[#FF5D45]">
                  <Link href="/buyer/discovery">
                    Shop live
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>

                <Button asChild variant="outline" size="lg" className="h-12 rounded-full border-2 border-[#171717] bg-transparent px-7 text-sm font-bold text-[#171717] hover:bg-[#171717] hover:text-[#F5F0E6]">
                  <Link href="/ai-studio">Create Studio</Link>
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <div className="rounded-full border border-[#171717]/15 bg-white/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#171717]/70">
                  Trusted by creators
                </div>
                <div className="flex -space-x-2">
                  {['A','M','J','L'].map((letter, index) => (
                    <div key={letter} className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#F7F1E8] text-[11px] font-bold text-[#171717] ${index % 2 === 0 ? 'bg-[#D9F36A]' : 'bg-[#C7D5FF]'}`}>
                      {letter}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -left-4 top-10 h-24 w-24 rounded-full border-[10px] border-[#D9F36A]/70 blur-[2px]" />
              <div className="absolute -right-10 bottom-14 h-32 w-32 rounded-full border-[8px] border-[#344DE8]/40" />

              <div className="relative overflow-hidden rounded-[32px] border-2 border-[#171717] bg-[#171717] p-4 shadow-[18px_18px_0_0_rgba(23,23,23,0.92)]">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#FF4D36]" />
                    LIVE NOW
                  </div>
                  <div className="rounded-full bg-[#D9F36A] px-2 py-1 font-bold text-[#171717]">+2.4k watching</div>
                </div>

                <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-[#1D1A48] via-[#1B1B1B] to-[#2A1D16] p-3">
                  <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-[#0F172A] p-4">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-white/60">
                      <span>Studio Drop</span>
                      <span>12 left</span>
                    </div>

                    <div className="mt-4 rounded-[20px] border border-white/10 bg-gradient-to-br from-[#f8d5b4] via-[#f4eee8] to-[#b9d8ff] p-4">
                      <div className="rounded-[18px] border border-[#171717]/10 bg-white/60 p-3 backdrop-blur-sm">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-[#171717] px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#F5F0E6]">NOVA</span>
                          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#171717]/60">New drop</span>
                        </div>
                        <div className="mt-5 flex items-end justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-[#171717]/60">Collector edition</p>
                            <h3 className="mt-2 font-grotesk text-3xl font-black leading-none text-[#171717]">Aero 7</h3>
                          </div>
                          <div className="rounded-2xl bg-[#171717] px-3 py-2 text-right text-[#F5F0E6] shadow-[4px_4px_0_0_rgba(255,255,255,0.15)]">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-white/70">From</div>
                            <div className="font-grotesk text-xl font-black">$149</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-sm text-white/80">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#171717] bg-[#D9F36A] text-[10px] font-bold text-[#171717]">J</span>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#171717] bg-[#FFB38A] text-[10px] font-bold text-[#171717]">A</span>
                        </div>
                        <span className="font-medium">45 joining</span>
                      </div>
                      <button className="inline-flex items-center gap-2 rounded-full bg-[#FF4D36] px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#171717]">
                        <Play className="h-3.5 w-3.5 fill-current" />
                        Watch
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  {highlights.map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white">
                      <Icon className="h-4 w-4 text-[#D9F36A]" />
                      <div className="mt-3 font-grotesk text-2xl font-black leading-none">{value}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/60">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="absolute -bottom-5 left-6 rounded-full border-2 border-[#171717] bg-[#F7F1E8] px-4 py-2 shadow-[4px_4px_0_0_#171717]">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#171717]">
                  <ShoppingBag className="h-4 w-4 text-[#FF4D36]" />
                  Merch kits ready
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-t-2 border-[#171717] bg-[#F3EDE2]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#171717]/60">Why creators pick Vidnov</p>
                <h2 className="mt-3 font-grotesk text-4xl font-black tracking-[-0.05em] text-[#171717] sm:text-5xl">
                  Built for real-time discovery.
                </h2>
              </div>
              <Link href="/buyer/discovery" className="inline-flex items-center gap-2 text-sm font-bold text-[#171717] underline-offset-4 hover:underline">
                Explore the feed <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {featureCards.map(({ title, desc, icon: Icon }) => (
                <div key={title} className="rounded-[26px] border-2 border-[#171717] bg-[#fffdf9] p-6 shadow-[8px_8px_0_0_rgba(23,23,23,0.95)] transition-transform hover:-translate-y-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#171717] bg-[#D9F36A] text-[#171717]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-grotesk text-2xl font-black tracking-[-0.04em] text-[#171717]">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#5b5651]">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </LandingLayout>
  );
}
