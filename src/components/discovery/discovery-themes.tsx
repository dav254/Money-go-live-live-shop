'use client';

/**
 * DISCOVERY · THEMES.
 *
 * The editorial half of Discovery: collections a person can browse when they
 * have no search term yet.
 *
 * Every tile here maps to a REAL filter on the real catalogue — a category the
 * seller actually chose (`PRODUCT_CATEGORIES` / `SERVICE_CATEGORIES`), a county
 * from the platform's own location list, or a genuinely live stream. There is
 * no "curated by our editors" copy over an empty grid, no invented seller, no
 * fake view count: tapping a collection opens Shop with that filter applied,
 * and the results are whatever the marketplace actually holds.
 *
 * Trending is deliberately absent. The server records search demand
 * (`lib/discover/demand.ts`) but no endpoint reads it back yet, so a "Trending"
 * row would be a guess dressed as data.
 */

import * as React from 'react';
import { ArrowUpRight, MapPin, Radio, Sparkles, Store, Wrench } from 'lucide-react';

import { productCategoryOptions, serviceCategoryOptions } from '@/lib/discover/categories';
import { kenyaLocations } from '@/lib/location-data';
import { cn } from '@/lib/utils';

export type ThemeSeed = {
  category?: string;
  location?: string;
  kind?: 'all' | 'businesses' | 'listings';
};

/** Editorial collections, each anchored to one real product category. */
const EDITORIAL: Array<{ category: string; kicker: string; title: string; blurb: string }> = [
  {
    category: 'Fashion & Apparel',
    kicker: 'The new wardrobe',
    title: 'Fashion & Apparel',
    blurb: 'Pieces from sellers who photograph what they actually stock.',
  },
  {
    category: 'Electronics & Gadgets',
    kicker: 'Built to last',
    title: 'Electronics & Gadgets',
    blurb: 'Phones, audio and accessories with real stock counts.',
  },
  {
    category: 'Home & Living',
    kicker: 'Make it home',
    title: 'Home & Living',
    blurb: 'Furniture, decor and the small things that finish a room.',
  },
  {
    category: 'Beauty & Personal Care',
    kicker: 'Rituals',
    title: 'Beauty & Personal Care',
    blurb: 'Everyday care from shops that ship.',
  },
  {
    category: 'Art & Collectibles',
    kicker: 'Made by hand',
    title: 'Art & Collectibles',
    blurb: 'Original work, listed by the person who made it.',
  },
  {
    category: 'Food & Groceries',
    kicker: 'Kitchen to table',
    title: 'Food & Groceries',
    blurb: 'Pantry staples and fresh produce from local sellers.',
  },
];

/** Service collections, anchored to a real service category key. */
const SERVICE_THEMES: Array<{ key: string; title: string; blurb: string }> = [
  { key: 'plumbing', title: 'Fix it now', blurb: 'Plumbing, electrical and repairs' },
  { key: 'cleaning', title: 'Reset the space', blurb: 'Cleaning and painting' },
  { key: 'tutoring', title: 'Learn something', blurb: 'Lessons and tutoring' },
  { key: 'catering', title: 'Host it well', blurb: 'Catering and events' },
];

type LiveRoom = { id: string; sellerId: string; title: string; viewerCount: number };

