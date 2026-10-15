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
import {
  EMPTY_FILTERS,
  type DiscoveryCategoryId,
  type DiscoveryFilters,
} from '@/lib/discovery';

export function DiscoverySection({
  nav,
  noBottomNav,
  ownCover,
}: {
  nav?: DiscoveryNavItem[];
  noBottomNav?: boolean;
  ownCover?: (listing: import('@/lib/types').Product) => string;
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

  const handleResultCount = React.useCallback((count: number) => {
    setResultCount(count);
  }, []);

  /*
   * ONE header per surface. On the app routes (`nav` is passed) the SHELL's
   * top bar is the header — hamburger, Vidnov name and the search button —
   * so this section renders no bar of its own there; stacking one under it
   * gave two headers and two hamburgers. The website route has no shell, so
   * it keeps this bar (name + search, no hamburger, no account).
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
    <div className="vn-discovery-scope flex h-[100dvh] flex-col overflow-hidden">
      {!nav?.length && (
        <DiscoveryTopBar
          filters={filters}
          onOpenFilters={() => setFiltersOpen(true)}
        />
      )}

      <ActiveFilterStrip filters={filters} onChange={setFilters} />

      <main className="flex min-h-0 flex-1 flex-col">
        <DiscoveryFeed
          category={category}
          filters={filters}
          onResultCount={handleResultCount}
          ownCover={ownCover}
        />
      </main>

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
