'use client';

import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Crown,
  Gem,
  Play,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react';

import { LandingLayout } from '@/components/layout/landing-layout';
import { Button } from '@/components/ui/button';

const featureCards = [
  {
    title: 'Private live drops',
    text: 'Launch curated collections with cinematic product moments that feel exclusive, not generic.',
    icon: Sparkles,
  },
  {
    title: 'Luxury storefronts',
    text: 'Every detail is designed to feel elevated, intentional, and unmistakably premium.',
    icon: Crown,
  },
  {
    title: 'Conversion without noise',
    text: 'Deliver a cleaner buying journey that makes attention feel valuable instead of forced.',
    icon: TrendingUp,
  },
];

const collectionCards = [
  { name: 'Aurel Atelier', tag: 'Object / Living', accent: 'from-[#f2d5b3] via-[#c7a57d] to-[#dfe7ff]' },
  { name: 'Noir Haven', tag: 'Wear / Iconic', accent: 'from-[#d9d9d9] via-[#8d8d8d] to-[#1a1a1a]' },
  { name: 'Veloura Lab', tag: 'Beauty / Ritual', accent: 'from-[#fbe7cd] via-[#e7ceb4] to-[#b37d5d]' },
];

export default function VidnovHomePage() {
  return (
    <LandingLayout>
      <div className="relative overflow-hidden bg-[#090909] text-[#f5f0e6]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(214,170,104,0.15),transparent_22%),radial-gradient(circle_at_right,_rgba(120,145,255,0.12),transparent_26%),linear-gradient(180deg,#090909_0%,#111111_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d9b37d] to-transparent" />

        <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14">
          <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d9b37d]/50 bg-[#0f0f0f]/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-[#f1d8af] shadow-[0_0_30px_rgba(217,179,125,0.08)]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#d9b37d]" />
                Private commerce, reimagined
              </div>

              <h1 className="mt-6 max-w-xl font-grotesk text-[clamp(3.3rem,7vw,6.2rem)] font-black leading-[0.9] tracking-[-0.07em] text-[#f8f3eb]">
                Luxury
                <span className="block bg-gradient-to-r from-[#f3d9a3] via-[#d5b079] to-[#c29058] bg-clip-text text-transparent">
                  commerce
                </span>
                feels this good.
              </h1>

              <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#d1c7ba]">
                Vidnov brings premium brands, elevated products, and live culture into one polished experience—crafted to attract attention and convert desire instantly.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-full border border-[#d9b37d] bg-[#d9b37d] px-7 text-sm font-bold text-[#121212] shadow-[0_12px_30px_rgba(217,179,125,0.25)] transition-all hover:-translate-y-0.5 hover:bg-[#e5c17e]">
                  <Link href="/buyer/discovery">
                    Explore boutique
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>

                <Button asChild variant="outline" size="lg" className="h-12 rounded-full border border-[#f2e3cc]/35 bg-transparent px-7 text-sm font-bold text-[#f5f0e6] hover:bg-[#f5f0e6] hover:text-[#121212]">
                  <Link href="/ai-studio">Book a private demo</Link>
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-5 text-[11px] font-medium uppercase tracking-[0.22em] text-[#c9bca7]">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#d9b37d]" />
                  Curated quality
                </span>
                <span className="inline-flex items-center gap-2">
                  <Gem className="h-4 w-4 text-[#d9b37d]" />
                  Premium curation
                </span>
                <span className="inline-flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#d9b37d]" />
                  Live conversion
                </span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[560px]">
              <div className="absolute -left-4 top-12 h-28 w-28 rounded-full border-[8px] border-[#d9b37d]/50 blur-[2px]" />
              <div className="absolute -right-6 bottom-16 h-32 w-32 rounded-full border-[10px] border-[#6d88ff]/30" />

              <div className="relative overflow-hidden rounded-[32px] border border-[#d9b37d]/30 bg-[#121212] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.65)]">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#e8dcc7]">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#d9b37d]" />
                    Live now
                  </div>
                  <div className="rounded-full border border-[#d9b37d]/40 bg-[#d9b37d]/10 px-2 py-1 text-[#f3d9a3]">+2.8k watching</div>
                </div>

                <div className="mt-4 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#201913] via-[#0c0b0d] to-[#171c2d] p-3">
                  <div className="rounded-[22px] border border-[#d9b37d]/25 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[#d9c9b1]">
                      <span>Maison collection</span>
                      <span>Edition 07</span>
                    </div>

                    <div className="mt-5 rounded-[24px] border border-[#d9b37d]/25 bg-gradient-to-br from-[#f5e7d3] via-[#d8c2a0] to-[#aab8d5] p-4">
                      <div className="rounded-[20px] border border-[#141414]/10 bg-white/30 p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-[#171717] px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#f5f0e6]">LUNE</span>
                          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#171717]/60">New arrival</span>
                        </div>

                        <div className="mt-6 flex items-end justify-between gap-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[#171717]/60">Hand-finished</p>
                            <h3 className="mt-2 font-grotesk text-[2.7rem] font-black leading-none text-[#171717]">Aster</h3>
                          </div>
                          <div className="rounded-[18px] border border-[#171717]/15 bg-[#171717] px-3 py-2 text-right text-[#f5f0e6] shadow-[5px_5px_0_0_rgba(23,23,23,0.2)]">
                            <div className="text-[9px] uppercase tracking-[0.18em] text-[#d7d7d7]">From</div>
                            <div className="font-grotesk text-2xl font-black">$240</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-[#0d0d0d]/70 px-3 py-2 text-sm text-[#f5f0e6]">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#121212] bg-[#d9b37d] text-[9px] font-bold text-[#121212]">A</span>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#121212] bg-[#d6d9ff] text-[9px] font-bold text-[#121212]">M</span>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#121212] bg-[#f6d4ad] text-[9px] font-bold text-[#121212]">J</span>
                        </div>
                        <span className="text-[#d8d0c3]">38 joining</span>
                      </div>

                      <button className="inline-flex items-center gap-2 rounded-full bg-[#d9b37d] px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#111111]">
                        <Play className="h-3.5 w-3.5 fill-current" />
                        Watch
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { label: 'Monthly sales', value: '+28%' },
                    { label: 'Avg. watch', value: '9m 42s' },
                    { label: 'Repeat buyers', value: '73%' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[18px] border border-white/10 bg-white/5 p-3">
                      <div className="font-grotesk text-2xl font-black leading-none text-[#f5f0e6]">{item.value}</div>
                      <div className="mt-1 text-[9px] uppercase tracking-[0.16em] text-[#c9bca7]">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-t border-[#d9b37d]/20 bg-[#101010]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#d9b37d]">Why brands choose Vidnov</p>
                <h2 className="mt-3 max-w-2xl font-grotesk text-4xl font-black tracking-[-0.06em] text-[#f5f0e6] sm:text-5xl">
                  Clean, elevated, and impossible to ignore.
                </h2>
              </div>
              <Link href="/buyer/discovery" className="inline-flex items-center gap-2 text-sm font-bold text-[#f5f0e6] underline-offset-4 hover:underline">
                See the live feed <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {featureCards.map(({ title, text, icon: Icon }) => (
                <div key={title} className="rounded-[26px] border border-[#d9b37d]/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.25)] transition-transform hover:-translate-y-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d9b37d]/30 bg-[#d9b37d]/10 text-[#f1d8af]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-grotesk text-2xl font-black tracking-[-0.05em] text-[#f5f0e6]">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#c8bca8]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative border-t border-[#d9b37d]/20 bg-[#0b0b0b]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#d9b37d]">Signature edits</p>
                <h2 className="mt-2 font-grotesk text-4xl font-black tracking-[-0.06em] text-[#f5f0e6] sm:text-5xl">Curated for a discerning eye.</h2>
              </div>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {collectionCards.map(({ name, tag, accent }) => (
                <article key={name} className="group rounded-[28px] border border-[#d9b37d]/20 bg-[#121212] p-3 shadow-[0_20px_40px_rgba(0,0,0,0.28)] transition-all hover:-translate-y-1 hover:border-[#d9b37d]/45">
                  <div className={`relative h-80 overflow-hidden rounded-[22px] bg-gradient-to-br ${accent}`}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.5),transparent_25%),linear-gradient(135deg,rgba(0,0,0,0.08),rgba(0,0,0,0.28))]" />
                    <div className="absolute left-4 top-4 rounded-full border border-[#111111]/15 bg-[#ffffff]/35 px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-[#111111]">{tag}</div>
                    <div className="absolute bottom-4 left-4 rounded-[18px] border border-[#111111]/15 bg-[#141414]/70 px-3 py-2 backdrop-blur-sm">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-[#e8dcc7]">Featured label</div>
                      <div className="mt-2 font-grotesk text-2xl font-black text-[#f5f0e6]">{name}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative border-t border-[#d9b37d]/20 bg-[#0f0f10]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#d9b37d]">Designed to sell</p>
                <h2 className="mt-3 font-grotesk text-4xl font-black tracking-[-0.06em] text-[#f5f0e6] sm:text-5xl">
                  Every touchpoint feels intentional.
                </h2>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-[#c8bca8]">
                  Great brands do not win by being louder. They win by feeling more valuable from the first impression onward.
                </p>

                <div className="mt-8 space-y-5">
                  {[
                    'Ready-made premium visual language for products, creators, and collections.',
                    'Built for live selling, storytelling, and instant trust-building.',
                    'A homepage that makes buyers feel the value before they ever click.',
                  ].map((point) => (
                    <div key={point} className="flex items-start gap-3 rounded-2xl border border-[#d9b37d]/15 bg-white/5 p-3 text-[#eee3d2]">
                      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#d9b37d] text-[#111111]">
                        <Star className="h-4 w-4 fill-current" />
                      </div>
                      <p className="text-sm leading-relaxed">{point}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-[#d9b37d]/20 bg-[linear-gradient(135deg,rgba(217,179,125,0.14),rgba(255,255,255,0.02),rgba(100,118,255,0.1))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
                <div className="rounded-[24px] border border-white/10 bg-[#111111] p-5">
                  <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d9b37d]">
                    <span>Brand signal</span>
                    <span className="rounded-full border border-[#d9b37d]/30 bg-[#d9b37d]/10 px-2 py-1">Premium</span>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[20px] border border-[#d9b37d]/20 bg-[#171717] p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[#d9b37d]">Engagement</div>
                      <div className="mt-3 font-grotesk text-4xl font-black text-[#f5f0e6]">+64%</div>
                    </div>
                    <div className="rounded-[20px] border border-[#d9b37d]/20 bg-[#171717] p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[#d9b37d]">Retention</div>
                      <div className="mt-3 font-grotesk text-4xl font-black text-[#f5f0e6]">81%</div>
                    </div>
                    <div className="rounded-[20px] border border-[#d9b37d]/20 bg-[#171717] p-4 sm:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[#d9b37d]">Purchase momentum</div>
                          <div className="mt-2 font-grotesk text-3xl font-black text-[#f5f0e6]">+12.4k</div>
                        </div>
                        <div className="rounded-full border border-[#d9b37d]/30 bg-[#d9b37d]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f1d8af]">
                          Active now
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-[#d9b37d]/20 bg-[#050505]">
          <div className="absolute -right-16 top-8 h-48 w-48 rounded-full border-[18px] border-[#d9b37d]/20" />
          <div className="relative mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d9b37d]/35 bg-[#141414] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.26em] text-[#f2d9ab]">
              <ShoppingBag className="h-3.5 w-3.5" />
              Premium path to purchase
            </div>

            <h2 className="mx-auto mt-8 max-w-4xl font-grotesk text-[clamp(2.8rem,7vw,5.8rem)] font-black leading-[0.92] tracking-[-0.07em] text-[#f7f3ee]">
              A homepage that feels
              <span className="block bg-gradient-to-r from-[#f3d9a3] via-[#d6ad6d] to-[#d9b37d] bg-clip-text text-transparent">
                worth the second look.
              </span>
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#d0c5b6]">
              This is the moment to build desire. A premium first impression is not decoration—it is the strongest sales tool in the room.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-full border border-[#d9b37d] bg-[#d9b37d] px-8 text-sm font-bold text-[#121212] shadow-[0_12px_30px_rgba(217,179,125,0.25)] hover:-translate-y-0.5 hover:bg-[#e3c17b]">
                <Link href="/buyer/discovery">
                  Explore the collection
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button asChild variant="outline" size="lg" className="h-12 rounded-full border border-[#f3e3d0]/30 bg-transparent px-8 text-sm font-bold text-[#f5f0e6] hover:bg-[#f5f0e6] hover:text-[#111111]">
                <Link href="/ai-studio">Create Studio</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </LandingLayout>
  );
}
