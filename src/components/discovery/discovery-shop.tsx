'use client';

/**
 * DISCOVERY · SHOP.
 *
 * The commercial half of Discovery: the full catalogue of products and services
 * (and the businesses that sell them), searchable and filterable.
 *
 * It is a thin client over `GET /api/discover` — the same server query the
 * website's search page uses, so ranking, eligibility and paging are identical
 * in both places and no second catalogue exists. Cards are `DiscoverCard`, the
 * same component the search page renders, so a listing cannot look like one
 * thing here and another thing there.
 *
 * Search is debounced because `/api/discover` is rate limited; a filter change
 * aborts the in-flight request so a slow response cannot overwrite a newer one.
 */

import * as React from 'react';
import { Loader2, Search, SlidersHorizontal, X } from 'lucide-react';

import { DiscoverCard } from '@/components/discover/result-cards';
import { productCategoryOptions, serviceCategoryOptions } from '@/lib/discover/categories';
import { kenyaLocations } from '@/lib/location-data';
import type { DiscoverItem, DiscoverKindFilter, DiscoverPage } from '@/lib/discover/search';
import { cn } from '@/lib/utils';
import type { ThemeSeed } from './discovery-themes';

type Sort = 'relevance' | 'newest' | 'nearby';

const KINDS: Array<{ id: DiscoverKindFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'listings', label: 'Products & services' },
  { id: 'businesses', label: 'Businesses' },
];

const SORTS: Array<{ id: Sort; label: string }> = [
  { id: 'relevance', label: 'Best match' },
  { id: 'newest', label: 'Newest' },
  { id: 'nearby', label: 'Nearest first' },
];

export function DiscoveryShop({ seed }: { seed?: ThemeSeed }) {
  const [query, setQuery] = React.useState('');
  const [kind, setKind] = React.useState<DiscoverKindFilter>('all');
  const [category, setCategory] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [sort, setSort] = React.useState<Sort>('relevance');

  const [page, setPage] = React.useState<DiscoverPage | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [moreOpen, setMoreOpen] = React.useState(false);

  /* A theme tapped in the Themes tab seeds the catalogue. */
  React.useEffect(() => {
    if (!seed) return;
    setCategory(seed.category ?? '');
    setLocation(seed.location ?? '');
    setKind(seed.kind ?? 'all');
    setQuery('');
  }, [seed]);

  const counties = React.useMemo(() => Object.keys(kenyaLocations), []);

  React.useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: '1', limit: '24', sort });
        if (query.trim()) params.set('q', query.trim());
        if (kind !== 'all') params.set('kind', kind);
        if (category) params.set('category', category);
        if (location) params.set('location', location);

        const response = await fetch(`/api/discover?${params.toString()}`, {
          signal: controller.signal,
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error || 'Discovery is unavailable.');
        setPage(body as DiscoverPage);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Discovery is unavailable.');
      } finally {
        setLoading(false);
      }
    }, query ? 350 : 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, kind, category, location, sort]);

  const items: DiscoverItem[] = page?.items ?? [];
  const activeFilters =
    (category ? 1 : 0) + (location ? 1 : 0) + (kind !== 'all' ? 1 : 0) + (sort !== 'relevance' ? 1 : 0);

  const clearAll = () => {
    setQuery('');
    setKind('all');
    setCategory('');
    setLocation('');
    setSort('relevance');
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-24 pt-4 sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        {/* ── Search ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="group relative flex flex-1 items-center">
            <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#777777]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              inputMode="search"
              placeholder="Search products, services and shops"
              aria-label="Search the Vidnov catalogue"
              className="h-11 w-full rounded-xl border border-[#E8E8E8]/16 bg-white/[0.04] pl-10 pr-10 text-sm text-white placeholder:text-[#777777] focus:border-[color:var(--vn-discovery-accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--vn-discovery-accent)]/30"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-full text-[#777777] hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </label>

          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            className={cn(
              'flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-semibold transition',
              activeFilters > 0
                ? 'border-[color:var(--vn-discovery-accent)] bg-[color:var(--vn-discovery-accent)] text-[#0A0A0A]'
                : 'border-[#E8E8E8]/16 bg-white/[0.04] text-white hover:border-white/35',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters{activeFilters > 0 ? ` · ${activeFilters}` : ''}
          </button>
        </div>

        {/* ── Type tabs ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {KINDS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setKind(option.id)}
              data-active={kind === option.id}
              className="vn-discovery-chip rounded-full px-3 py-1.5 text-xs font-medium"
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* ── Filters ────────────────────────────────────────────────── */}
        {moreOpen ? (
          <div className="grid gap-3 rounded-xl border border-[#E8E8E8]/16 bg-white/[0.03] p-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#777777]">
                Category
              </span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-10 w-full rounded-lg border border-[#E8E8E8]/16 bg-[#0A0A0A] px-2 text-sm text-white focus:border-[color:var(--vn-discovery-accent)] focus:outline-none"
              >
                <option value="">Every category</option>
                <optgroup label="Products">
                  {productCategoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Services">
                  {serviceCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>

            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#777777]">
                Location
              </span>
              <select
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="h-10 w-full rounded-lg border border-[#E8E8E8]/16 bg-[#0A0A0A] px-2 text-sm text-white focus:border-[color:var(--vn-discovery-accent)] focus:outline-none"
              >
                <option value="">Everywhere</option>
                {counties.map((county) => (
                  <option key={county} value={county}>
                    {county}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#777777]">
                Sort
              </span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
                className="h-10 w-full rounded-lg border border-[#E8E8E8]/16 bg-[#0A0A0A] px-2 text-sm text-white focus:border-[color:var(--vn-discovery-accent)] focus:outline-none"
              >
                {SORTS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {/* ── Result count ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[#777777]" aria-live="polite">
            {loading
              ? 'Searching…'
              : page
                ? `${page.total.toLocaleString()} ${page.total === 1 ? 'result' : 'results'}`
                : ''}
          </p>
          {activeFilters > 0 || query ? (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-semibold text-[color:var(--vn-discovery-accent)] hover:underline"
            >
              Clear all
            </button>
          ) : null}
        </div>

        {/* ── Results ────────────────────────────────────────────────── */}
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-[#E8E8E8]/16 bg-white/[0.03] py-16 text-sm text-[#777777]">
            <Loader2 className="h-4 w-4 animate-spin text-[color:var(--vn-discovery-accent)]" />
            Loading the catalogue
          </div>
        ) : error ? (
          <div className="rounded-xl border border-[#E8E8E8]/16 bg-white/[0.03] px-4 py-12 text-center">
            <p className="text-sm text-white">{error}</p>
            <button
              type="button"
              onClick={clearAll}
              className="mt-3 text-xs font-semibold text-[color:var(--vn-discovery-accent)] hover:underline"
            >
              Reset search
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-[#E8E8E8]/16 bg-white/[0.03] px-4 py-16 text-center">
            <p className="font-grotesk text-lg font-semibold text-white">Nothing matches yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[#777777]">
              No seller has published a match for this combination. Try a broader category or
              another county.
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="mt-4 rounded-full bg-[color:var(--vn-discovery-accent)] px-4 py-2 text-xs font-bold text-[#0A0A0A]"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <DiscoverCard key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </div>
        )}

        {page && page.hasMore && items.length > 0 ? (
          <p className="pt-2 text-center text-xs text-[#777777]">
            Showing the first {items.length} of {page.total.toLocaleString()} — narrow the filters
            to see the rest.
          </p>
        ) : null}
      </div>
    </div>
  );
}