export function DiscoveryThemes({
  onExplore,
  onOpenLive,
}: {
  onExplore: (seed: ThemeSeed) => void;
  onOpenLive: () => void;
}) {
  const [rooms, setRooms] = React.useState<LiveRoom[] | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch('/api/home/live')
      .then((response) => (response.ok ? response.json() : { rooms: [] }))
      .then((body: { rooms?: LiveRoom[] }) => {
        if (alive) setRooms(Array.isArray(body?.rooms) ? body.rooms : []);
      })
      .catch(() => {
        if (alive) setRooms([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const counties = Object.keys(kenyaLocations);
  // Nairobi first: it is the deepest inventory on the platform, not a claim
  // about where anyone should shop.
  const orderedCounties = React.useMemo(() => {
    const rest = counties.filter((county) => county !== 'Nairobi');
    return counties.includes('Nairobi') ? ['Nairobi', ...rest] : rest;
  }, [counties]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-24 pt-4 sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-10">
        {/* ── Masthead ───────────────────────────────────────────────── */}
        <header className="max-w-2xl space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#777777]">
            Themes
          </p>
          <h1 className="font-grotesk text-3xl font-bold leading-tight text-white sm:text-4xl">
            Shop by theme, not by search term.
          </h1>
          <p className="text-sm leading-relaxed text-[#777777]">
            Collections built from the categories sellers actually publish in. Each one opens the
            real catalogue with that filter applied.
          </p>
        </header>

        {/* ── Live right now (real sessions only) ────────────────────── */}
        {rooms && rooms.length > 0 ? (
          <section className="space-y-3">
            <SectionKicker icon={<Radio className="h-3.5 w-3.5" />} label="Live right now" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.slice(0, 6).map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={onOpenLive}
                  className="group flex items-center gap-3 rounded-xl border border-[#E8E8E8]/16 bg-white/[0.04] p-3 text-left transition hover:border-[color:var(--vn-discovery-accent)]/60 hover:bg-white/[0.07]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--vn-discovery-accent)] text-[#0A0A0A]">
                    <Radio className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                      {room.title || 'Live session'}
                    </span>
                    <span className="block text-xs text-[#777777]">
                      {room.viewerCount} watching
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-[#777777] transition group-hover:text-[color:var(--vn-discovery-accent)]" />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Editorial collections ──────────────────────────────────── */}
        <section className="space-y-3">
          <SectionKicker icon={<Sparkles className="h-3.5 w-3.5" />} label="Editorial collections" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EDITORIAL.map((collection) => (
              <CollectionTile
                key={collection.category}
                kicker={collection.kicker}
                title={collection.title}
                blurb={collection.blurb}
                onClick={() => onExplore({ category: collection.category, kind: 'listings' })}
              />
            ))}
          </div>
        </section>

        {/* ── Services ───────────────────────────────────────────────── */}
        <section className="space-y-3">
          <SectionKicker icon={<Wrench className="h-3.5 w-3.5" />} label="Services & skills" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICE_THEMES.map((theme) => {
              const label =
                serviceCategoryOptions.find((option) => option.value === theme.key)?.label ??
                theme.title;
              return (
                <CollectionTile
                  key={theme.key}
                  kicker={label}
                  title={theme.title}
                  blurb={theme.blurb}
                  onClick={() => onExplore({ category: theme.key, kind: 'listings' })}
                />
              );
            })}
          </div>
        </section>

        {/* ── Business collections ───────────────────────────────────── */}
        <section className="space-y-3">
          <SectionKicker icon={<Store className="h-3.5 w-3.5" />} label="Businesses" />
          <div className="grid gap-3 sm:grid-cols-2">
            <CollectionTile
              kicker="Shops"
              title="Every business on Vidnov"
              blurb="Shops and service businesses, with verification shown only when it is real."
              onClick={() => onExplore({ kind: 'businesses' })}
            />
            <CollectionTile
              kicker="Nearby"
              title="Businesses around you"
              blurb="Pick a county to see the shops that serve it."
              onClick={() => onExplore({ location: 'Nairobi', kind: 'businesses' })}
            />
          </div>
        </section>

        {/* ── Category exploration ───────────────────────────────────── */}
        <section className="space-y-3">
          <SectionKicker label="Every category" />
          <div className="flex flex-wrap gap-2">
            {productCategoryOptions.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => onExplore({ category, kind: 'listings' })}
                className="vn-discovery-chip rounded-full px-3 py-1.5 text-xs font-medium"
              >
                {category}
              </button>
            ))}
            {serviceCategoryOptions.map((service) => (
              <button
                key={service.value}
                type="button"
                onClick={() => onExplore({ category: service.value, kind: 'listings' })}
                className="vn-discovery-chip rounded-full px-3 py-1.5 text-xs font-medium"
              >
                {service.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Places ─────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <SectionKicker icon={<MapPin className="h-3.5 w-3.5" />} label="Shop by place" />
          <div className="flex flex-wrap gap-2">
            {orderedCounties.slice(0, 16).map((county) => (
              <button
                key={county}
                type="button"
                onClick={() => onExplore({ location: county, kind: 'all' })}
                className="rounded-full border border-[#E8E8E8]/16 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-[color:var(--vn-discovery-accent)]/60 hover:text-white"
              >
                {county}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionKicker({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <h2 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#777777]">
      {icon ? <span className="text-[color:var(--vn-discovery-accent)]">{icon}</span> : null}
      {label}
    </h2>
  );
}

function CollectionTile({
  kicker,
  title,
  blurb,
  onClick,
}: {
  kicker: string;
  title: string;
  blurb: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex h-full flex-col items-start gap-1.5 rounded-xl border border-[#E8E8E8]/16 bg-white/[0.04] p-4 text-left',
        'transition hover:border-[color:var(--vn-discovery-accent)]/60 hover:bg-white/[0.07]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--vn-discovery-accent)]',
      )}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#777777]">
          {kicker}
        </span>
        <ArrowUpRight className="h-4 w-4 text-[#777777] transition group-hover:text-[color:var(--vn-discovery-accent)]" />
      </span>
      <span className="font-grotesk text-lg font-semibold leading-snug text-white">{title}</span>
      <span className="text-xs leading-relaxed text-[#777777]">{blurb}</span>
    </button>
  );
}
