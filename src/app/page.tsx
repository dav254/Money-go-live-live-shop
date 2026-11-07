import type { ElementType, ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Check,
  CirclePlay,
  Globe2,
  HeartHandshake,
  MapPin,
  Megaphone,
  PlayCircle,
  Search,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
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
 * Server-rendered on purpose: the hero, business grid and listing grid are real
 * HTML for crawlers and for the first paint. Only the things that must be
 * interactive (the search box, the live strip) are client components.
 *
 * Every card below comes from `loadLandingFeed()` — VPS first, Firestore second,
 * with the same eligibility gate `/discover` uses. When there is nothing genuine
 * to show, the section renders a designed empty state inviting registration. No
 * business, price, rating or statistic is invented anywhere on this page.
 */

export const revalidate = 300;

const TITLE = 'Vidnov — Discover. Connect. Grow.';
const DESCRIPTION =
  'Discover businesses, explore products and services, connect with creators, and find new opportunities. Vidnov brings businesses and people together.';

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
    images: [
      {
        url: '/icons/icon-512.png',
        width: 512,
        height: 512,
        alt: 'Vidnov',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/icons/icon-512.png'],
  },
};

/**
 * WebSite + SearchAction. The Organization graph is emitted once by the root
 * layout, so it is deliberately not duplicated here. No business is described in
 * structured data unless it is rendered on the page from real records.
 */
function websiteJsonLd(): string {
  const origin = publicOrigin();
  const year = new Date().getFullYear();
  return serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Vidnov',
    alternateName: 'Vidnov Marketplace',
    url: origin,
    description: DESCRIPTION,
    inLanguage: 'en',
    copyrightYear: year,
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

/* ── shared bits ─────────────────────────────────────────────────────────── */

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
      className={`flex items-center justify-center rounded-2xl bg-[#0B0B0C] font-grotesk font-black tracking-tight text-white/85 ${
        size === 'sm' ? 'h-10 w-10 text-sm' : 'h-full w-full text-2xl'
      }`}
      aria-hidden
    >
      {initials || 'V'}
    </div>
  );
}

