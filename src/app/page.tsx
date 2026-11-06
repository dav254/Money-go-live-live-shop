'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CirclePlay,
  Flame,
  Store,
  MapPin,
  Search,
  Star,
  TrendingUp,
  Eye,
  BadgeCheck,
  Users,
  Send,
  FileCheck,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Logo } from '@/components/logo';
import { BuyerRequestBanner } from '@/components/home/buyer-request-banner';
import { SellerInvite } from '@/components/home/seller-invite';
import { Compass } from 'lucide-react';
import { landingCategories } from '@/lib/home-categories';
import type { LandingCategories, LandingCategory } from '@/components/home/category-grid';
import { landingSellers } from '@/lib/home-sellers';
import { landingProducts } from '@/lib/home-products';
import { landingVideos } from '@/lib/home-videos';
import type { LandingLiveSession } from '@/components/home/live-session-card';
import { FeaturedBadge } from '@/components/home/featured-badge';
import { BusinessCard } from '@/components/home/business-card';
import { ProductCard } from '@/components/home/product-card';
import { VideoCard } from '@/components/home/video-card';
import { LiveSessionCard } from '@/components/home/live-session-card';
import { CategoryGrid } from '@/components/home/category-grid';
import { GlobalSearch } from '@/components/home/global-search';
import { WhyVidnov } from '@/components/home/why-vidnov';
import { LandingFooter } from '@/components/layout/landing-footer';
import { LandingHeader } from '@/components/layout/landing-header';
import { LandingBottomNav } from '@/components/layout/landing-bottom-nav';
import { SmartInstallPrompt } from '@/components/app/smart-install-prompt';

/**
 * Intro video is configured, never committed: `NEXT_PUBLIC_VIDNOV_INTRO_VIDEO_URL`
 * points at the current brand film and the poster is a local placeholder, so a
 * missing asset degrades to a still card instead of a broken player.
 */
const INTRO_VIDEO_URL = process.env.NEXT_PUBLIC_VIDNOV_INTRO_VIDEO_URL ?? '';
const INTRO_POSTER = '/placeholder-image.svg';

/** One clearly-labelled preview of a live room (never a real session). */
function DemoRoomCard({ demo }: { demo?: boolean }) {
  return (
    <Link
      href={demo ? '/buyer/discovery' : '/buyer/discovery'}
      className="group flex h-full flex-col justify-between rounded-[20px] border border-white/10 bg-[#111111] p-4 transition hover:border-[#ff5a36]/40"
    >
      {demo && (
        // Sample room — never presented as a real, live session.
        <span className="mb-3 inline-flex w-fit items-center rounded-full border border-[#ff5a36]/30 bg-[#ff5a36]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#ff8a6a]">
          Sample
        </span>
      )}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ffcfbf]">
          Maison One
        </p>
        <p className="mt-2 font-grotesk text-2xl font-black leading-none text-white">NOVA</p>
        <p className="mt-2 text-[10px] leading-relaxed text-white/50">
          What a live room looks like
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">From $249</span>
        <CirclePlay className="h-4 w-4 text-[#ff5a36]" />
      </div>
    </Link>
  );
}

