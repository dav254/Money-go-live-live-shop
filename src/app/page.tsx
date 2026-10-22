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
} from 'lucide-react';

import { LandingLayout } from '@/components/layout/landing-layout';
import { Button } from '@/components/ui/button';

const featureCards = [
  {
    title: 'Private live drops',
    text: 'Launch curated collections with cinematic product moments that feel rare, premium, and impossible to ignore.',
    icon: Sparkles,
  },
  {
    title: 'Luxury brand presence',
    text: 'Shape a storefront that signals taste, confidence, and value before a buyer ever reaches checkout.',
    icon: Crown,
  },
  {
    title: 'Conversion without clutter',
    text: 'Give visitors a clearer path to desire, trust, and purchase with less noise and more intention.',
    icon: TrendingUp,
  },
];

const collectionCards = [
  { name: 'Veloura', tag: 'Beauty / Ritual', accent: 'from-[#efe2d0] via-[#d1b390] to-[#71554a]' },
  { name: 'Aurel', tag: 'Living / Objects', accent: 'from-[#d9d9d9] via-[#a3a3a3] to-[#1a1a1a]' },
  { name: 'Noir & Co.', tag: 'Fashion / Icons', accent: 'from-[#f5ecd7] via-[#d2b17c] to-[#5c4335]' },
];

const statCards = [
  { label: 'avg. dwell', value: '9m 42s' },
  { label: 'repeat buyers', value: '73%' },
  { label: 'monthly lift', value: '+28%' },
];

