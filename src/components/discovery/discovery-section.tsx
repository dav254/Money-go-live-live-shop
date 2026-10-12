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
 * bar — see `discovery-header.tsx`. The section's accent follows the audience:
 * blue on the buyer surfaces, orange on the seller surface. The accent lives
 * as CSS variables on `.vn-discovery-scope` in `globals.css` (with an
 * `html:has(.vn-seller-scope)` override) so the portalled filter sheet, which
 * re-applies that class on `body`, inherits the right colour too.
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
  const [category, setCategory] = React.useState<DiscoveryCategoryId>('for-you');
  const [filters, setFilters] = React.useState<DiscoveryFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [resultCount, setResultCount] = React.useState(0);

  const handleResultCount = React.useCallback((count: number) => {
    setResultCount(count);
  }, []);

  return (
    <div className="vn-discovery-scope flex h-[100dvh] flex-col overflow-hidden">
      <DiscoveryTopBar
        filters={filters}
        onOpenFilters={() => setFiltersOpen(true)}
        activeCategory={category}
        onSelectCategory={setCategory}
      />

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
