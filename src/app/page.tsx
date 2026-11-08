import type { ElementType, ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Bookmark,
  Check,
  CirclePlay,
  Globe2,
  HeartHandshake,
  LayoutGrid,
  MapPin,
  Megaphone,
  MessageCircle,
  Play,
  Radio,
  Search,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  Video,
} from 'lucide-react';

import { LandingLayout } from '@/components/layout/landing-layout';
import { Logo } from '@/components/logo';
import { HomeSearch } from '@/components/home/home-search';
import { LiveDiscovery } from '@/components/home/live-discovery';
import { loadLandingFeed, type LandingBusiness, type LandingListing } from '@/lib/home/landing-feed';
import { landingCategories } from '@/lib/home-categories';
import { kenyaLocations } from '@/lib/location-data';
import { publicOrigin } from '@/lib/site-url';
import { serializeJsonLd } from '@/lib/seo/json-ld';

/**
 * VIDNOV HOMEPAGE — the public marketplace front door.
 *
 * Server-rendered: the hero, business grid and listing grid are real HTML for
 * crawlers and for the first paint. Only the search box and the live strip are
 * client components.
 *
 * ## Honesty rules for this page
 *
 * - Real businesses, products and live rooms come from `loadLandingFeed()` and
 *   `/api/home/live` (PocketBase first, Firestore second).
 * - Where there are not enough real records to show the layout, the section
 *   fills with cards labelled **Design Preview**. Those cards carry no seller
 *   identity, no price and no claim of activity.
 * - Nothing here states a guarantee: search indexing, social reach and live
 *   audiences are described as opportunities, never results.
 */

export const revalidate = 300;

const TITLE = 'Vidnov — Discover. Connect. Grow.';
const DESCRIPTION =
  'Discover businesses, explore products and services, watch live shopping, connect with creators and reach new customers. Vidnov brings businesses and people together.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${publicOrigin()}/` },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${publicOrigin()}/`,
    siteName: 'Vidnov',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'Vidnov' }],
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/icons/icon-512.png'],
  },
};

/** WebSite + SearchAction. Organization is emitted once by the root layout. */
function websiteJsonLd(): string {
  const origin = publicOrigin();
  return serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Vidnov',
    alternateName: 'Vidnov Marketplace',
    url: origin,
    description: DESCRIPTION,
    inLanguage: 'en',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${origin}/discover?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  });
}

/* ── demo imagery ────────────────────────────────────────────────────────────
 * Stock photography used to show the layout. Every card that uses it is marked
 * "Design Preview" — none of it depicts, or claims to depict, a Vidnov seller.
 * All URLs were checked to answer 200; they render through Unsplash's CDN with
 * explicit sizes so the page stays light.
 */
