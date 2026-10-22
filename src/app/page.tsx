'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Play } from 'lucide-react';

import { LandingLayout } from '@/components/layout/landing-layout';
import { Button } from '@/components/ui/button';
import { VidnovLogo } from '@/components/logo';
import {
  PLAYGROUND, PaperTexture, Reveal, StampSeal,
  SneakerArt, HeadphonesArt, CoffeeBagArt, SkincareArt, WatchArt, LampArt,
  ToteArt, PosterArt, VideoStillArt,
} from '@/components/home/playground-art';
import { BeforeAfterSlider } from '@/components/home/before-after-slider';

/**
 * THE VIDNOV PLAYGROUND — the production homepage.
 *
 * Vidnov is at launch: there is no seller base to showcase, so the page is
 * honest about what it is — an art-directed playground of clearly-labelled
 * DEMO content built from original vector artwork, alongside the real routes
 * a visitor can actually take today (Discovery, Create Studio, How It Works,
 * sign-in). No fake sellers, prices, stock, reviews or engagement numbers
 * appear anywhere, and nothing demo is wired to a purchase flow.
 *
 * Identity: warm ivory paper, deep ink type, electric coral for signature
 * actions, cobalt for creative elements, acid lime as a sparing highlight.
 * Display type is Space Grotesk (already loaded), body is Inter, editorial
 * accents are Instrument Serif italic. Motion is CSS-only, once-per-element,
 * and fully disabled under prefers-reduced-motion.
 */

const C = PLAYGROUND;

/* ── Buttons ──────────────────────────────────────────────────────────── */

