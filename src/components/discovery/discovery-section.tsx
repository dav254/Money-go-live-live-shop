'use client';

/**
 * DISCOVERY — the section.
 *
 * One component, three surfaces. `/buyer/discovery`, `/app/buyer/discovery` and
 * `/app/seller/discovery` all render this, which is the only way three routes
 * can be guaranteed to show the same feed: not "a feed that is very similar",
 * the same feed.
 *
 * ## Why it is a flex column that fills the viewport
 * The feed is full-screen and snap-scrolled, so the page itself must not
 * scroll — otherwise a flick scrolls the page AND the feed, and the buyer ends
 * up half a listing down with the header gone. So the section is `h-dvh`,
 * `flex-col`, `overflow-hidden`; the pinned bar is `shrink-0` and the feed is
 * `flex-1` and is the only scroller in the tree.
 *
 * ## One header, one accent
 * The old three-row header (identity, lanes, search) collapsed into a single
 * bar — see `discovery-header.tsx`. The accent is fixed rather than per
 * audience: `--vn-discovery-accent` (lime) is declared once on
 * `.vn-discovery-scope` in `globals.css`, so the portalled filter sheet —
 * which re-applies that class on `body` — inherits the same colour as the
 * feed. Components must read the variable, never a literal: an undeclared
 * accent renders as transparent, which is how the primary buttons lost their
 * background.
 */

import * as React from 'react';

import { DiscoveryTopBar } from './discovery-header';
import { ActiveFilterStrip, DiscoveryFilterSheet } from './discovery-filters';
import { DiscoveryFeed } from './discovery-feed';
import { DiscoveryBottomNav, type DiscoveryNavItem } from './discovery-nav';
import { DiscoveryShop } from './discovery-shop';
import { DiscoveryThemes, type ThemeSeed } from './discovery-themes';
import {
  EMPTY_FILTERS,
  type DiscoveryCategoryId,
  type DiscoveryFilters,
} from '@/lib/discovery';
import { cn } from '@/lib/utils';

export type DiscoveryTab = 'discover' | 'themes' | 'shop';

const TABS: Array<{ id: DiscoveryTab; label: string }> = [
  { id: 'discover', label: 'Discover' },
  { id: 'themes', label: 'Themes' },
  { id: 'shop', label: 'Shop' },
];

/**
 * The section's three-way switch. Always visible, never a hamburger: the whole
 * point of the original design is that browsing, exploring and buying are one
 * gesture apart.
 */
function DiscoveryTabs({
  tab,
  onChange,
}: {
  tab: DiscoveryTab;
  onChange: (next: DiscoveryTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Discovery sections"
      className="relative z-30 shrink-0 border-b border-[#E8E8E8]/12 bg-[#0A0A0A]/92 backdrop-blur-xl"
    >
      <div className="mx-auto flex w-full max-w-6xl items-stretch gap-1 px-3 sm:px-6">
        {TABS.map((entry) => {
          const active = tab === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(entry.id)}
              className={cn(
                'relative px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition sm:text-xs',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--vn-discovery-accent)]',
                active ? 'text-white' : 'text-[#777777] hover:text-white/80',
              )}
            >
              {entry.label}
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-2 bottom-0 h-[2px] rounded-full transition',
                  active ? 'bg-[color:var(--vn-discovery-accent)]' : 'bg-transparent',
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DiscoverySection({
  nav,
  noBottomNav,
  ownCover,
  fill,
}: {
  nav?: DiscoveryNavItem[];
  noBottomNav?: boolean;
  ownCover?: (listing: import('@/lib/types').Product) => string;
  /**
   * The section is rendered INSIDE another shell (the seller dashboard's
   * header, an app shell's top bar) rather than being the whole page. `100dvh`
   * there starts below that shell's chrome, so the section's bottom — the
   * product card and its View product button — lands one header-height BELOW
   * the fold and is clipped. `fill` roots it at `h-full` of the space the
   * parent actually left, which keeps the card on screen. The standalone
   * website route has no wrapper, so it keeps the default `100dvh`.
   */
  fill?: boolean;
}) {
  /*
   * The category lanes (For You · Products · Services · Businesses) were
   * removed from the header — they read as a second header stacked under the
   * shell's own bar. The feed still keys off this value, so it opens on
   * "For You" and a lane can return later (chip row or filter sheet) without
   * touching DiscoveryFeed.
   */
  const [category] = React.useState<DiscoveryCategoryId>('for-you');
  const [filters, setFilters] = React.useState<DiscoveryFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [resultCount, setResultCount] = React.useState(0);

  /*
   * DISCOVER · THEMES · SHOP — the three connected experiences. They are tabs
   * of ONE section, not three destinations: the header, the account actions and
   * the app's bottom bar stay put while the panel changes, which is what makes
   * them feel like one place rather than a menu of pages.
   */
  const [tab, setTab] = React.useState<DiscoveryTab>('discover');
  const [seed, setSeed] = React.useState<ThemeSeed | undefined>(undefined);

  const handleResultCount = React.useCallback((count: number) => {
    setResultCount(count);
  }, []);

  /*
   * ONE header per surface. On the app routes (`nav` is passed) the SHELL's
   * top bar is the header — hamburger, Vidnov name and the search button —
   * so this section renders no bar of its own there; stacking one under it
   * gave two headers and two hamburgers. The website route has no shell, so
   * it keeps this bar: name, search, notifications, saved and profile.
   *
   * The shell header's search button announces itself with this event, which
   * opens the filter sheet — search lives there.
   */
  React.useEffect(() => {
    const openSearch = () => setFiltersOpen(true);
    window.addEventListener('vidnov:open-search', openSearch);
    return () => window.removeEventListener('vidnov:open-search', openSearch);
  }, []);

  return (
    <div
      className={cn(
        'vn-discovery-scope flex flex-col overflow-hidden',
        fill ? 'h-full min-h-0' : 'h-[100dvh]',
      )}
    >
      {!nav?.length && (
        <DiscoveryTopBar
          filters={filters}
          onOpenFilters={() => setFiltersOpen(true)}
        />
      )}

      <DiscoveryTabs tab={tab} onChange={setTab} />

      {tab === 'discover' ? (
        <>
          <ActiveFilterStrip filters={filters} onChange={setFilters} />
          <main className="flex min-h-0 flex-1 flex-col">
            <DiscoveryFeed
              category={category}
              filters={filters}
              onResultCount={handleResultCount}
              ownCover={ownCover}
            />
          </main>
        </>
      ) : null}

      {tab === 'themes' ? (
        <DiscoveryThemes
          onExplore={(next) => {
            setSeed(next);
            setTab('shop');
          }}
          onOpenLive={() => {
            window.location.href = '/live';
          }}
        />
      ) : null}

      {tab === 'shop' ? (
        <main className="flex min-h-0 flex-1 flex-col">
          <DiscoveryShop seed={seed} />
        </main>
      ) : null}

      {!noBottomNav && nav?.length ? <DiscoveryBottomNav items={nav} /> : null}

      <DiscoveryFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onChange={setFilters}
        resultCount={resultCount}
      />
    </div>
  );
}