const photo = (id: string, width = 800) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=75`;

const PHOTOS = {
  heroShop: photo('photo-1483985988355-763728e1935b', 1000),
  heroProduct: photo('photo-1505740420928-5e560c06d30e', 600),
  fashion: photo('photo-1441986300917-64674bd600d8', 700),
  boutique: photo('photo-1441984904996-e0b6ba687e04', 700),
  beauty: photo('photo-1596462502278-27bfdc403348', 700),
  skincare: photo('photo-1571781926291-c477ebfd024b', 700),
  boutiqueCare: photo('photo-1526947425960-945c6e72858f', 700),
  phone: photo('photo-1556656793-08538906a9f8', 500),
  sneaker: photo('photo-1542291026-7eec264c27ff', 700),
  watch: photo('photo-1523275335684-37898b6baf30', 700),
  headphones: photo('photo-1505740420928-5e560c06d30e', 700),
  creator: photo('photo-1573497019940-1c28c88b4f3e', 700),
  team: photo('photo-1521737604893-d14cc237f11d', 700),
  workspace: photo('photo-1516321318423-f06f85e504b3', 700),
} as const;

/** Fills the demo cards below; never written to the database. */
const DEMO_SHOPS = [
  {
    id: 'preview-fashion',
    name: 'Fashion & apparel shop',
    category: 'Fashion & Apparel',
    location: 'Nairobi, Kenya',
    description: 'A shop layout preview — cover image, logo, category and location.',
    image: PHOTOS.fashion,
  },
  {
    id: 'preview-beauty',
    name: 'Beauty & lifestyle shop',
    category: 'Beauty & Personal Care',
    location: 'Accra, Ghana',
    description: 'Preview of how a personal-care storefront could look on Vidnov.',
    image: PHOTOS.beauty,
  },
  {
    id: 'preview-electronics',
    name: 'Electronics shop',
    category: 'Electronics & Gadgets',
    location: 'Kigali, Rwanda',
    description: 'Preview of a gadget store with products and service listings.',
    image: PHOTOS.workspace,
  },
  {
    id: 'preview-home',
    name: 'Home & living shop',
    category: 'Home & Living',
    location: 'Cape Town, South Africa',
    description: 'Preview of a homeware storefront using the same card layout.',
    image: PHOTOS.boutique,
  },
] as const;

const DEMO_PRODUCTS = [
  { id: 'preview-headphones', name: 'Studio headphones', category: 'Electronics & Gadgets', image: PHOTOS.headphones },
  { id: 'preview-watch', name: 'Leather strap watch', category: 'Fashion & Apparel', image: PHOTOS.watch },
  { id: 'preview-sneaker', name: 'Everyday sneakers', category: 'Fashion & Apparel', image: PHOTOS.sneaker },
  { id: 'preview-skincare', name: 'Skincare set', category: 'Beauty & Personal Care', image: PHOTOS.skincare },
] as const;

const DEMO_LIVE = [
  {
    id: 'preview-live-fashion',
    title: 'Fashion drop walkthrough',
    topic: 'Fashion',
    image: PHOTOS.boutique,
  },
  {
    id: 'preview-live-tech',
    title: 'Gadget demonstration',
    topic: 'Electronics',
    image: PHOTOS.workspace,
  },
  {
    id: 'preview-live-beauty',
    title: 'Skincare routine demo',
    topic: 'Beauty',
    image: PHOTOS.boutiqueCare,
  },
  {
    id: 'preview-live-phone',
    title: 'Seller answering buyers',
    topic: 'Q&A',
    image: PHOTOS.phone,
  },
] as const;

const DEMO_VIDEOS = [
  { id: 'preview-video-1', title: 'Product demonstration', tag: 'Demo', image: PHOTOS.headphones },
  { id: 'preview-video-2', title: 'Shop story', tag: 'Demo', image: PHOTOS.boutique },
  { id: 'preview-video-3', title: 'How it is made', tag: 'Demo', image: PHOTOS.skincare },
  { id: 'preview-video-4', title: 'Creator introduction', tag: 'Demo', image: PHOTOS.creator },
  { id: 'preview-video-5', title: 'Behind the counter', tag: 'Demo', image: PHOTOS.fashion },
] as const;

/* ── shared pieces ───────────────────────────────────────────────────────── */

function Eyebrow({ children, tone = 'light' }: { children: ReactNode; tone?: 'light' | 'dark' }) {
  return (
    <span
      className={
        tone === 'dark'
          ? 'inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.26em] text-white/60'
          : 'inline-flex items-center gap-2 rounded-full border border-[#FF4D2E]/25 bg-[#FF4D2E]/8 px-3 py-1 text-[10px] font-black uppercase tracking-[0.26em] text-[#C5351B]'
      }
    >
      {children}
    </span>
  );
}

function DemoBadge({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <span
      className={
        tone === 'dark'
          ? 'rounded-full bg-black/70 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white/80 ring-1 ring-white/15 backdrop-blur'
          : 'rounded-full bg-white/95 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#0B0B0C] shadow-sm'
      }
    >
      Design Preview
    </span>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description,
  tone = 'light',
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  tone?: 'light' | 'dark';
  action?: { label: string; href: string };
}) {
  const dark = tone === 'dark';
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
        <h2
          className={`mt-4 text-balance font-grotesk text-[clamp(1.9rem,4vw,2.9rem)] font-black leading-[1.05] tracking-[-0.035em] ${
            dark ? 'text-white' : 'text-[#0B0B0C]'
          }`}
        >
          {title}
        </h2>
        <p
          className={`mt-3 max-w-xl text-pretty text-sm leading-relaxed sm:text-base ${
            dark ? 'text-white/60' : 'text-[#57524B]'
          }`}
        >
          {description}
        </p>
      </div>
      {action ? (
        <Link
          href={action.href}
          className={`inline-flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] transition-colors ${
            dark ? 'text-white/60 hover:text-white' : 'text-[#0B0B0C]/60 hover:text-[#0B0B0C]'
          }`}
        >
          {action.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

function Monogram({ name, size = 'md' }: { name: string; size?: 'md' | 'sm' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div
      className={`flex items-center justify-center bg-[#0B0B0C] font-grotesk font-black tracking-tight text-white/85 ${
        size === 'sm' ? 'h-10 w-10 rounded-xl text-sm' : 'h-full w-full text-2xl'
      }`}
      aria-hidden
    >
      {initials || 'V'}
    </div>
  );
}

/* ── hero ────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#08080A]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_15%_0%,rgba(255,77,46,0.22),transparent_62%),radial-gradient(45%_45%_at_95%_15%,rgba(255,77,46,0.12),transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(70%_60%_at_50%_20%,black,transparent)]"
      />

      <div className="relative mx-auto w-full max-w-7xl px-5 pb-14 pt-10 sm:px-8 sm:pt-14 lg:pb-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <Eyebrow tone="dark">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF4D2E]" />
              Marketplace · Live shopping · Social commerce
            </Eyebrow>

            <h1 className="mt-6 text-balance font-grotesk text-[clamp(2.9rem,6.8vw,5.2rem)] font-black leading-[0.93] tracking-[-0.05em] text-white">
              Discover.
              <br />
              Connect. <span className="text-[#FF4D2E]">Grow.</span>
            </h1>

            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/65 sm:text-lg">
              Discover businesses, explore products and services, watch live
              shopping, connect with creators and reach new customers. Vidnov
              brings businesses and people together.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/discover?kind=businesses"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#FF4D2E] px-6 text-sm font-bold text-white shadow-[0_16px_40px_rgba(255,77,46,0.30)] transition-all hover:-translate-y-0.5 hover:bg-[#e63f21]"
              >
                Explore Businesses
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/app/seller/create"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 px-6 text-sm font-bold text-white transition-colors hover:border-white/50 hover:bg-white/5"
              >
                Start Selling
              </Link>
              <Link
                href="/live"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-6 text-sm font-bold text-white/85 transition-colors hover:border-[#FF4D2E]/60 hover:text-white"
              >
                <CirclePlay className="h-4 w-4 text-[#FF4D2E]" aria-hidden />
                Watch Live
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-white/50">
              {[
                { label: 'Products', href: '/discover?kind=listings', icon: ShoppingBag },
                { label: 'Services', href: '/categories?type=services', icon: Sparkles },
                { label: 'Videos', href: '/buyer/discovery', icon: Play },
                { label: 'Live shopping', href: '/live', icon: CirclePlay },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group inline-flex items-center gap-2 transition-colors hover:text-white"
                >
                  <item.icon className="h-3.5 w-3.5 text-[#FF4D2E]" aria-hidden />
                  <span className="font-medium">{item.label}</span>
                  <span className="h-px w-0 bg-white transition-all duration-300 group-hover:w-5" aria-hidden />
                </Link>
              ))}
            </div>
          </div>

          {/* Cinematic composition: shop photography + a phone showing a live
              demo. Every element is a layout preview, and it says so. */}
          <div className="relative mx-auto w-full max-w-[520px] lg:max-w-none">
            <div
              aria-hidden
              className="absolute -right-5 -top-6 h-24 w-24 rounded-full border-[10px] border-[#FF4D2E]/25"
            />
            <div
              aria-hidden
              className="absolute -bottom-8 -left-6 h-20 w-20 rounded-full border-[8px] border-white/10"
            />

            <figure className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#101013] shadow-[0_40px_100px_rgba(0,0,0,0.65)]">
              <img
                src={PHOTOS.heroShop}
                alt="Design preview of a Vidnov shop cover"
                width={1000}
                height={1150}
                fetchPriority="high"
                decoding="async"
                className="h-[360px] w-full object-cover sm:h-[440px]"
              />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#08080A] via-[#08080A]/25 to-transparent" />

              <span className="absolute left-4 top-4">
                <DemoBadge tone="dark" />
              </span>
              <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[#FF4D2E] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white">
                <Radio className="h-3 w-3" aria-hidden />
                Live demo
              </span>

              <figcaption className="absolute inset-x-4 bottom-4 rounded-[20px] border border-white/12 bg-[#0b0b0d]/85 p-4 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <Monogram name="Fashion shop" size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-grotesk text-sm font-bold text-white">
                      Fashion &amp; apparel shop
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-white/50">
                      Shop layout preview · cover, logo, catalogue
                    </p>
                  </div>
                  <span className="ml-auto hidden shrink-0 rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#0B0B0C] sm:inline-flex">
                    View shop
                  </span>
                </div>
              </figcaption>
            </figure>

            <div className="absolute -bottom-6 -left-2 w-[142px] rounded-[24px] border-[5px] border-[#0B0B0D] bg-[#0B0B0D] shadow-[0_24px_60px_rgba(0,0,0,0.7)] sm:-left-6 sm:w-[162px]">
              <div className="relative overflow-hidden rounded-[19px]">
                <img
                  src={PHOTOS.heroProduct}
                  alt="Design preview of a product shown in a live demonstration"
                  width={600}
                  height={720}
                  loading="eager"
                  decoding="async"
                  className="h-[188px] w-full object-cover sm:h-[210px]"
                />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                <span className="absolute left-2 top-2 rounded-full bg-[#FF4D2E] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-white">
                  Live
                </span>
                <CirclePlay className="absolute right-2 top-2 h-4 w-4 text-white/80" aria-hidden />
                <div className="absolute inset-x-2 bottom-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/60">Demo preview</p>
                  <p className="mt-0.5 line-clamp-2 font-grotesk text-xs font-bold leading-snug text-white">
                    Studio headphones
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute -right-1 bottom-24 hidden rounded-2xl border border-white/12 bg-[#0b0b0d]/90 px-4 py-3 backdrop-blur sm:block">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FF8A76]">Watching on a phone</p>
              <p className="mt-1 text-[11px] text-white/55">Sample layout, not a real broadcast</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── sections ────────────────────────────────────────────────────────────── */

function SearchSection() {
  return (
    <section className="border-y border-white/8 bg-[#0B0B0D]">
      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="text-center">
          <h2 className="font-grotesk text-xl font-black tracking-[-0.02em] text-white sm:text-2xl">
            What are you looking for today?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/50">
            One search across businesses, products, services, categories and
            locations.
          </p>
        </div>
        <div className="mt-6">
          <HomeSearch variant="dark" />
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {[
            { label: 'Businesses', href: '/discover?kind=businesses' },
            { label: 'Products', href: '/discover?kind=listings' },
            { label: 'Services', href: '/categories?type=services' },
            { label: 'Live shopping', href: '/live' },
          ].map((chip) => (
            <Link
              key={chip.href}
              href={chip.href}
              className="rounded-full border border-white/12 px-3.5 py-1.5 text-[11px] font-medium text-white/60 transition-colors hover:border-white/35 hover:text-white"
            >
              {chip.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoryStrip() {
  return (
    <section className="bg-[#FAF8F5]">
      <div className="mx-auto w-full max-w-7xl px-5 pb-2 pt-12 sm:px-8">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-grotesk text-lg font-black tracking-[-0.02em] text-[#0B0B0C] sm:text-xl">
            Browse by category
          </h2>
          <Link
            href="/discovery"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#0B0B0C]/55 transition-colors hover:text-[#0B0B0C]"
          >
            All categories
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="mt-5 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {landingCategories.slice(0, 9).map((category) => (
            <Link
              key={category.label}
              href={`/discover?category=${encodeURIComponent(category.label)}`}
              className="shrink-0 snap-start rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium text-[#0B0B0C]/75 transition-colors hover:border-[#FF4D2E] hover:text-[#C5351B]"
            >
              {category.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function RealBusinessTile({ business }: { business: LandingBusiness }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-black/8 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#FF4D2E]/35 hover:shadow-[0_24px_60px_rgba(11,11,12,0.10)]">
      <Link href={business.href} className="relative block h-36 overflow-hidden bg-[#F0ECE5]">
        {business.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- seller media can be any configured host
          <img
            src={business.imageUrl}
            alt={business.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <Monogram name={business.name} />
        )}
        {business.verified ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#0B0B0C] shadow-sm">
            <BadgeCheck className="h-3 w-3 text-[#FF4D2E]" />
            Verified
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="min-w-0 font-grotesk text-base font-bold leading-snug text-[#0B0B0C]">
          <Link href={business.href} className="line-clamp-2 hover:text-[#C5351B]">
            {business.name}
          </Link>
        </h3>
        {business.category ? (
          <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#C5351B]">
            {business.category}
          </p>
        ) : null}
        {business.description ? (
          <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-[#57524B]">
            {business.description}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-[#8A837A]">
            <MapPin className="h-3 w-3 shrink-0 text-[#C5351B]" aria-hidden />
            <span className="truncate">{business.location || 'Location not listed'}</span>
          </span>
          <Link
            href={business.href}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#0B0B0C] px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#FF4D2E]"
          >
            View shop
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function DemoShopTile({ shop }: { shop: (typeof DEMO_SHOPS)[number] }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-dashed border-black/20 bg-white/70">
      <div className="relative h-36 overflow-hidden bg-[#F0ECE5]">
        <img
          src={shop.image}
          alt={`Design preview of a ${shop.category} shop cover`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover opacity-95"
        />
        <span className="absolute left-3 top-3">
          <DemoBadge />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-grotesk text-base font-bold leading-snug text-[#0B0B0C]">{shop.name}</h3>
        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#C5351B]">
          {shop.category}
        </p>
        <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-[#57524B]">{shop.description}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-[#8A837A]">
            <MapPin className="h-3 w-3 shrink-0 text-[#C5351B]" aria-hidden />
            <span className="truncate">{shop.location}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-black/15 px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#0B0B0C]/60">
            View shop
          </span>
        </div>
      </div>
    </article>
  );
}

function BusinessesSection({ businesses, reachable }: { businesses: LandingBusiness[]; reachable: boolean }) {
  const counties = Object.keys(kenyaLocations).slice(0, 3);
  const filters = [
    { label: 'All businesses', href: '/discover?kind=businesses' },
    { label: 'Available now', href: '/discover?kind=businesses&availability=available' },
    { label: 'Products', href: '/discover?kind=listings' },
    { label: 'Services', href: '/categories?type=services' },
    ...counties.map((county) => ({
      label: county,
      href: `/discover?kind=businesses&location=${encodeURIComponent(county)}`,
    })),
  ];
  const demoFill = DEMO_SHOPS.slice(0, Math.max(0, 4 - businesses.length));

  return (
    <section className="bg-[#FAF8F5] pb-16 pt-12 sm:pb-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionIntro
          eyebrow="Local & global"
          title="Discover Businesses Around You"
          description="Find businesses, explore their shops and connect directly. Real shops appear first; layout previews are labelled."
          action={{ label: 'Open discovery', href: '/discover?kind=businesses' }}
        />

        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Discovery filters">
          {filters.map((filter) => (
            <Link
              key={filter.href}
              href={filter.href}
              className="rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-[11px] font-medium text-[#57524B] transition-colors hover:border-[#FF4D2E] hover:text-[#C5351B]"
            >
              {filter.label}
            </Link>
          ))}
        </div>

        {businesses.length > 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {businesses.map((business) => (
              <RealBusinessTile key={business.id} business={business} />
            ))}
            {demoFill.map((shop) => (
              <DemoShopTile key={shop.id} shop={shop} />
            ))}
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {DEMO_SHOPS.map((shop) => (
                <DemoShopTile key={shop.id} shop={shop} />
              ))}
            </div>
            <p className="mt-4 text-xs text-[#8A837A]">
              {reachable
                ? 'These cards are layout previews. The first registered businesses to publish a complete public profile appear here instead.'
                : 'The business feed could not be reached, so only layout previews are shown. Discovery and search still work.'}
            </p>
            <div className="mt-5">
              <Link
                href="/app/seller/create"
                className="inline-flex items-center gap-2 rounded-full bg-[#0B0B0C] px-6 py-3 text-xs font-bold text-white transition-colors hover:bg-[#FF4D2E]"
              >
                Register your business
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function RealListingTile({ listing }: { listing: LandingListing }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-black/8 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#FF4D2E]/35 hover:shadow-[0_24px_60px_rgba(11,11,12,0.10)]">
      <Link href={listing.href} className="relative block h-44 overflow-hidden bg-[#F0ECE5]">
        {listing.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- seller media can be any configured host
          <img
            src={listing.imageUrl}
            alt={listing.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <Monogram name={listing.name} />
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/95 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#0B0B0C]">
            {listing.kind === 'service' ? 'Service' : 'Product'}
          </span>
          {listing.sponsored ? (
            <span className="rounded-full bg-[#0B0B0C]/90 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white">
              Sponsored
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        {listing.category ? (
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#C5351B]">
            {listing.category}
          </p>
        ) : null}
        <h3 className="mt-1.5 font-grotesk text-base font-bold leading-snug text-[#0B0B0C]">
          <Link href={listing.href} className="line-clamp-2 hover:text-[#C5351B]">
            {listing.name}
          </Link>
        </h3>
        {listing.priceLabel ? (
          <p className="mt-2 font-grotesk text-lg font-black text-[#0B0B0C]">{listing.priceLabel}</p>
        ) : null}

        <p className="mt-3 flex min-w-0 items-center gap-1.5 text-[11px] text-[#8A837A]">
          <Store className="h-3 w-3 shrink-0 text-[#C5351B]" aria-hidden />
          <span className="truncate">{listing.sellerName || 'Vidnov seller'}</span>
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
          <Link
            href={listing.href}
            className="inline-flex items-center gap-1 rounded-full bg-[#0B0B0C] px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#FF4D2E]"
          >
            View {listing.kind === 'service' ? 'service' : 'product'}
          </Link>
          <Link
            href="/messages"
            aria-label={`Ask the seller about ${listing.name}`}
            className="inline-flex items-center gap-1 rounded-full border border-black/12 px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#0B0B0C] transition-colors hover:border-[#FF4D2E] hover:text-[#C5351B]"
          >
            <MessageCircle className="h-3 w-3" aria-hidden />
            Ask
          </Link>
          <Link
            href="/buyer/wishlist"
            aria-label={`Save ${listing.name}`}
            className="inline-flex items-center gap-1 rounded-full border border-black/12 px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#0B0B0C] transition-colors hover:border-[#FF4D2E] hover:text-[#C5351B]"
          >
            <Bookmark className="h-3 w-3" aria-hidden />
            Save
          </Link>
        </div>
      </div>
    </article>
  );
}

function DemoListingTile({ product }: { product: (typeof DEMO_PRODUCTS)[number] }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-dashed border-black/20 bg-white/70">
      <div className="relative h-44 overflow-hidden bg-[#F0ECE5]">
        <img
          src={product.image}
          alt={`Design preview of a ${product.name.toLowerCase()} product card`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover opacity-95"
        />
        <span className="absolute left-3 top-3">
          <DemoBadge />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#C5351B]">
          {product.category}
        </p>
        <h3 className="mt-1.5 font-grotesk text-base font-bold leading-snug text-[#0B0B0C]">
          {product.name}
        </h3>
        <p className="mt-2 inline-flex w-fit rounded-full bg-black/5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#57524B]">
          Demo price
        </p>
        <p className="mt-3 flex min-w-0 items-center gap-1.5 text-[11px] text-[#8A837A]">
          <Store className="h-3 w-3 shrink-0 text-[#C5351B]" aria-hidden />
          <span className="truncate">Sample shop (preview)</span>
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
          <Link
            href="/discover?kind=listings"
            className="inline-flex items-center gap-1 rounded-full bg-[#0B0B0C] px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#FF4D2E]"
          >
            View product
          </Link>
          <Link
            href="/messages"
            aria-label="Ask a seller a question"
            className="inline-flex items-center gap-1 rounded-full border border-black/12 px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#0B0B0C] transition-colors hover:border-[#FF4D2E] hover:text-[#C5351B]"
          >
            <MessageCircle className="h-3 w-3" aria-hidden />
            Ask
          </Link>
          <Link
            href="/buyer/wishlist"
            aria-label="Save this layout preview"
            className="inline-flex items-center gap-1 rounded-full border border-black/12 px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#0B0B0C] transition-colors hover:border-[#FF4D2E] hover:text-[#C5351B]"
          >
            <Bookmark className="h-3 w-3" aria-hidden />
            Save
          </Link>
        </div>
      </div>
    </article>
  );
}

function ListingsSection({ listings, reachable }: { listings: LandingListing[]; reachable: boolean }) {
  const demoFill = DEMO_PRODUCTS.slice(0, Math.max(0, 4 - listings.length));

  return (
    <section className="bg-white pb-16 pt-16 sm:pb-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionIntro
          eyebrow="Products & services"
          title="Shop Products. Discover Services."
          description="Real listings from real sellers — and clearly labelled previews that show how the marketplace will look."
          action={{ label: 'See all products', href: '/discover?kind=listings' }}
        />

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing) => (
            <RealListingTile key={listing.id} listing={listing} />
          ))}
          {demoFill.map((product) => (
            <DemoListingTile key={product.id} product={product} />
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-[11px] text-[#8A837A]">
            <Megaphone className="h-3.5 w-3.5 text-[#C5351B]" aria-hidden />
            Sponsored placements are always labelled. Paid placement never changes
            organic ranking.
          </p>
          {listings.length === 0 ? (
            <p className="text-[11px] text-[#8A837A]">
              {reachable
                ? 'No published listings yet — previews are shown above.'
                : 'Listing feed unavailable right now — previews are shown above.'}
            </p>
          ) : null}
        </div>

        <div className="mt-5">
          <Link
            href="/discover?kind=listings"
            className="inline-flex items-center gap-2 rounded-full bg-[#0B0B0C] px-6 py-3 text-xs font-bold text-white transition-colors hover:bg-[#FF4D2E]"
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
            See all products and services
          </Link>
        </div>
      </div>
    </section>
  );
}

function LiveSection() {
  return (
    <section className="relative overflow-hidden bg-[#08080A] py-16 sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_12%_0%,rgba(255,77,46,0.16),transparent_60%)]"
      />
      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionIntro
          tone="dark"
          eyebrow="Live shopping"
          title="People Selling Live."
          description="Watch sellers demonstrate products, answer questions and run drops in real time — on desktop and on a phone."
          action={{ label: 'Open live shopping', href: '/live' }}
        />

        <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {DEMO_LIVE.map((room) => (
            <article
              key={room.id}
              className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-[#101013]"
            >
              <div className="relative h-56 overflow-hidden">
                <img
                  src={room.image}
                  alt={`Design preview: ${room.title.toLowerCase()}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
                />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#08080A] via-[#08080A]/20 to-transparent" />
                <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF4D2E] px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    Live
                  </span>
                  <DemoBadge tone="dark" />
                </div>
                <div className="absolute inset-x-3 bottom-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#FFB9A8]">
                    {room.topic}
                  </p>
                  <p className="mt-1 font-grotesk text-base font-bold leading-snug text-white">
                    {room.title}
                  </p>
                  <p className="mt-1 text-[10px] text-white/45">
                    Sample preview — not a real broadcast
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
                <Link
                  href="/live"
                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/80 transition-colors hover:text-white"
                >
                  <CirclePlay className="h-3.5 w-3.5 text-[#FF4D2E]" aria-hidden />
                  Watch live
                </Link>
                <Link
                  href="/discover?kind=businesses"
                  className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/50 transition-colors hover:text-white"
                >
                  View shop
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10">
          <LiveDiscovery />
        </div>
      </div>
    </section>
  );
}