function CoralCta({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Button
      asChild
      size="lg"
      className={`rounded-full border-2 border-[#171717] bg-[#FF4D36] font-bold text-[#171717] shadow-[3px_3px_0_0_#171717] transition-all hover:-translate-y-0.5 hover:bg-[#FF4D36] hover:shadow-[4px_4px_0_0_#171717] active:translate-y-0 active:shadow-[2px_2px_0_0_#171717] ${className}`}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}

function InkOutlineCta({ href, children, className = '', invert = false }: { href: string; children: React.ReactNode; className?: string; invert?: boolean }) {
  return (
    <Button
      asChild
      size="lg"
      variant="outline"
      className={`rounded-full border-2 font-bold transition-all ${
        invert
          ? 'border-[#F5F0E6] bg-transparent text-[#F5F0E6] hover:bg-[#F5F0E6] hover:text-[#171717]'
          : 'border-[#171717] bg-transparent text-[#171717] hover:bg-[#171717] hover:text-[#F5F0E6]'
      } ${className}`}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}

function SectionLabel({ children, tone = 'ink' }: { children: React.ReactNode; tone?: 'ink' | 'lime' | 'ivory' }) {
  const styles =
    tone === 'lime'
      ? 'bg-[#D9F36A] text-[#171717]'
      : tone === 'ivory'
        ? 'bg-transparent text-[#F5F0E6] ring-1 ring-[#F5F0E6]/40'
        : 'bg-[#171717] text-[#F5F0E6]';
  return (
    <span className={`inline-block rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.32em] ${styles}`}>
      {children}
    </span>
  );
}

/* ── Motion tile (one real demo clip + labelled stills) ───────────────── */

const DEMO_CLIP_SRC =
  '/Maximalist%20Caregiver%20Service%20Flyer%20Us%20Legal%20-%20Made%20with%20PosterMyWall.mp4';

function MotionClipTile() {
  const [playing, setPlaying] = React.useState(false);

  return (
    <div className="relative w-[260px] shrink-0 snap-start overflow-hidden rounded-2xl border-2 border-[#171717] bg-[#171717] sm:w-[300px]">
      <div className="aspect-[9/16]">
        {playing ? (
          <video src={DEMO_CLIP_SRC} controls autoPlay playsInline className="h-full w-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group relative block h-full w-full text-left"
            aria-label="Play the demo poster-in-motion clip"
          >
            <PosterArt className="h-full w-full" />
            <span className="absolute inset-0 grid place-items-center bg-[#171717]/25 transition-colors group-hover:bg-[#171717]/15">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#171717] bg-[#FF4D36] text-[#171717] shadow-[3px_3px_0_0_#171717]">
                <Play className="ml-0.5 h-6 w-6 fill-current" aria-hidden />
              </span>
            </span>
            <span className="absolute bottom-3 left-3 rounded-full bg-[#171717] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F5F0E6]">
              Demo clip · poster in motion
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function MotionStillTile({
  art,
  ratio,
  label,
  width,
}: {
  art: React.ReactNode;
  ratio: string;
  label: string;
  width: string;
}) {
  return (
    <Link
      href="/buyer/discovery"
      className={`group relative shrink-0 snap-start overflow-hidden rounded-2xl border-2 border-[#171717] ${width}`}
      style={{ aspectRatio: ratio }}
      aria-label={`${label} — open Discovery for real video content`}
    >
      {art}
      <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#171717] bg-[#D9F36A] text-[#171717]">
          <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden />
        </span>
      </span>
      <span className="absolute bottom-3 left-3 rounded-full bg-[#F5F0E6] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#171717]">
        {label}
      </span>
    </Link>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function VidnovHomePage() {
  const router = useRouter();
  const [idea, setIdea] = React.useState('');

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = idea.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <LandingLayout>
      <div style={{ background: C.ivory }}>
        {/* ══════════════════════ HERO ══════════════════════ */}
        <section className="relative overflow-hidden">
          <PaperTexture />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-[1.04fr_0.96fr] lg:gap-10 lg:px-8">
            <div>
              <SectionLabel tone="lime">A new space for ideas</SectionLabel>

              <h1 className="font-grotesk mt-6 text-[clamp(2.6rem,8vw,5.2rem)] font-bold leading-[0.96] tracking-tight text-[#171717]">
                MAKE THE NEXT
                <br />
                THING{' '}
                <span className="text-[#FF4D36]">HAPPEN.</span>
              </h1>

              <p className="mt-4 font-serif text-[clamp(1.5rem,3.4vw,2.2rem)] italic leading-tight text-[#344DE8]">
                Find it. Shape it. Share it.
              </p>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-[#77746D]">
                Discover possibilities. Turn ordinary photos into striking visuals.
                Explore a new way to bring products, creativity and business
                together.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <CoralCta href="/buyer/discovery" className="h-12 px-8 text-sm">
                  Explore Vidnov
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </CoralCta>
                <InkOutlineCta href="/ai-studio" className="h-12 px-8 text-sm">
                  Enter Create Studio
                </InkOutlineCta>
              </div>

              {/* The platform's own search, ready on the first screen */}
              <form onSubmit={submitSearch} role="search" className="mt-8 max-w-md">
                <label htmlFor="hero-search" className="sr-only">
                  What are you looking for?
                </label>
                <div className="flex items-center gap-2 rounded-full border-2 border-[#171717] bg-[#F5F0E6] px-2 py-1.5">
                  <input
                    id="hero-search"
                    type="search"
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder="What are you looking for?"
                    className="h-9 w-full min-w-0 bg-transparent px-2 text-sm text-[#171717] placeholder:text-[#77746D] focus:outline-none"
                  />
                  <Button type="submit" className="h-9 shrink-0 rounded-full border-2 border-[#171717] bg-[#171717] px-5 text-xs font-bold text-[#F5F0E6] hover:bg-[#344DE8]">
                    Search
                  </Button>
                </div>
              </form>
            </div>

            {/* Right — the mood board (desktop collage) */}
            <div className="relative hidden lg:block" style={{ height: 560 }}>
              <StampSeal className="absolute -left-4 top-2 z-20" color={C.ink} />

              <div className="absolute left-6 top-16 w-[54%] -rotate-3 overflow-hidden rounded-2xl border-2 border-[#171717] shadow-[8px_8px_0_0_rgba(23,23,23,0.9)] transition-transform hover:rotate-0 hover:-translate-y-1">
                <SneakerArt />
              </div>

              <div className="absolute right-0 top-4 w-[40%] rotate-2 overflow-hidden rounded-2xl border-2 border-[#171717] transition-transform hover:rotate-0 hover:-translate-y-1">
                <CoffeeBagArt />
              </div>

              <div className="absolute right-[6%] top-[34%] w-[26%] rotate-6 overflow-hidden rounded-2xl border-2 border-[#171717] shadow-[6px_6px_0_0_rgba(23,23,23,0.9)] transition-transform hover:rotate-0 hover:-translate-y-1">
                <WatchArt />
              </div>

              <div className="absolute bottom-4 left-0 w-[44%] -rotate-2 overflow-hidden rounded-2xl border-2 border-[#171717] transition-transform hover:rotate-0 hover:-translate-y-1">
                <HeadphonesArt />
              </div>

              <div className="absolute bottom-10 right-[8%] w-[34%] rotate-1 overflow-hidden rounded-2xl border-2 border-[#171717] shadow-[6px_6px_0_0_rgba(23,23,23,0.9)] transition-transform hover:rotate-0 hover:-translate-y-1">
                <SkincareArt />
              </div>

              <Link
                href="/buyer/discovery"
                className="absolute bottom-[42%] left-[30%] w-[22%] -rotate-6 overflow-hidden rounded-2xl border-2 border-[#171717] transition-transform hover:rotate-0 hover:-translate-y-1"
                aria-label="Open Discovery — the real video and product experience"
              >
                <VideoStillArt />
              </Link>

              <span className="absolute right-[30%] top-[8%] z-10 -rotate-6 rounded-sm border border-[#171717] bg-[#D9F36A] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#171717]">
                Demo experience
              </span>
            </div>

            {/* Right — mobile grid */}
            <div className="grid grid-cols-2 gap-3 lg:hidden">
              <div className="col-span-2 overflow-hidden rounded-2xl border-2 border-[#171717]">
                <SneakerArt />
              </div>
              <div className="overflow-hidden rounded-2xl border-2 border-[#171717]">
                <CoffeeBagArt />
              </div>
              <div className="overflow-hidden rounded-2xl border-2 border-[#171717]">
                <SkincareArt />
              </div>
              <div className="col-span-2 overflow-hidden rounded-2xl border-2 border-[#171717]">
                <HeadphonesArt />
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-2xl border-2 border-dashed border-[#171717] px-4 py-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#77746D]">
                  Demo content
                </span>
                <StampSeal size={64} color={C.ink} />
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════ TRANSFORMATION LAB ══════════════════════ */}
        <section id="lab" className="relative scroll-mt-24 border-t-2 border-[#171717]">
          <PaperTexture />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
            <Reveal>
              <SectionLabel>The transformation lab</SectionLabel>
              <h2 className="font-grotesk mt-5 max-w-3xl text-[clamp(2.1rem,5.5vw,3.8rem)] font-bold leading-[1.0] tracking-tight text-[#171717]">
                ONE PHOTO. A WORLD OF <span className="text-[#344DE8]">POSSIBILITIES.</span>
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-[#77746D]">
                Start with an image. Improve it, transform its presentation and
                create visuals ready to share.
              </p>
            </Reveal>

            <div className="mt-12 grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
              <Reveal>
                <BeforeAfterSlider
                  before={
                    <div className="grayscale-[0.9] contrast-[0.92]">
                      <SneakerArt className="w-full" />
                    </div>
                  }
                  after={<SneakerArt className="w-full" />}
                  beforeLabel="Original photo"
                  afterLabel="Enhanced"
                />
                <p className="mt-3 text-xs leading-relaxed text-[#77746D]">
                  Illustrative preview of the enhancement step, drawn for this
                  demo. In Create Studio the same move runs on your own photo
                  with the real editor — nothing here pretends to be AI output.
                </p>
              </Reveal>

              <Reveal delay={120}>
                <ol className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                  <li className="flex items-start gap-4 rounded-2xl border-2 border-[#171717] bg-[#F5F0E6] p-4">
                    <span className="font-grotesk text-2xl font-bold text-[#FF4D36]">01</span>
                    <div>
                      <h3 className="font-grotesk text-sm font-bold uppercase tracking-[0.14em] text-[#171717]">Start with a photo</h3>
                      <p className="mt-1 text-xs leading-relaxed text-[#77746D]">Any product photo — straight from your phone.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4 rounded-2xl border-2 border-[#171717] bg-[#F5F0E6] p-4">
                    <span className="font-grotesk text-2xl font-bold text-[#344DE8]">02</span>
                    <div>
                      <h3 className="font-grotesk text-sm font-bold uppercase tracking-[0.14em] text-[#171717]">Make it yours</h3>
                      <p className="mt-1 text-xs leading-relaxed text-[#77746D]">Crop, tune and lift the presentation until it feels designed.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4 rounded-2xl border-2 border-[#171717] bg-[#F5F0E6] p-4">
                    <span className="font-grotesk text-2xl font-bold text-[#171717]">03</span>
                    <div>
                      <h3 className="font-grotesk text-sm font-bold uppercase tracking-[0.14em] text-[#171717]">Create something new</h3>
                      <p className="mt-1 text-xs leading-relaxed text-[#77746D]">The same photo, rebuilt as a promotional poster.</p>
                    </div>
                  </li>
                </ol>

                <div className="mt-6 flex items-center gap-5">
                  <div className="w-28 -rotate-2 overflow-hidden rounded-xl border-2 border-[#171717] shadow-[5px_5px_0_0_rgba(23,23,23,0.9)]">
                    <PosterArt />
                  </div>
                  <div>
                    <CoralCta href="/app/seller/studio" className="h-11 px-6 text-sm">
                      Try Create Studio
                      <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                    </CoralCta>
                    <p className="mt-2 text-[11px] text-[#77746D]">
                      Your photos, your prices, your brand — preserved exactly.
                    </p>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ══════════════════════ THE POSSIBILITY EDIT ══════════════════════ */}
        <section id="edit" className="relative scroll-mt-24 border-t-2 border-[#171717]">
          <PaperTexture />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
            <Reveal>
              <SectionLabel tone="lime">Curated showcase · demo collection</SectionLabel>
              <h2 className="font-grotesk mt-5 text-[clamp(2.1rem,5.5vw,3.8rem)] font-bold leading-[1.0] tracking-tight text-[#171717]">
                THE POSSIBILITY <span className="font-serif italic font-normal">Edit</span>
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-[#77746D]">
                A curated playground of products, styles and creative directions.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-5 lg:grid-cols-12">
              <Reveal className="lg:col-span-7">
                <figure className="group h-full -rotate-[0.6deg] overflow-hidden rounded-2xl border-2 border-[#171717] bg-[#F5F0E6] transition-transform hover:rotate-0">
                  <LampArt className="w-full" />
                  <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-[#171717] px-5 py-4">
                    <div>
                      <h3 className="font-grotesk text-lg font-bold tracking-tight text-[#171717]">Everyday Objects, Reimagined</h3>
                      <p className="text-xs text-[#77746D]">NOMA Objects · fictional brand, concept only</p>
                    </div>
                    <span className="rounded-full bg-[#171717] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F5F0E6]">Demo collection</span>
                  </figcaption>
                </figure>
              </Reveal>

              <Reveal delay={100} className="lg:col-span-5">
                <figure className="group h-full rotate-[0.8deg] overflow-hidden rounded-2xl border-2 border-[#171717] bg-[#F5F0E6] transition-transform hover:rotate-0">
                  <SneakerArt className="w-full" />
                  <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-[#171717] px-5 py-4">
                    <div>
                      <h3 className="font-grotesk text-lg font-bold tracking-tight text-[#171717]">Made to Stand Out</h3>
                      <p className="text-xs text-[#77746D]">PACE Footwear · fictional brand, concept only</p>
                    </div>
                    <span className="rounded-full bg-[#171717] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F5F0E6]">Demo collection</span>
                  </figcaption>
                </figure>
              </Reveal>

              <Reveal delay={60} className="lg:col-span-4">
                <figure className="h-full rotate-[0.5deg] overflow-hidden rounded-2xl border-2 border-[#171717] bg-[#F5F0E6] transition-transform hover:rotate-0">
                  <WatchArt className="w-full" />
                  <figcaption className="border-t-2 border-[#171717] px-5 py-4">
                    <h3 className="font-grotesk text-base font-bold tracking-tight text-[#171717]">The Style Edit</h3>
                    <p className="text-xs text-[#77746D]">VESTA Atelier · fictional brand</p>
                  </figcaption>
                </figure>
              </Reveal>

              <Reveal delay={120} className="lg:col-span-4">
                <figure className="h-full -rotate-[0.4deg] overflow-hidden rounded-2xl border-2 border-[#171717] bg-[#F5F0E6] transition-transform hover:rotate-0">
                  <ToteArt className="w-full" />
                  <figcaption className="border-t-2 border-[#171717] px-5 py-4">
                    <h3 className="font-grotesk text-base font-bold tracking-tight text-[#171717]">Objects for Better Living</h3>
                    <p className="text-xs text-[#77746D]">AURA Ritual · fictional brand</p>
                  </figcaption>
                </figure>
              </Reveal>

              <Reveal delay={180} className="lg:col-span-4">
                <figure className="group h-full rotate-[0.7deg] overflow-hidden rounded-2xl border-2 border-[#171717] bg-[#F5F0E6] transition-transform hover:rotate-0">
                  <CoffeeBagArt className="w-full" />
                  <figcaption className="border-t-2 border-[#171717] px-5 py-4">
                    <h3 className="font-grotesk text-base font-bold tracking-tight text-[#171717]">Ideas in Motion</h3>
                    <p className="text-xs text-[#77746D]">KIN Coffee Roasters · fictional brand</p>
                  </figcaption>
                </figure>
              </Reveal>
            </div>

            <p className="mt-8 text-sm text-[#77746D]">
              Demonstration content only — fictional brands, nothing for sale on
              this page. Real products from real businesses live in{' '}
              <Link href="/buyer/discovery" className="font-semibold text-[#FF4D36] underline-offset-4 hover:underline">
                Discovery
              </Link>
              .
            </p>
          </div>
        </section>

        {/* ══════════════════════ MOTION ══════════════════════ */}
        <section id="motion" className="relative scroll-mt-24 border-t-2 border-[#171717]">
          <PaperTexture />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
            <Reveal>
              <SectionLabel>Motion</SectionLabel>
              <h2 className="font-grotesk mt-5 text-[clamp(2.1rem,5.5vw,3.8rem)] font-bold leading-[1.0] tracking-tight text-[#171717]">
                SOME IDEAS NEED TO <span className="text-[#FF4D36]">MOVE.</span>
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-[#77746D]">
                Video is a listing, an ad and a story. Creators record and publish
                right from the platform — these previews open the real feed.
              </p>
            </Reveal>

            <div className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4">
              <MotionClipTile />
              <MotionStillTile
                art={<CoffeeBagArt className="h-full w-full object-cover" />}
                ratio="16/10"
                label="Pour · demo still"
                width="w-[300px] sm:w-[380px]"
              />
              <MotionStillTile
                art={<SneakerArt className="h-full w-full object-cover" />}
                ratio="4/5"
                label="Showcase · demo still"
                width="w-[240px] sm:w-[280px]"
              />
              <MotionStillTile
                art={<ToteArt className="h-full w-full object-cover" />}
                ratio="1/1"
                label="Handmade · demo still"
                width="w-[260px] sm:w-[300px]"
              />
              <MotionStillTile
                art={<VideoStillArt className="h-full w-full object-cover" label="DEMO PREVIEW" />}
                ratio="3/4"
                label="Product clip · demo still"
                width="w-[240px] sm:w-[280px]"
              />
            </div>

            <p className="mt-2 text-xs text-[#77746D]">
              One demo clip and drawn stills — no invented views, likes or
              engagement. Open Discovery for the real video feed.
            </p>
          </div>
        </section>

        {/* ══════════════════════ THREE IDEAS ══════════════════════ */}
        <section className="relative border-t-2 border-[#171717] bg-[#F5F0E6]">
          <PaperTexture />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
            <Reveal>
              <h2 className="font-grotesk max-w-4xl text-[clamp(1.9rem,5vw,3.4rem)] font-bold leading-[1.05] tracking-tight text-[#77746D]">
                THE INTERNET GIVES YOU NOISE.
                <br />
                <span className="text-[#171717]">
                  VIDNOV GIVES YOUR IDEAS{' '}
                  <span className="text-[#FF4D36]">SOMEWHERE TO GO.</span>
                </span>
              </h2>
            </Reveal>

            <div className="mt-14 grid gap-10 lg:grid-cols-12">
              <Reveal className="lg:col-span-7">
                <div className="border-t-4 border-[#344DE8] pt-6">
                  <span className="font-grotesk text-5xl font-bold text-[#344DE8]">01</span>
                  <h3 className="font-grotesk mt-3 text-3xl font-bold tracking-tight text-[#171717]">
                    DISCOVER SOMETHING
                  </h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-[#77746D]">
                    Explore products, services, businesses and ideas through
                    visual discovery — a feed built for finding, not doomscrolling.
                  </p>
                  <Link href="/buyer/discovery" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#171717] underline-offset-4 hover:text-[#FF4D36] hover:underline">
                    Open Discovery <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={100} className="lg:col-span-5 lg:mt-10">
                <div className="border-t-4 border-[#FF4D36] pt-6">
                  <span className="font-grotesk text-5xl font-bold text-[#FF4D36]">02</span>
                  <h3 className="font-grotesk mt-3 text-3xl font-bold tracking-tight text-[#171717]">
                    CREATE SOMETHING
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#77746D]">
                    Enhance images and develop professional promotional content
                    with the built-in creative tools.
                  </p>
                  <Link href="/ai-studio" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#171717] underline-offset-4 hover:text-[#FF4D36] hover:underline">
                    Enter Create Studio <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={160} className="lg:col-span-6 lg:col-start-4">
                <div className="border-t-4 border-[#171717] pt-6">
                  <span className="font-grotesk text-5xl font-bold text-[#171717]">03</span>
                  <h3 className="font-grotesk mt-3 text-3xl font-bold tracking-tight text-[#171717]">
                    TAKE IT SOMEWHERE
                  </h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-[#77746D]">
                    Share content, showcase your business and connect it to real
                    enquiries — questions and offers land straight in messages.
                  </p>
                  <Link href="/messages" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#171717] underline-offset-4 hover:text-[#FF4D36] hover:underline">
                    See how messages work <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ══════════════════════ HOW IT WORKS ══════════════════════ */}
        <section className="relative border-t-2 border-[#171717]">
          <PaperTexture />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
            <Reveal>
              <SectionLabel>How Vidnov works</SectionLabel>
            </Reveal>

            <div className="relative mt-10 grid gap-6 lg:grid-cols-3">
              <svg className="pointer-events-none absolute inset-x-0 top-16 hidden h-8 w-full lg:block" viewBox="0 0 1000 30" preserveAspectRatio="none" aria-hidden>
                <path d="M120 15 H420 M580 15 H880" stroke="#171717" strokeWidth="2" strokeDasharray="4 8" strokeLinecap="round" />
                <path d="M470 8 l12 7 -12 7 Z M930 8 l12 7 -12 7 Z" fill="#FF4D36" />
              </svg>

              <Reveal>
                <Link href="/buyer/discovery" className="group block h-full rounded-2xl border-2 border-[#171717] bg-[#F5F0E6] p-7 transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#171717]">
                  <span className="font-grotesk text-4xl font-bold text-[#344DE8]">01</span>
                  <h3 className="font-grotesk mt-3 text-xl font-bold uppercase tracking-[0.1em] text-[#171717]">Discover</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#77746D]">
                    Explore curated examples and available content across the
                    marketplace.
                  </p>
                </Link>
              </Reveal>

              <Reveal delay={100}>
                <Link href="/app/seller/studio" className="group block h-full rounded-2xl border-2 border-[#171717] bg-[#F5F0E6] p-7 transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#171717]">
                  <span className="font-grotesk text-4xl font-bold text-[#FF4D36]">02</span>
                  <h3 className="font-grotesk mt-3 text-xl font-bold uppercase tracking-[0.1em] text-[#171717]">Create</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#77746D]">
                    Enhance a photo, design a poster or prepare content with the
                    real studio tools.
                  </p>
                </Link>
              </Reveal>

              <Reveal delay={180}>
                <Link href="/messages" className="group block h-full rounded-2xl border-2 border-[#171717] bg-[#F5F0E6] p-7 transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#171717]">
                  <span className="font-grotesk text-4xl font-bold text-[#171717]">03</span>
                  <h3 className="font-grotesk mt-3 text-xl font-bold uppercase tracking-[0.1em] text-[#171717]">Connect</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#77746D]">
                    Share your work and connect products or services to customers
                    through real enquiries.
                  </p>
                </Link>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ══════════════════════ FINALE ══════════════════════ */}
        <section className="relative overflow-hidden bg-[#171717]">
          <div className="relative mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 md:py-24">
            <span className="inline-block rounded-full bg-[#D9F36A] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.32em] text-[#171717]">
              Post · Earn · Repeat
            </span>

            <h2 className="font-grotesk mx-auto mt-8 max-w-4xl text-[clamp(2.6rem,8vw,5.6rem)] font-bold leading-[0.98] tracking-tight text-[#F5F0E6]">
              YOUR NEXT IDEA
              <br />
              STARTS{' '}
              <span className="relative inline-block">
                HERE.
                <svg viewBox="0 0 220 18" className="absolute -bottom-2 left-0 w-full" aria-hidden>
                  <path d="M4 12 C60 4, 150 4, 216 10" stroke="#FF4D36" strokeWidth="7" fill="none" strokeLinecap="round" />
                </svg>
              </span>
            </h2>

            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#F5F0E6]/70">
              Explore a new way to discover, create and bring ideas to life.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full border-2 border-[#F5F0E6] bg-[#F5F0E6] px-8 text-sm font-bold text-[#171717] transition-all hover:-translate-y-0.5 hover:bg-[#FF4D36] hover:border-[#FF4D36] hover:text-[#171717]"
              >
                <Link href="/buyer/discovery">
                  Explore Vidnov
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <InkOutlineCta invert href="/ai-studio" className="h-12 px-8 text-sm">
                Open Create Studio
              </InkOutlineCta>
            </div>
          </div>

          {/* One restrained lime accent */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border-[14px] border-[#D9F36A]/70" aria-hidden />
        </section>
      </div>
    </LandingLayout>
  );
}