export default function VidnovHomePage() {
  return (
    <LandingLayout>
      <div className="relative overflow-hidden bg-[#090909] text-[#f5f0e6]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(212,175,124,0.12),transparent_22%),radial-gradient(circle_at_right,_rgba(130,145,255,0.08),transparent_28%),linear-gradient(180deg,#090909_0%,#101010_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d7b57f] to-transparent" />

        <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14">
          <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d7b57f]/40 bg-[#0d0d0d]/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-[#f2d7a7] shadow-[0_0_25px_rgba(215,181,127,0.08)]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#d7b57f]" />
                Private commerce, elevated
              </div>

              <h1 className="mt-6 max-w-xl font-grotesk text-[clamp(3.2rem,7vw,6.2rem)] font-black leading-[0.9] tracking-[-0.07em] text-[#f9f4ee]">
                Build a
                <span className="block bg-gradient-to-r from-[#f5d9a7] via-[#d4b17e] to-[#bf8d5f] bg-clip-text text-transparent">
                  luxury brand
                </span>
                people remember.
              </h1>

              <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#d6ccc0]">
                Vidnov turns product discovery into a premium experience—where live culture, elevated design, and real conversion meet in one elegant storefront.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-full border border-[#d7b57f] bg-[#d7b57f] px-7 text-sm font-bold text-[#121212] shadow-[0_12px_30px_rgba(215,181,127,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#e3c37c]">
                  <Link href="/buyer/discovery">
                    Shop the edit
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>

                <Button asChild variant="outline" size="lg" className="h-12 rounded-full border border-[#f1e6d4]/30 bg-transparent px-7 text-sm font-bold text-[#f5f0e6] hover:bg-[#f5f0e6] hover:text-[#121212]">
                  <Link href="/ai-studio">Private demo</Link>
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-5 text-[11px] font-medium uppercase tracking-[0.22em] text-[#c9bca7]">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#d7b57f]" />
                  Curated quality
                </span>
                <span className="inline-flex items-center gap-2">
                  <Gem className="h-4 w-4 text-[#d7b57f]" />
                  Premium curation
                </span>
                <span className="inline-flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-[#d7b57f]" />
                  Live conversion
                </span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[560px]">
              <div className="absolute -left-5 top-10 h-24 w-24 rounded-full border-[8px] border-[#d7b57f]/40 blur-[2px]" />
              <div className="absolute -right-6 bottom-14 h-28 w-28 rounded-full border-[10px] border-[#8da0ff]/25" />

              <div className="relative overflow-hidden rounded-[32px] border border-[#d7b57f]/25 bg-[#101010] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.72)]">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#ebdfd2]">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#d7b57f]" />
                    Live now
                  </div>
                  <div className="rounded-full border border-[#d7b57f]/35 bg-[#d7b57f]/10 px-2 py-1 text-[#f3d9a7]">+2.8k watching</div>
                </div>

                <div className="mt-4 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#191410] via-[#101010] to-[#171d2d] p-3">
                  <div className="rounded-[22px] border border-[#d7b57f]/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-4">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[#d8c9b0]">
                      <span>Maison edit</span>
                      <span>Edition 07</span>
                    </div>

                    <div className="mt-5 rounded-[24px] border border-[#d7b57f]/25 bg-gradient-to-br from-[#f3e2cd] via-[#d7b37d] to-[#9ba4d3] p-4">
                      <div className="rounded-[20px] border border-[#171717]/10 bg-white/35 p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-[#171717] px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#f6f0e8]">LUNE</span>
                          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#171717]/65">New arrival</span>
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
                          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#121212] bg-[#d7b57f] text-[9px] font-bold text-[#121212]">A</span>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#121212] bg-[#d6d9ff] text-[9px] font-bold text-[#121212]">M</span>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#121212] bg-[#f6d4ad] text-[9px] font-bold text-[#121212]">J</span>
                        </div>
                        <span className="text-[#d8d0c3]">38 joining</span>
                      </div>

                      <button className="inline-flex items-center gap-2 rounded-full bg-[#d7b57f] px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#111111]">
                        <Play className="h-3.5 w-3.5 fill-current" />
                        Watch
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  {statCards.map((item) => (
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

        <section className="relative border-t border-[#d7b57f]/20 bg-[#111111]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#d7b57f]">Why brands choose Vidnov</p>
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
                <div key={title} className="rounded-[26px] border border-[#d7b57f]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.25)] transition-transform hover:-translate-y-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d7b57f]/25 bg-[#d7b57f]/10 text-[#f1d8af]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-grotesk text-2xl font-black tracking-[-0.05em] text-[#f5f0e6]">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#c8bca8]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative border-t border-[#d7b57f]/20 bg-[#090909]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#d7b57f]">Signature collection</p>
                <h2 className="mt-2 font-grotesk text-4xl font-black tracking-[-0.06em] text-[#f5f0e6] sm:text-5xl">Curated for a discerning eye.</h2>
              </div>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {collectionCards.map(({ name, tag, accent }) => (
                <article key={name} className="group rounded-[28px] border border-[#d7b57f]/15 bg-[#121212] p-3 shadow-[0_20px_40px_rgba(0,0,0,0.28)] transition-all hover:-translate-y-1 hover:border-[#d7b57f]/30">
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

        <section className="relative border-t border-[#d7b57f]/20 bg-[#0d0d0d]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#d7b57f]">Designed to sell</p>
                <h2 className="mt-3 font-grotesk text-4xl font-black tracking-[-0.06em] text-[#f5f0e6] sm:text-5xl">
                  Every touchpoint feels intentional.
                </h2>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-[#c8bca8]">
                  Great brands do not win by being louder. They win by feeling more valuable from the first impression onward.
                </p>

                <div className="mt-8 space-y-5">
                  {[
                    'Premium visual language for products, creators, and collections.',
                    'Built for trust, storytelling, and instant buyer confidence.',
                    'A homepage that sells taste before it ever asks for a click.',
                  ].map((point) => (
                    <div key={point} className="flex items-start gap-3 rounded-2xl border border-[#d7b57f]/15 bg-white/5 p-3 text-[#eee3d2]">
                      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#d7b57f] text-[#111111]">
                        <Star className="h-4 w-4 fill-current" />
                      </div>
                      <p className="text-sm leading-relaxed">{point}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-[#d7b57f]/15 bg-[linear-gradient(135deg,rgba(215,181,127,0.12),rgba(255,255,255,0.02),rgba(100,118,255,0.08))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
                <div className="rounded-[24px] border border-white/10 bg-[#111111] p-5">
                  <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7b57f]">
                    <span>Brand signal</span>
                    <span className="rounded-full border border-[#d7b57f]/30 bg-[#d7b57f]/10 px-2 py-1">Premium</span>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[20px] border border-[#d7b57f]/20 bg-[#171717] p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[#d7b57f]">Engagement</div>
                      <div className="mt-3 font-grotesk text-4xl font-black text-[#f5f0e6]">+64%</div>
                    </div>
                    <div className="rounded-[20px] border border-[#d7b57f]/20 bg-[#171717] p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[#d7b57f]">Retention</div>
                      <div className="mt-3 font-grotesk text-4xl font-black text-[#f5f0e6]">81%</div>
                    </div>
                    <div className="rounded-[20px] border border-[#d7b57f]/20 bg-[#171717] p-4 sm:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[#d7b57f]">Purchase momentum</div>
                          <div className="mt-2 font-grotesk text-3xl font-black text-[#f5f0e6]">+12.4k</div>
                        </div>
                        <div className="rounded-full border border-[#d7b57f]/30 bg-[#d7b57f]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f1d8af]">
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

        <section className="relative overflow-hidden border-t border-[#d7b57f]/20 bg-[#050505]">
          <div className="absolute -right-16 top-8 h-48 w-48 rounded-full border-[18px] border-[#d7b57f]/20" />
          <div className="relative mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d7b57f]/35 bg-[#141414] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.26em] text-[#f2d9ab]">
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
              <Button asChild size="lg" className="h-12 rounded-full border border-[#d7b57f] bg-[#d7b57f] px-8 text-sm font-bold text-[#121212] shadow-[0_12px_30px_rgba(215,181,127,0.25)] hover:-translate-y-0.5 hover:bg-[#e3c17b]">
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