/** Transparent header, sticky over the hero. */
const DEMO_ROOMS: React.ReactNode[] = [
  (
    <div key="nova" className="relative h-[560px] overflow-hidden rounded-[24px] border border-white/10 bg-[#111111]">
      <div className="absolute inset-0 bg-cover bg-center" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,90,54,0.22),transparent_25%)]" />
      </div>

      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-[#111111]/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#f7d9cd] backdrop-blur-sm">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5a36]" />
        LIVE
      </div>

      <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-[#111111]/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#f7d9cd] backdrop-blur-sm">
        LIVE
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="rounded-[24px] border border-white/10 bg-[#111111]/80 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-[#ffcfbf]">
            <span>Maison One</span>
            <span>Luxury drop</span>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#c9b7af]">Limited edition</p>
              <h3 className="mt-2 font-grotesk text-[2.6rem] font-black leading-none text-white">NOVA</h3>
            </div>
            <div className="rounded-[18px] border border-[#ff5a36]/20 bg-[#ff5a36] px-3 py-2 text-right text-[#1c0907] shadow-[5px_5px_0_0_rgba(255,90,54,0.25)]">
              <div className="text-[9px] uppercase tracking-[0.18em]">From</div>
              <div className="font-grotesk text-2xl font-black">$249</div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="flex -space-x-2">
              {[
                { name: 'Ava', tone: 'bg-[#ff5a36]' },
                { name: 'Leo', tone: 'bg-[#f4d8b2]' },
                { name: 'Mia', tone: 'bg-[#ffb6a3]' },
                { name: 'Kai', tone: 'bg-[#d9d9d9]' },
              ].map((person) => (
                <span
                  key={person.name}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border border-[#111111] text-[9px] font-black uppercase text-[#1c0907] ${person.tone}`}
                >
                  {person.name.slice(0, 1)}
                </span>
              ))}
            </div>
            <Button size="sm" className="bg-[#ff5a36] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#1c0907]">
              <CirclePlay className="mr-2 h-3.5 w-3.5 fill-current" />
              Join
            </Button>
          </div>
        </div>
      </div>
    </div>
  ),
];

const TopNav = () => (
  <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090909]/80 backdrop-blur-xl">
    <div className="container mx-auto px-4 sm:px-6">
      <div className="flex h-16 items-center justify-between gap-3 sm:h-20">
        <Link href="/" className="shrink-0" aria-label="Vidnov home">
          <Logo className="h-9 w-9 sm:h-11 sm:w-11" />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-6 lg:flex"
        >
          {[
            { label: 'Home', href: '/' },
            { label: 'Explore', href: '/buyer/discovery' },
            { label: 'Businesses', href: '/buyers/businesses' },
            { label: 'Videos', href: '/videos' },
            { label: 'Live Shopping', href: '/live' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs font-medium text-white/70 transition hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <GlobalSearch />
          <div className="flex items-center gap-2">
            <Button
              asChild
              size="sm"
              className="text-xs font-semibold uppercase tracking-[0.1em]"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-[#ff5a36] text-[#150d0b] font-bold hover:bg-[#ff6b49]"
            >
              <Link href="/signup">Join Vidnov</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="border border-white/20 text-white/80 hover:bg-white hover:text-[#111] font-semibold"
            >
              <Link href="/app/seller/create">Become a Seller</Link>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <GlobalSearch className="w-36" />
        </div>
      </div>
    </div>
  </header>
);

/** Global shoppable search. Reuses the existing route/API architecture. */
function Hero() {
  // The hero hero figures are illustrative platform pre-rollout — no per-builder
  // traffic, watch-time or conversion data is shown. Real stats load from live
  // endpoints once the marketplace is verified.
  const HERO_DISCLAIMER = 'Illustrative preview figures';

  const [isLoading, setIsLoading] = useState(true);
  const [liveCount, setLiveCount] = useState(0);

  // The live strip is read from our own origin, server-side — never from the
  // client Firestore SDK, so a visitor with Firebase blocked still sees the
  // real count (or an honest zero).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/home/live', { cache: 'no-store' });
        const payload = (await response.json().catch(() => ({}))) as { rooms?: unknown[] };
        if (cancelled) return;
        setLiveCount(Array.isArray(payload.rooms) ? payload.rooms.length : 0);
      } catch {
        if (!cancelled) setLiveCount(0);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);


  return (
    <section className="relative overflow-hidden bg-[#090909] text-[#f9f5ee]">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,82,54,0.22),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_28%),linear-gradient(180deg,#090909_0%,#101010_100%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-16 lg:pb-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ff5a36]/40 bg-[#111111]/85 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#f9d4c4] shadow-[0_0_25px_rgba(255,90,54,0.15)]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5a36]" />
              Marketplace · Live · Video
            </div>

            <h1 className="mt-6 max-w-xl font-grotesk text-[clamp(3rem,7vw,5.6rem)] font-black leading-[0.92] tracking-[-0.08em] text-white">
              Discover a different way to shop, connect and grow.
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-[#d9d1c6]">
              Find products, discover businesses, watch live demonstrations and
              connect directly with sellers — all in one marketplace.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full bg-[#ff5a36] px-7 text-sm font-bold text-[#150d0b] shadow-[0_12px_30px_rgba(255,90,54,0.35)] transition-all hover:-translate-y-0.5 hover:bg-[#ff6b49]"
              >
                <Link href="/buyer/discovery">
                  Explore Vidnov
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border border-white/15 bg-transparent px-7 text-sm font-bold text-white hover:bg-white hover:text-[#111111]"
              >
                <Link href="/app/seller/create">Start Selling</Link>
              </Button>
            </div>

            {/* Intro film: the asset is configured, never invented. Without a
                URL the poster is shown, so the hero never embeds a broken
                player. */}
            <div className="mt-6 max-w-lg">
              <div className="overflow-hidden rounded-[18px] border border-white/10 bg-[#111111]">
                {INTRO_VIDEO_URL ? (
                  <video
                    src={INTRO_VIDEO_URL}
                    poster={INTRO_POSTER}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-44 w-full object-cover"
                    onError={(event) => {
                      // A dead URL must not leave a black rectangle in the hero.
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <img
                    src={INTRO_POSTER}
                    alt="Vidnov intro film — poster"
                    className="h-44 w-full object-cover opacity-60"
                  />
                )}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                  Intro film
                </p>
                <Link
                  href="/dashboard/seller/video-studio"
                  className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ff8a6a]"
                >
                  Make yours in the video studio
                </Link>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[520px]">
            <div className="absolute -left-4 top-6 h-24 w-24 rounded-full border-[8px] border-[#ff5a36]/40 blur-[2px]" aria-hidden />
            <div className="absolute -right-2 bottom-8 h-28 w-28 rounded-full border-[10px] border-[#ffb5a3]/30" aria-hidden />

            <div className="relative overflow-hidden rounded-[28px] border border-[#ff5a36]/15 bg-[#101010] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.75)]">                                <div className="relative h-[560px] overflow-hidden rounded-[24px] border border-white/10 bg-[#111111]">
                  <div className="absolute inset-0 bg-cover bg-center" aria-hidden>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,90,54,0.22),transparent_25%)]" />
                  </div>

                  <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-[#111111]/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#f7d9cd] backdrop-blur-sm">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5a36]" />
                    LIVE
                  </div>

                  <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-[#111111]/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#f7d9cd] backdrop-blur-sm">
                    LIVE
                  </div>
                  <div className="absolute right-28 top-4 rounded-full border border-[#ff5a36]/30 bg-[#ff5a36]/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-[#ff8a6a] backdrop-blur-sm">
                    Sample
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <div className="rounded-[24px] border border-white/10 bg-[#111111]/80 p-4 backdrop-blur-md">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-[#ffcfbf]">
                        <span>Maison One</span>
                        <span>Luxury drop</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white/60">New</span>
                        <span className="rounded-full border border-[#ff5a36]/30 bg-[#ff5a36]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#ff8a6a]">Sample</span>
                      </div>
                      <p className="mt-2 text-[9px] text-[#6b6258] leading-relaxed">
                        This demo room is a preview — the live floor and real
                        rooms below are separate from the marketplace gallery.
                      </p>
                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[#c9b7af]">Limited edition</p>
                          <h3 className="mt-2 font-grotesk text-[2.6rem] font-black leading-none text-white">NOVA</h3>
                        </div>
                        <div className="rounded-[18px] border border-[#ff5a36]/20 bg-[#ff5a36] px-3 py-2 text-right text-[#1c0907] shadow-[5px_5px_0_0_rgba(255,90,54,0.25)]">
                          <div className="text-[9px] uppercase tracking-[0.18em]">From</div>
                          <div className="font-grotesk text-2xl font-black">$249</div>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <div className="flex -space-x-2">
                          {[
                            { name: 'Ava', tone: 'bg-[#ff5a36]' },
                            { name: 'Leo', tone: 'bg-[#f4d8b2]' },
                            { name: 'Mia', tone: 'bg-[#ffb6a3]' },
                            { name: 'Kai', tone: 'bg-[#d9d9d9]' },
                          ].map((person) => (
                            <span
                              key={person.name}
                              className={`flex h-8 w-8 items-center justify-center rounded-full border border-[#111111] text-[9px] font-black uppercase text-[#1c0907] ${person.tone}`}
                            >
                              {person.name.slice(0, 1)}
                            </span>
                          ))}
                        </div>
                        <Button size="sm" className="bg-[#ff5a36] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#1c0907]">
                          <CirclePlay className="mr-2 h-3.5 w-3.5 fill-current" />
                          {isLoading ? 'Loading live' : liveCount > 0 ? 'Explore the room' : 'Join the live floor'}
                        </Button>
                        <p className="mt-2 text-[9px] text-[#6b6258]">
                          {isLoading
                            ? 'Loading real sessions…'
                            : liveCount > 0
                              ? `See ${liveCount} session${liveCount > 1 ? 's' : ''} live now`
                              : 'Nobody is live right now — the preview room is a sample, not a stream.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { value: '2.8k', label: 'Watching' },
                  { value: '+28%', label: 'Conversion lift' },
                  { value: '9m 42s', label: 'Avg. watch' },
                ].map((item) => (
                  <div key={item.label} className="rounded-[18px] border border-white/10 bg-white/5 p-3">
                    <div className="font-grotesk text-xl font-black leading-none text-white">{item.value}</div>
                    <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-[#d5cdc5]">{item.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {DEMO_ROOMS.map((room) => (
                  <div key={String(room)} className="rounded-[18px] border border-white/10 bg-white/5 p-3">
                    {room}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SearchSection() {
  return (
    <section className="border-t border-white/10 bg-[#0b0b0b]">
      <div className="container mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <GlobalSearch />
        </div>
      </div>
    </section>
  );
}

function CategorySection() {
  return (
    <section className="bg-[#0b0b0b]">
      <div className="container mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <div className="flex items-end gap-3">
            <h2 className="font-grotesk text-3xl font-black tracking-[-0.05em] text-white">
              Shopping categories
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Browse by department.
            </p>
          </div>
          <p className="mt-3 text-sm text-white/50">
            Opening soon. Real catalogue categories load from the existing
            marketplace taxonomy.
          </p>
        </div>
        <div className="mt-8">
          <CategoryGrid categories={(landingCategories as readonly LandingCategory[]).map((c) => c)} />
        </div>
      </div>
    </section>
  );
}

function BusinessSection() {
  const [landingItems, setLandingItems] = useState<typeof landingSellers>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        await new Promise((resolve) => setTimeout(resolve, 400));
        if (cancelled) return;
        setLandingItems(landingSellers);
      } catch {
        if (!cancelled) setHasError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="bg-[#090909]">
      <div className="container mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-end gap-3">
          <h2 className="font-grotesk text-3xl font-black tracking-[-0.05em] text-white">
            Discover businesses around you
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Find businesses, explore their shops and connect with the people
            behind them.
          </p>
        </div>

        {isLoading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-[24px] border border-white/10 bg-white/5 p-3">
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="mt-4 h-5 w-3/4 rounded" />
                <Skeleton className="mt-2 h-4 w-1/2 rounded" />
                <Skeleton className="mt-2 h-3 w-1/4 rounded" />
                <div className="mt-4 flex gap-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-8 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : hasError ? (
          <div className="mt-8 flex flex-col items-center rounded-[24px] border border-dashed border-white/15 bg-white/5 px-6 py-16 text-center">
            <Store className="h-10 w-10 text-white/40" />
            <p className="mt-4 font-grotesk text-lg font-semibold text-white">
              We could not load businesses right now.
            </p>
            <p className="mt-2 max-w-sm text-sm text-white/60">
              After a moment, try again. No businesses are shown until the
              platform verifies them as real registered sellers.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {landingItems.map((business) => (
              <BusinessCard key={business.id} business={business} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ProductSection() {
  const [items, setItems] = useState<typeof landingProducts>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        await new Promise((resolve) => setTimeout(resolve, 400));
        if (cancelled) return;
        setItems(landingProducts);
      } catch {
        if (!cancelled) setHasError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="bg-[#090909]">
      <div className="container mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-end gap-3">
          <h2 className="font-grotesk text-3xl font-black tracking-[-0.05em] text-white">
            Discover products &amp; services
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Real products and services from real sellers.
          </p>
        </div>

        {isLoading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-[20px] border border-white/10 bg-white/5 p-3">
                <Skeleton className="h-36 w-full rounded-xl" />
                <Skeleton className="mt-4 h-5 w-2/3 rounded" />
                <Skeleton className="mt-2 h-4 w-1/3 rounded" />
                <Skeleton className="mt-3 h-3 w-2/3 rounded" />
                <div className="mt-4 flex gap-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-8 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : hasError ? (
          <div className="mt-8 flex flex-col items-center rounded-[24px] border border-dashed border-white/15 bg-white/5 px-6 py-16 text-center">
            <FileCheck className="h-10 w-10 text-white/40" />
            <p className="mt-4 font-grotesk text-lg font-semibold text-white">
              No products currently available.
            </p>
            <p className="mt-2 max-w-sm text-sm text-white/60">
              Businesses publish and update their listings on the marketplace.
              Check back soon.
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-[24px] border border-dashed border-white/15 bg-white/5 px-6 py-16 text-center">
            <FileCheck className="h-10 w-10 text-white/40" />
            <p className="mt-4 font-grotesk text-lg font-semibold text-white">
              Nothing to show yet.
            </p>
            <p className="mt-2 max-w-sm text-sm text-white/60">
              Sellers publish their first listings to see products here.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function VideoSection() {
  const [items, setItems] = useState<typeof landingVideos>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        await new Promise((resolve) => setTimeout(resolve, 400));
        if (cancelled) return;
        setItems(landingVideos);
      } catch {
        if (!cancelled) setHasError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="bg-[#090909]">
      <div className="container mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-end gap-3">
          <h2 className="font-grotesk text-3xl font-black tracking-[-0.05em] text-white">
            Watch. Discover. Shop.
          </h2>
          <p className="mt-1 text-sm text-white/60">
            See products in action and discover businesses through video.
          </p>
        </div>

        {isLoading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="relative overflow-hidden rounded-[20px] border border-white/10 bg-white/5">
                <Skeleton className="h-40 w-full rounded-xl" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <CirclePlay className="h-10 w-10 rounded-full bg-white/20" />
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="mt-2 h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : hasError ? (
          <div className="mt-8 flex flex-col items-center rounded-[24px] border border-dashed border-white/15 bg-white/5 px-6 py-16 text-center">
            <CirclePlay className="h-10 w-10 text-white/40" />
            <p className="mt-4 font-grotesk text-lg font-semibold text-white">
              No videos available right now.
            </p>
            <p className="mt-2 max-w-sm text-sm text-white/60">
              Check back soon for published videos from sellers.
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-[24px] border border-dashed border-white/15 bg-white/5 px-6 py-16 text-center">
            <CirclePlay className="h-10 w-10 text-white/40" />
            <p className="mt-4 font-grotesk text-lg font-semibold text-white">
              No videos published yet.
            </p>
            <p className="mt-2 max-w-sm text-sm text-white/60">
              Sellers record product videos to appear here.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function LiveSection() {
  const [items, setItems] = useState<LandingLiveSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [liveCount, setLiveCount] = useState(0);

  // Real rooms only: `/api/home/live` reads the VPS store first and Firestore
  // second, server-side. An empty answer stays empty and the sample tile below
  // says it is a sample.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const response = await fetch('/api/home/live', { cache: 'no-store' });
        if (!response.ok) throw new Error(String(response.status));
        const payload = (await response.json()) as {
          rooms?: Array<{ id: string; title?: string; sellerId: string; viewerCount?: number }>;
        };
        if (cancelled) return;
        const rooms = Array.isArray(payload.rooms) ? payload.rooms : [];
        setLiveCount(rooms.length);
        setItems(
          rooms.map((room) => ({
            id: room.id,
            title: room.title || 'Live session',
            seller: `${room.viewerCount ?? 0} watching`,
            thumbnail: '/placeholder-image.svg',
          })),
        );
      } catch {
        if (!cancelled) setHasError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="bg-[#0b0b0b]">
      <div className="container mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ff5a36]/30 bg-[#171717] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-[#ffcbba]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff5a36] opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ff5a36]" />
              </span>
              {liveCount > 0 ? `${liveCount} live` : 'Live floor'}
            </div>
            <h2 className="mt-3 font-grotesk text-3xl font-black tracking-[-0.05em] text-white sm:text-4xl">
              Live on Vidnov
            </h2>
          </div>
          <Link
            href="/buyer/discovery"
            className="inline-flex items-center gap-2 text-sm font-bold text-white underline-offset-4 hover:underline"
          >
            Explore the live floor
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-8 flex gap-4 overflow-x-auto pb-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="relative h-[200px] w-[240px] shrink-0 overflow-hidden rounded-[20px] border border-white/10 bg-white/5">
                <Skeleton className="h-full w-full rounded-xl" />
                <div className="absolute left-3 top-3 rounded-full bg-[#ff5a36] px-2 py-1 text-[9px] font-black uppercase text-[#1c0907]">
                  Live
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="mt-2 h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : hasError ? (
          <div className="mt-8 flex flex-col items-center rounded-[24px] border border-dashed border-white/15 bg-white/5 px-6 py-16 text-center">
            <CirclePlay className="h-10 w-10 text-white/40" />
            <p className="mt-4 font-grotesk text-lg font-semibold text-white">
              No businesses are live right now.
            </p>
            <p className="mt-2 max-w-sm text-sm text-white/60">
              Explore shops and discover upcoming sessions.
            </p>
            <Button asChild size="sm" className="mt-6 bg-[#ff5a36] px-5 py-2.5 text-xs font-bold text-[#150d0b] hover:bg-[#ff6b49]">
              <Link href="/buyer/discovery">Explore shops</Link>
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-[300px_1fr] sm:items-start">
            <div className="h-[210px]">
              <DemoRoomCard demo />
            </div>
            <div className="rounded-[24px] border border-dashed border-white/15 bg-white/5 p-6">
              <p className="font-grotesk text-lg font-semibold text-white">
                No businesses are live right now.
              </p>
              <p className="mt-2 max-w-md text-sm text-white/60">
                The tile beside this note is a sample of what a live room looks
                like. Real sessions appear here the moment a verified seller
                goes live — they are never generated for the page.
              </p>
              <Button asChild size="sm" className="mt-6 bg-[#ff5a36] px-5 py-2.5 text-xs font-bold text-[#150d0b] hover:bg-[#ff6b49]">
                <Link href="/buyer/discovery">Explore shops</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-8 flex gap-4 overflow-x-auto pb-2">
            {items.map((session) => (
              <LiveSessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function RequestSection() {
  return (
    <section className="bg-[#090909]">
      <div className="container mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#111111] to-[#0b0b0b] p-8 text-center sm:p-12 lg:p-16">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=1400&q=80')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            aria-hidden
          />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ff5a36]/30 bg-[#ff5a36]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-[#ffcbba]">
              <Send className="h-3.5 w-3.5" />
              Buyer request
            </div>
            <h2 className="mt-6 font-grotesk text-3xl font-black tracking-[-0.05em] text-white sm:text-4xl">
              Can&apos;t find what you need?
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-base leading-relaxed text-[#d9d1c6]">
              Tell businesses what you&apos;re looking for and let relevant
              sellers send you offers — with a photo, a budget and your
              preferred location.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 h-12 rounded-full bg-[#ff5a36] px-8 text-sm font-bold text-[#150d0b] shadow-[0_12px_30px_rgba(255,90,54,0.35)] hover:-translate-y-0.5 hover:bg-[#ff6b49]"
            >
              <Link href="/buyer/requests/new">
                Post a Request
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="mt-4 text-xs text-white/50">
              You will be redirected through the existing login flow if you are
              not already signed in.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SellerSection() {
  return (
    <section className="bg-[#0b0b0b]">
      <div className="container mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ff5a36]/30 bg-[#ff5a36]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-[#ffcbba]">
            <Store className="h-3.5 w-3.5" />
            For sellers
          </div>
          <h2 className="mt-4 font-grotesk text-3xl font-black tracking-[-0.05em] text-white sm:text-4xl">
            Your business deserves to be discovered.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[#d9d1c6]">
            Create your Vidnov shop, showcase your products and services, and
            connect with customers through video and live selling.
          </p>

          <div className="mt-8 flex flex-wrap gap-3 text-xs font-medium text-white/70">
            {[
              'Create a business shop',
              'Publish products and services',
              'Share business videos',
              'Receive genuine customer inquiries',
              'Discover buyer requests',
              'Explore live selling',
            ].map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2"
              >
                <Check className="h-3.5 w-3.5 text-[#ff5a36]" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-full bg-[#ff5a36] px-8 text-sm font-bold text-[#150d0b] shadow-[0_12px_30px_rgba(255,90,54,0.35)] transition-all hover:-translate-y-0.5 hover:bg-[#ff6b49]"
          >
            <Link href="/app/seller/create">
              Create your free seller shop
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 rounded-full border border-white/15 bg-transparent px-8 text-sm font-bold text-white hover:bg-white hover:text-[#111111]"
          >
            <Link href="/how-it-works">Learn how Vidnov works</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function WhySection() {
  return (
    <section className="bg-[#090909]">
      <div className="container mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Store,
              title: 'Discover real businesses',
              text:
                'See the shops and studios behind the products you actually want.',
            },
            {
              icon: Users,
              title: 'Connect directly with sellers',
              text:
                'Message, negotiate and buy from the people behind what you buy.',
            },
            {
              icon: Compass,
              title: 'Explore products, services and videos',
              text:
                'From physical goods to trades and live demos, all in one place.',
            },
            {
              icon: Search,
              title: 'Find what you need through buyer requests',
              text:
                'State exactly what you want and get offers from sellers who understand.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-[24px] border border-white/10 bg-white/5 p-6"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#ff5a36]/10 text-[#ff5a36]">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-grotesk text-xl font-bold text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <LandingFooter />
  );
}

export default function VidnovHomepage() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopNav />
      <main className="flex-1">
        <Hero />
        <SearchSection />
        <CategorySection />
        <BusinessSection />
        <ProductSection />
        <VideoSection />
        <LiveSection />
        <RequestSection />
        <SellerSection />
        <WhySection />
      </main>
      <Footer />
      <div aria-hidden className="h-16 pb-[env(safe-area-inset-bottom)] md:hidden" />
      <LandingBottomNav />
      <SmartInstallPrompt />
    </div>
  );
}