function VideoSection() {
  return (
    <section className="bg-[#0B0B0D] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionIntro
          tone="dark"
          eyebrow="Video & creators"
          title="Watch. Discover. Shop."
          description="Product demonstrations, business stories, educational clips and seller introductions — built for vertical video."
          action={{ label: 'Open video discovery', href: '/buyer/discovery' }}
        />

        <div className="mt-9 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {DEMO_VIDEOS.map((video) => (
            <Link
              key={video.id}
              href="/buyer/discovery"
              className="group relative w-[62%] shrink-0 snap-start overflow-hidden rounded-[22px] border border-white/10 bg-[#101013] sm:w-[240px]"
            >
              <div className="relative h-[300px] overflow-hidden sm:h-[360px]">
                <img
                  src={video.image}
                  alt={`Design preview: ${video.title.toLowerCase()}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
                />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />
                <span className="absolute left-3 top-3">
                  <DemoBadge tone="dark" />
                </span>
                <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                  <Play className="h-3.5 w-3.5 fill-white text-white" aria-hidden />
                </span>
                <div className="absolute inset-x-3 bottom-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#FFB9A8]">
                    {video.tag} layout
                  </p>
                  <p className="mt-1 font-grotesk text-sm font-bold leading-snug text-white">
                    {video.title}
                  </p>
                  <p className="mt-1 text-[10px] text-white/45">Sample imagery</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-4 text-[11px] text-white/40">
          Published seller videos replace these previews in the discovery feed.
        </p>
      </div>
    </section>
  );
}

function DistributionSection() {
  const flow = [
    'Seller publishes a product',
    'Vidnov product page',
    'Distribution opportunities',
    'More discovery',
    'Customer visits',
    'Genuine inquiries',
  ];

  const channels = [
    {
      name: 'Google Search',
      status: 'Available',
      icon: Globe2,
      body: 'Public shop and product pages, descriptive metadata, structured data and sitemap coverage.',
      note: 'Indexing and ranking are decided by Google.',
    },
    { name: 'TikTok', status: 'Connect', icon: CirclePlay, body: 'Publish where the Content Posting permission is granted; otherwise a Share-to-TikTok handoff.', note: 'Requires TikTok app approval and a connected account.' },
    { name: 'Facebook', status: 'Connect', icon: Share2, body: 'Prepare posts and publish to a connected Page where permissions allow.', note: 'Requires an authorised Page and granted permissions.' },
    { name: 'Instagram', status: 'Connect', icon: Share2, body: 'Adapt a product post for a connected Instagram business account.', note: 'Requires a business account and granted permissions.' },
    { name: 'Telegram · Bluesky · Mastodon · Discord · Tumblr', status: 'Connect', icon: Megaphone, body: 'Additional destinations the Social Engine already supports for approved promotional posts.', note: 'Each destination needs its own authorisation.' },
  ];

  return (
    <section className="bg-[#F1EDE6] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Eyebrow>Vidnov distribution engine</Eyebrow>
          <h2 className="mt-4 text-balance font-grotesk text-[clamp(1.9rem,4vw,2.9rem)] font-black leading-[1.05] tracking-[-0.035em] text-[#0B0B0C]">
            One Product. More Places to Be Discovered.
          </h2>
          <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-[#57524B] sm:text-base">
            Your Vidnov shop is your online home. Vidnov&apos;s distribution system
            is designed to help eligible products and business content reach more
            people through search engines and connected social platforms.
          </p>
        </div>

        <ol className="mt-9 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {flow.map((step, index) => (
            <li
              key={step}
              className="relative rounded-2xl border border-black/8 bg-white px-4 py-4"
            >
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C5351B]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p className="mt-2 text-xs font-semibold leading-snug text-[#0B0B0C]">{step}</p>
              {index < flow.length - 1 ? (
                <ArrowRight
                  aria-hidden
                  className="absolute -right-2 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-[#0B0B0C]/25 lg:block"
                />
              ) : null}
            </li>
          ))}
        </ol>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {channels.map((channel) => (
            <article
              key={channel.name}
              className="flex h-full flex-col rounded-[24px] border border-black/8 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0B0B0C] text-[#FF4D2E]">
                  <channel.icon className="h-5 w-5" aria-hidden />
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${
                    channel.status === 'Available'
                      ? 'bg-[#0B0B0C] text-white'
                      : 'border border-black/15 text-[#57524B]'
                  }`}
                >
                  {channel.status}
                </span>
              </div>
              <h3 className="mt-4 font-grotesk text-base font-bold leading-snug text-[#0B0B0C]">
                {channel.name}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#57524B]">{channel.body}</p>
              <p className="mt-auto pt-4 text-[10px] leading-relaxed text-[#8A837A]">{channel.note}</p>
            </article>
          ))}

          <article className="flex h-full flex-col rounded-[24px] border border-dashed border-black/20 bg-white/60 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0B0B0C]/80 text-[#FF4D2E]">
                <Sparkles className="h-5 w-5" aria-hidden />
              </div>
              <span className="rounded-full border border-black/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#57524B]">
                Planned
              </span>
            </div>
            <h3 className="mt-4 font-grotesk text-base font-bold leading-snug text-[#0B0B0C]">
              Smart product promotion
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#57524B]">
              Recommendations on which products may benefit from promotion, which
              content format fits, and which channels bring genuine inquiries.
            </p>
            <p className="mt-auto pt-4 text-[10px] leading-relaxed text-[#8A837A]">
              Planned. Publishing today runs through the Social Engine, not an
              automatic promotion planner.
            </p>
          </article>
        </div>

        <p className="mt-6 max-w-3xl text-[11px] leading-relaxed text-[#8A837A]">
          Distribution respects each platform&apos;s API permissions, your
          authorisation and its publishing rules. Nothing is posted automatically
          without a connected account, and no reach, ranking or sale is guaranteed.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/app/seller/create"
            className="inline-flex items-center gap-2 rounded-full bg-[#FF4D2E] px-6 py-3 text-xs font-bold text-white transition-colors hover:bg-[#e63f21]"
          >
            Create your shop
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/dashboard/seller/social-reach"
            className="inline-flex items-center gap-2 rounded-full border border-black/15 px-6 py-3 text-xs font-bold text-[#0B0B0C] transition-colors hover:border-black/40"
          >
            Manage connected accounts
          </Link>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const paths = [
    {
      icon: ShoppingBag,
      label: 'For customers',
      title: 'Find it, watch it, ask about it',
      points: ['Discover products and businesses', 'Watch live demonstrations', 'Contact sellers directly', 'Send an inquiry or request'],
      href: '/discovery',
      cta: 'Start discovering',
      image: PHOTOS.phone,
    },
    {
      icon: Store,
      label: 'For sellers',
      title: 'Open a shop and sell',
      points: ['Create a public shop', 'Upload products and services', 'Go live and share content', 'Reach potential customers'],
      href: '/app/seller/create',
      cta: 'Create your shop',
      image: PHOTOS.team,
    },
    {
      icon: Video,
      label: 'For creators',
      title: 'Make content that earns attention',
      points: ['Create useful content', 'Work with businesses', 'Explore earning opportunities', 'Grow an audience on Vidnov'],
      href: '/ai-studio',
      cta: 'Open the studio',
      image: PHOTOS.creator,
    },
  ];

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionIntro
          eyebrow="How Vidnov works"
          title="Three Ways In. One Platform."
          description="Customers find what they need, sellers reach them, and creators make the content that connects both."
        />

        <div className="mt-9 grid gap-5 lg:grid-cols-3">
          {paths.map((path) => (
            <article
              key={path.label}
              className="group flex h-full flex-col overflow-hidden rounded-[26px] border border-black/8 bg-[#FAF8F5] transition-colors hover:border-[#FF4D2E]/35"
            >
              <div className="relative h-44 overflow-hidden">
                <img
                  src={path.image}
                  alt={`Design preview for ${path.label.toLowerCase()}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0B0B0C]/70 to-transparent" />
                <span className="absolute left-4 top-4">
                  <DemoBadge tone="dark" />
                </span>
                <span className="absolute bottom-3 left-4 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                  <path.icon className="h-3.5 w-3.5 text-[#FF4D2E]" aria-hidden />
                  {path.label}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-grotesk text-xl font-bold tracking-[-0.02em] text-[#0B0B0C]">
                  {path.title}
                </h3>
                <ul className="mt-4 space-y-2">
                  {path.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-xs text-[#57524B]">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C5351B]" aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>
                <Link
                  href={path.href}
                  className="mt-auto inline-flex items-center gap-1.5 pt-6 text-[11px] font-black uppercase tracking-[0.14em] text-[#0B0B0C] transition-colors hover:text-[#C5351B]"
                >
                  {path.cta}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhySection() {
  const features = [
    { icon: Store, title: 'Online business shops', body: 'A public shop page with branding and catalogue.' },
    { icon: Search, title: 'Product & service discovery', body: 'One search across every eligible seller.' },
    { icon: CirclePlay, title: 'Livestream shopping', body: 'Run live rooms and demo products in real time.' },
    { icon: Video, title: 'Video content', body: 'Product videos and creator content in discovery.' },
    { icon: MessageCircle, title: 'Customer inquiries', body: 'Direct messages and buyer requests from real buyers.' },
    { icon: Share2, title: 'Social distribution', body: 'Publish approved posts through connected accounts.' },
    { icon: Globe2, title: 'Google discovery', body: 'Search-friendly pages, metadata and sitemap coverage.' },
    { icon: BarChart3, title: 'Seller analytics', body: 'Shop visits, traffic sources and publishing activity.' },
    { icon: Sparkles, title: 'Creator opportunities', body: 'Content, collaboration and earning pathways.' },
  ];

  return (
    <section className="bg-[#FAF8F5] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionIntro
          eyebrow="Why Vidnov"
          title="Everything Your Business Needs to Grow."
          description="Discovery, storefront, live selling, publishing and reporting — in one account, on any device."
          action={{ label: 'How Vidnov works', href: '/how-it-works' }}
        />

        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-[22px] border border-black/8 bg-white p-5 transition-colors hover:border-[#FF4D2E]/35"
            >
              <feature.icon className="h-5 w-5 text-[#FF4D2E]" aria-hidden />
              <h3 className="mt-3.5 font-grotesk text-base font-bold text-[#0B0B0C]">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#57524B]">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ValuesSection() {
  const values = [
    { icon: BadgeCheck, title: 'Genuine businesses', body: 'Shops and listings come from registered sellers.' },
    { icon: HeartHandshake, title: 'Respectful creators', body: 'Creators treat their audience with respect.' },
    { icon: Video, title: 'Useful, educational content', body: 'Content should inform, not just chase attention.' },
    { icon: ShieldCheck, title: 'Safe discovery', body: 'Search surfaces real listings, not manipulated results.' },
    { icon: Megaphone, title: 'Honest product information', body: 'Listings describe what the seller actually offers.' },
    { icon: Users, title: 'Responsible promotion', body: 'Sponsored content is labelled wherever it appears.' },
  ];

  return (
    <section className="relative overflow-hidden bg-[#0B0B0D] py-16 sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_80%_0%,rgba(255,77,46,0.14),transparent_60%)]"
      />
      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Eyebrow tone="dark">Trust, safety & community</Eyebrow>
          <h2 className="mt-4 text-balance font-grotesk text-[clamp(1.9rem,4vw,2.9rem)] font-black leading-[1.05] tracking-[-0.035em] text-white">
            Technology With Values. Business With Purpose.
          </h2>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-white/60 sm:text-base">
            Vidnov is built for useful content, legitimate business and human
            dignity. Real shops instead of invented listings, labelled advertising
            instead of disguised promotion, and rules that apply to everyone.
          </p>
        </div>

        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {values.map((value) => (
            <div key={value.title} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
              <value.icon className="h-5 w-5 text-[#FF4D2E]" aria-hidden />
              <h3 className="mt-3.5 font-grotesk text-base font-bold text-white">{value.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-white/55">{value.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/about"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold text-white/80 transition-colors hover:border-white/40 hover:text-white"
          >
            About Vidnov
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/terms"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold text-white/80 transition-colors hover:border-white/40 hover:text-white"
          >
            Community rules
          </Link>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-[#FAF8F5] px-5 py-14 sm:px-8 sm:py-16">
      <div className="mx-auto w-full max-w-7xl">
        <div className="relative overflow-hidden rounded-[32px] bg-[#0B0B0D] px-6 py-14 text-center sm:px-12 sm:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_120%_at_50%_0%,rgba(255,77,46,0.35),transparent_65%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 left-1/2 h-48 w-[70%] -translate-x-1/2 rounded-full bg-[#FF4D2E]/20 blur-3xl"
          />
          <div className="relative">
            <Eyebrow tone="dark">
              <Check className="h-3 w-3" />
              Join the marketplace
            </Eyebrow>
            <h2 className="mx-auto mt-5 max-w-2xl text-balance font-grotesk text-[clamp(2rem,4.4vw,3.2rem)] font-black leading-[1.02] tracking-[-0.04em] text-white">
              Your Next Opportunity Starts Here.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-white/65 sm:text-base">
              Whether you are looking for something special, building a business or
              creating something valuable, there is a place for you on Vidnov.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/discovery"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#FF4D2E] px-8 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-[#e63f21]"
              >
                Explore Vidnov
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/app/seller/create"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 px-8 text-sm font-bold text-white transition-colors hover:border-white/50 hover:bg-white/5"
              >
                Create Your Shop
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── page ────────────────────────────────────────────────────────────────── */

export default async function VidnovHomepage() {
  const feed = await loadLandingFeed();

  return (
    <LandingLayout dark>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: websiteJsonLd() }} />

      <Hero />
      <SearchSection />
      <CategoryStrip />
      <BusinessesSection businesses={feed.businesses} reachable={feed.reachable} />
      <ListingsSection listings={feed.listings} reachable={feed.reachable} />
      <LiveSection />
      <VideoSection />
      <DistributionSection />
      <HowItWorksSection />
      <WhySection />
      <ValuesSection />
      <FinalCta />
    </LandingLayout>
  );
}