function BusinessTile({ business }: { business: LandingBusiness }) {
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
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 font-grotesk text-base font-bold leading-snug text-[#0B0B0C]">
            <Link href={business.href} className="line-clamp-2 hover:text-[#C5351B]">
              {business.name}
            </Link>
          </h3>
        </div>

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

function ListingTile({ listing }: { listing: LandingListing }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-black/8 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#FF4D2E]/35 hover:shadow-[0_24px_60px_rgba(11,11,12,0.10)]">
      <Link href={listing.href} className="relative block h-40 overflow-hidden bg-[#F0ECE5]">
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
          {/* Paid placement is labelled, never silently ranked up. */}
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

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-[#8A837A]">
            <Store className="h-3 w-3 shrink-0 text-[#C5351B]" aria-hidden />
            <span className="truncate">{listing.sellerName || 'Vidnov seller'}</span>
          </span>
          <Link
            href={listing.href}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-black/10 px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#0B0B0C] transition-colors hover:border-[#FF4D2E] hover:text-[#C5351B]"
          >
            {listing.kind === 'service' ? 'View service' : 'View product'}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  primary,
  secondary,
}: {
  icon: ElementType;
  title: string;
  body: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <div className="mt-10 flex flex-col items-center rounded-[26px] border border-dashed border-black/12 bg-white/70 px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-black/8 bg-[#0B0B0C] text-[#FF4D2E]">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="mt-5 font-grotesk text-xl font-black tracking-[-0.02em] text-[#0B0B0C]">{title}</h3>
      <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-[#57524B]">{body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href={primary.href}
          className="inline-flex items-center gap-2 rounded-full bg-[#FF4D2E] px-6 py-3 text-xs font-bold text-white transition-colors hover:bg-[#e63f21]"
        >
          {primary.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        {secondary ? (
          <Link
            href={secondary.href}
            className="inline-flex items-center gap-2 rounded-full border border-black/12 px-6 py-3 text-xs font-bold text-[#0B0B0C] transition-colors hover:border-black/35"
          >
            {secondary.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/* ── sections ────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#08080A]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_18%_0%,rgba(255,77,46,0.22),transparent_60%),radial-gradient(50%_45%_at_92%_18%,rgba(255,77,46,0.10),transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(70%_60%_at_50%_20%,black,transparent)]"
      />

      <div className="relative mx-auto w-full max-w-7xl px-5 pb-16 pt-12 sm:px-8 sm:pt-16 lg:pb-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <Eyebrow tone="dark">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF4D2E]" />
              Marketplace · Social commerce · Live
            </Eyebrow>

            <h1 className="mt-6 text-balance font-grotesk text-[clamp(3rem,7.2vw,5.4rem)] font-black leading-[0.92] tracking-[-0.055em] text-white">
              Discover.
              <br />
              Connect.{' '}
              <span className="text-[#FF4D2E]">Grow.</span>
            </h1>

            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/65 sm:text-lg">
              Discover businesses, explore products and services, connect with
              creators, and find new opportunities. Vidnov brings businesses and
              people together.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/discover?kind=businesses"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#FF4D2E] px-7 text-sm font-bold text-white shadow-[0_16px_40px_rgba(255,77,46,0.30)] transition-all hover:-translate-y-0.5 hover:bg-[#e63f21]"
              >
                Explore Businesses
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/app/seller/create"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 px-7 text-sm font-bold text-white transition-colors hover:border-white/50 hover:bg-white/5"
              >
                Start Selling
              </Link>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-white/50">
              {[
                { label: 'Products', href: '/discover?kind=listings', icon: ShoppingBag },
                { label: 'Services', href: '/categories?type=services', icon: Sparkles },
                { label: 'Videos', href: '/buyer/discovery', icon: PlayCircle },
                { label: 'Live Shopping', href: '/live', icon: CirclePlay },
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

          {/* Honest visual: a typographic storefront map, no invented business,
              price or viewer figure anywhere in it. */}
          <div className="relative mx-auto w-full max-w-[460px] lg:max-w-none">
            <div
              aria-hidden
              className="absolute -right-6 -top-6 h-24 w-24 rounded-full border-[10px] border-[#FF4D2E]/25"
            />
            <div
              aria-hidden
              className="absolute -bottom-8 -left-4 h-20 w-20 rounded-full border-[8px] border-white/10"
            />

            <div className="relative rounded-[30px] border border-white/10 bg-[linear-gradient(155deg,#151519,#0A0A0C)] p-5 shadow-[0_40px_100px_rgba(0,0,0,0.65)]">
              <div className="flex items-center justify-between">
                <Logo className="text-2xl text-white" />
                <span className="rounded-full border border-white/12 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/50">
                  One place
                </span>
              </div>

              <div className="mt-6 rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF8A76]">
                  Shops
                </p>
                <p className="mt-2 font-grotesk text-xl font-bold leading-snug text-white">
                  Businesses, products and services in one discovery feed.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[
                    { label: 'Products', icon: ShoppingBag },
                    { label: 'Services', icon: Sparkles },
                    { label: 'Businesses', icon: Store },
                    { label: 'Creators', icon: Users },
                  ].map((tile) => (
                    <div
                      key={tile.label}
                      className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/25 px-3 py-2.5 text-[11px] font-semibold text-white/70"
                    >
                      <tile.icon className="h-3.5 w-3.5 text-[#FF4D2E]" aria-hidden />
                      {tile.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3 rounded-[22px] border border-[#FF4D2E]/25 bg-[#FF4D2E]/10 p-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFB9A8]">
                    Live shopping
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-white/70">
                    Sellers go live to demo products and answer buyers in real time.
                  </p>
                </div>
                <CirclePlay className="h-7 w-7 text-[#FF4D2E]" aria-hidden />
              </div>

              <div className="mt-3 flex items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="text-[11px] text-white/55">Search the whole marketplace</span>
                <Search className="h-4 w-4 text-white/45" aria-hidden />
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
      </div>
    </section>
  );
}

function CategoryStrip() {
  const categories = landingCategories.slice(0, 8);
  return (
    <section className="bg-[#FAF8F5]">
      <div className="mx-auto w-full max-w-7xl px-5 pb-2 pt-12 sm:px-8">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-grotesk text-lg font-black tracking-[-0.02em] text-[#0B0B0C] sm:text-xl">
            Browse by category
          </h2>
          <Link
            href="/discover"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#0B0B0C]/55 transition-colors hover:text-[#0B0B0C]"
          >
            All categories
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="mt-5 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((category) => (
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

function BusinessesSection({ businesses, reachable }: { businesses: LandingBusiness[]; reachable: boolean }) {
  const counties = Object.keys(kenyaLocations).slice(0, 4);
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

  return (
    <section className="bg-[#FAF8F5] pb-16 pt-12 sm:pb-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionIntro
          eyebrow="Local & global"
          title="Discover Businesses Around You"
          description="Find businesses, explore their shops and connect directly."
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
              <BusinessTile key={business.id} business={business} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Store}
            title={
              reachable
                ? 'No verified businesses to feature yet'
                : 'The business feed is unavailable right now'
            }
            body={
              reachable
                ? 'Vidnov only shows genuine registered sellers with a complete public profile. Register your business to be one of the first shops customers discover here.'
                : 'We could not reach the marketplace catalogue just now. Search and discovery still work, and this section fills in as soon as the feed answers.'
            }
            primary={{ label: 'Register your business', href: '/app/seller/create' }}
            secondary={{ label: 'Browse discovery', href: '/discover?kind=businesses' }}
          />
        )}
      </div>
    </section>
  );
}

function ListingsSection({ listings, reachable }: { listings: LandingListing[]; reachable: boolean }) {
  return (
    <section className="bg-white pb-16 pt-16 sm:pb-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionIntro
          eyebrow="Products & services"
          title="Explore What's Available"
          description="Real listings from real sellers — products you can buy and services you can book or request."
          action={{ label: 'See everything', href: '/discover?kind=listings' }}
        />

        {listings.length > 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((listing) => (
              <ListingTile key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ShoppingBag}
            title={reachable ? 'No listings published yet' : 'The listing feed is unavailable right now'}
            body={
              reachable
                ? 'Every listing on Vidnov is published by a seller. Add your first product or service and it will appear in discovery — and here.'
                : 'We could not reach the catalogue just now. Discovery still works, so you can search directly from here.'
            }
            primary={{ label: 'List a product or service', href: '/app/seller/create' }}
            secondary={{ label: 'Search listings', href: '/discover?kind=listings' }}
          />
        )}

        <p className="mt-6 flex items-center gap-2 text-[11px] text-[#8A837A]">
          <Megaphone className="h-3.5 w-3.5 text-[#C5351B]" aria-hidden />
          Sponsored placements are always labelled. Paid placement never changes how
          organic results are ranked.
        </p>
      </div>
    </section>
  );
}

function VideoSection() {
  return (
    <section className="bg-[#08080A] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionIntro
          tone="dark"
          eyebrow="Video & live"
          title="Watch. Discover. Shop."
          description="Live rooms, product demonstrations and creator content from sellers who are broadcasting right now."
          action={{ label: 'Live shopping', href: '/live' }}
        />
        <LiveDiscovery />
      </div>
    </section>
  );
}

function ExposureSection() {
  const cards = [
    {
      icon: Globe2,
      label: 'Google discovery',
      title: 'Be findable where people search',
      body: 'Eligible public seller shops and product pages can be discovered through Google Search, with structured data built from your own listing details.',
      note: 'Indexing and rankings are decided by search engines — never guaranteed.',
    },
    {
      icon: Share2,
      label: 'Social distribution',
      title: 'Publish once, reach further',
      body: 'Share and publish approved promotional content through connected social media accounts using Vidnov’s Social Engine.',
      note: 'You approve every post. Reach and engagement are never promised.',
    },
    {
      icon: BarChart3,
      label: 'Business analytics',
      title: 'Know what is working',
      body: 'Understand shop visits, traffic sources, social publishing activity and customer inquiries from one dashboard.',
      note: 'Reporting covers activity recorded inside Vidnov.',
    },
  ];

  return (
    <section className="bg-[#F1EDE6] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Eyebrow>Built for business exposure</Eyebrow>
          <h2 className="mt-4 text-balance font-grotesk text-[clamp(1.9rem,4vw,2.9rem)] font-black leading-[1.05] tracking-[-0.035em] text-[#0B0B0C]">
            Your Business Deserves to Be Discovered Everywhere.
          </h2>
          <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-[#57524B] sm:text-base">
            A Vidnov shop is more than a storefront. It connects your catalogue to
            search, to social distribution and to the numbers that tell you what is
            actually driving interest.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.label}
              className="flex h-full flex-col rounded-[26px] border border-black/8 bg-white p-6 transition-shadow hover:shadow-[0_24px_60px_rgba(11,11,12,0.08)] sm:p-7"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0B0B0C] text-[#FF4D2E]">
                <card.icon className="h-5 w-5" aria-hidden />
              </div>
              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#C5351B]">
                {card.label}
              </p>
              <h3 className="mt-2 font-grotesk text-xl font-bold tracking-[-0.02em] text-[#0B0B0C]">
                {card.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-[#57524B]">{card.body}</p>
              <p className="mt-auto pt-5 text-[11px] leading-relaxed text-[#8A837A]">{card.note}</p>
            </article>
          ))}
        </div>

        <div className="mt-8">
          <Link
            href="/app/seller/create"
            className="inline-flex items-center gap-2 rounded-full bg-[#FF4D2E] px-6 py-3 text-xs font-bold text-white transition-colors hover:bg-[#e63f21]"
          >
            Create your seller shop
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function WhySection() {
  const features = [
    { icon: ShoppingBag, title: 'Free product listings', body: 'Publish products and services without a listing fee.' },
    { icon: Store, title: 'A public online shop', body: 'Your own seller page with your branding, catalogue and contact.' },
    { icon: Search, title: 'Product and service discovery', body: 'Appear in the same search buyers use across the marketplace.' },
    { icon: CirclePlay, title: 'Live selling', body: 'Run live rooms from your dashboard and demo products in real time.' },
    { icon: Share2, title: 'Social media distribution', body: 'Send approved promotional posts through connected accounts.' },
    { icon: BarChart3, title: 'Business analytics', body: 'Track shop visits, traffic sources and publishing activity.' },
    { icon: Users, title: 'Direct customer inquiries', body: 'Talk to buyers through Vidnov messages and buyer requests.' },
  ];

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionIntro
          eyebrow="Why Vidnov"
          title="Everything Your Business Needs to Grow."
          description="The tools a small business needs to be found, to sell and to understand its customers — in one account, on any device."
          action={{ label: 'How Vidnov works', href: '/how-it-works' }}
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-[22px] border border-black/8 bg-[#FAF8F5] p-5 transition-colors hover:border-[#FF4D2E]/30"
            >
              <feature.icon className="h-5 w-5 text-[#FF4D2E]" aria-hidden />
              <h3 className="mt-4 font-grotesk text-base font-bold text-[#0B0B0C]">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#57524B]">{feature.body}</p>
            </div>
          ))}
          <div className="flex flex-col justify-between rounded-[22px] border border-[#FF4D2E]/25 bg-[#0B0B0C] p-5">
            <div>
              <Sparkles className="h-5 w-5 text-[#FF4D2E]" aria-hidden />
              <h3 className="mt-4 font-grotesk text-base font-bold text-white">
                Buyer requests
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-white/60">
                Buyers describe what they need; relevant sellers can respond with an
                offer.
              </p>
            </div>
            <Link
              href="/requests"
              className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF8A76] hover:text-white"
            >
              See requests
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ValuesSection() {
  const values = [
    { icon: BadgeCheck, title: 'Genuine businesses', body: 'Shops and listings come from real registered sellers.' },
    { icon: ShieldCheck, title: 'Responsible content', body: 'Published content is subject to platform rules and review.' },
    { icon: HeartHandshake, title: 'Respectful creators', body: 'Creators are expected to treat their audience with respect.' },
    { icon: Search, title: 'Safe discovery', body: 'Search surfaces real listings, not manipulated placements.' },
    { icon: Megaphone, title: 'Transparent promotions', body: 'Sponsored content is labelled wherever it appears.' },
    { icon: Users, title: 'Customer trust', body: 'Direct contact with sellers, with your account history intact.' },
  ];

  return (
    <section className="relative overflow-hidden bg-[#0B0B0D] py-16 sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_80%_0%,rgba(255,77,46,0.14),transparent_60%)]"
      />
      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Eyebrow tone="dark">Trust & community</Eyebrow>
          <h2 className="mt-4 text-balance font-grotesk text-[clamp(1.9rem,4vw,2.9rem)] font-black leading-[1.05] tracking-[-0.035em] text-white">
            Technology With Values. Business With Purpose.
          </h2>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-white/60 sm:text-base">
            Vidnov is built for useful content, legitimate business and human
            dignity. That means real shops instead of invented listings, clear
            labelling instead of disguised advertising, and rules that apply to
            everyone on the platform.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {values.map((value) => (
            <div
              key={value.title}
              className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5"
            >
              <value.icon className="h-5 w-5 text-[#FF4D2E]" aria-hidden />
              <h3 className="mt-4 font-grotesk text-base font-bold text-white">{value.title}</h3>
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
            href="/privacy"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold text-white/80 transition-colors hover:border-white/40 hover:text-white"
          >
            How we handle data
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
              Whether you&apos;re building a business, discovering something new or
              creating content, there&apos;s a place for you on Vidnov.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#FF4D2E] px-8 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-[#e63f21]"
              >
                Join Vidnov
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/discover?kind=businesses"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 px-8 text-sm font-bold text-white transition-colors hover:border-white/50 hover:bg-white/5"
              >
                Explore Businesses
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
      <VideoSection />
      <ExposureSection />
      <WhySection />
      <ValuesSection />
      <FinalCta />
    </LandingLayout>
  );
}
