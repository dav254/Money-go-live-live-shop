'use client';

/**
 * DISCOVER · CLIENT SHELL.
 *
 * The server renders the first page, so the initial view is real HTML rather
 * than a spinner. This component then owns the interactive part: typing,
 * filters, location, paging.
 *
 * Filter state lives in the URL. That makes a discovery view shareable and
 * gives every filter combination a canonical address — the page is indexable
 * because its content is addressable.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Loader2,
  LocateFixed,
  PackageSearch,
  Search,
  Store,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DiscoverCard } from '@/components/discover/result-cards';
import type {
  DiscoverAvailability,
  DiscoverKindFilter,
  DiscoverPage,
  DiscoverSort,
} from '@/lib/discover/search';
import { productCategoryOptions, serviceCategoryOptions } from '@/lib/discover/categories';

export interface DiscoverQueryState {
  q: string;
  kind: DiscoverKindFilter;
  category?: string;
  location?: string;
  availability: DiscoverAvailability;
  sort: DiscoverSort;
}

interface Props {
  initial: DiscoverPage | null;
  initialError: string | null;
  initialState: DiscoverQueryState;
  counties: string[];
}

const KIND_TABS: Array<{ id: DiscoverKindFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'businesses', label: 'Businesses' },
  { id: 'listings', label: 'Products & Services' },
];

function buildParams(
  state: DiscoverQueryState,
  coords: { lat: number; lng: number } | null,
  page: number,
): URLSearchParams {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.kind !== 'all') params.set('kind', state.kind);
  if (state.category) params.set('category', state.category);
  if (state.location) params.set('location', state.location);
  if (state.availability === 'available') params.set('availability', 'available');
  if (state.sort !== 'relevance') params.set('sort', state.sort);
  if (coords) {
    params.set('lat', coords.lat.toFixed(4));
    params.set('lng', coords.lng.toFixed(4));
  }
  if (page > 1) params.set('page', String(page));
  return params;
}

export function DiscoverShell({ initial, initialError, initialState, counties }: Props) {
  const router = useRouter();

  const [qText, setQText] = useState(initialState.q);
  const [query, setQuery] = useState(initialState.q);
  const [kind, setKind] = useState<DiscoverKindFilter>(initialState.kind);
  const [category, setCategory] = useState(initialState.category ?? '');
  const [location, setLocation] = useState(initialState.location ?? '');
  const [availability, setAvailability] = useState<DiscoverAvailability>(initialState.availability);
  const [sort, setSort] = useState<DiscoverSort>(initialState.sort);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoNote, setGeoNote] = useState<string | null>(null);

  const [data, setData] = useState<DiscoverPage | null>(initial);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  /** Bumped by "Try again" so a retry runs even when no filter changed. */
  const [reloadKey, setReloadKey] = useState(0);

  const state: DiscoverQueryState = {
    q: query,
    kind,
    category: category || undefined,
    location: location || undefined,
    availability,
    sort,
  };
  const signature = JSON.stringify([state, coords, reloadKey]);

  const firstRun = useRef(true);
  const initialSignature = useRef(JSON.stringify([initialState, null, 0]));

  // Debounce typing so a search runs when the customer pauses, not per keypress.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(qText.trim()), 300);
    return () => clearTimeout(timer);
  }, [qText]);

  const fetchPage = useCallback(
    async (page: number, signal: AbortSignal): Promise<DiscoverPage> => {
      const params = buildParams(state, coords, page);
      const response = await fetch(`/api/discover?${params.toString()}`, { signal });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Discovery is temporarily unavailable.');
      }
      return (await response.json()) as DiscoverPage;
    },
    // `state` and `coords` are recreated each render; `signature` is the stable
    // identity of their contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      // The server already rendered exactly this query — no duplicate request.
      if (initial && signature === initialSignature.current) return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchPage(1, controller.signal)
      .then((next) => {
        setData(next);
        router.replace(`/discover?${buildParams(state, coords, 1).toString()}`, { scroll: false });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Discovery is temporarily unavailable.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const loadMore = async () => {
    if (!data?.hasMore || loadingMore) return;
    const nextPage = data.page + 1;
    setLoadingMore(true);
    const controller = new AbortController();
    try {
      const next = await fetchPage(nextPage, controller.signal);
      setData((current) =>
        current
          ? {
              ...next,
              items: [...current.items, ...next.items],
              page: nextPage,
              hasMore: next.hasMore,
            }
          : next,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more results.');
    } finally {
      setLoadingMore(false);
    }
  };

  const useMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoNote('This browser cannot share a location.');
      return;
    }
    setGeoNote('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setSort('nearby');
        setGeoNote('Sorted by distance. Only public business locations are measured.');
      },
      () => {
        setGeoNote('Location permission was declined — choose a county instead.');
      },
      { timeout: 8000, maximumAge: 300_000 },
    );
  };

  const clearAll = () => {
    setQText('');
    setQuery('');
    setKind('all');
    setCategory('');
    setLocation('');
    setAvailability('any');
    setSort('relevance');
    setCoords(null);
    setGeoNote(null);
  };

  const hasFilters = Boolean(query || category || location || availability === 'available' || coords);
  const empty = !loading && !error && data !== null && data.items.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      {/* Search + filters */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(qText.trim());
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={qText}
              onChange={(event) => setQText(event.target.value)}
              placeholder="Search businesses, products and services…"
              aria-label="Search businesses, products and services"
              maxLength={120}
              className="h-11 pl-9 pr-9"
            />
            {qText ? (
              <button
                type="button"
                onClick={() => setQText('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <Button type="submit" className="h-11 shrink-0">
            Search
          </Button>
        </form>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Result type">
          {KIND_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={kind === tab.id}
              onClick={() => setKind(tab.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                kind === tab.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="sr-only" htmlFor="discover-category">
            Category
          </label>
          <select
            id="discover-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All categories</option>
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

          <label className="sr-only" htmlFor="discover-location">
            Location
          </label>
          <select
            id="discover-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All locations</option>
            {counties.map((county) => (
              <option key={county} value={county}>
                {county}
              </option>
            ))}
          </select>

          <select
            aria-label="Sort results"
            value={sort}
            onChange={(event) => setSort(event.target.value as DiscoverSort)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="relevance">Most relevant</option>
            <option value="newest">Newest</option>
            <option value="nearby" disabled={!coords}>
              Nearest
            </option>
          </select>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={availability === 'available' ? 'default' : 'outline'}
              size="sm"
              aria-pressed={availability === 'available'}
              onClick={() => setAvailability(availability === 'available' ? 'any' : 'available')}
              className="h-9 flex-1 text-xs"
            >
              Available now
            </Button>
            <Button
              type="button"
              variant={coords ? 'default' : 'outline'}
              size="sm"
              onClick={useMyLocation}
              className="h-9 shrink-0 px-2"
              aria-label="Use my location"
              title="Use my location"
            >
              <LocateFixed className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {geoNote ? <p className="mt-2 text-xs text-muted-foreground">{geoNote}</p> : null}

        {hasFilters ? (
          <div className="mt-2 flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 px-2 text-xs">
              <X className="mr-1 h-3 w-3" />
              Clear filters
            </Button>
            {data ? (
              <span className="text-xs text-muted-foreground">
                {data.total} {data.total === 1 ? 'result' : 'results'}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Results */}
      <div className="pt-5">
        {loading ? (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-busy="true"
            aria-label="Loading results"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-56 animate-pulse rounded-xl border border-border/60 bg-muted/60"
              />
            ))}
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-red-600" />
            <h2 className="font-semibold text-red-800">Discovery is unavailable</h2>
            <p className="mt-1 text-sm text-red-700/80">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setError(null);
                setReloadKey((value) => value + 1);
              }}
            >
              Try again
            </Button>
          </div>
        ) : null}

        {empty ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <PackageSearch className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              {hasFilters ? 'Nothing matches that yet' : 'Nobody has published yet'}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {hasFilters
                ? 'No seller has published something that matches this search. That is a real gap in the marketplace rather than an error — a request tells sellers exactly what to add.'
                : 'The marketplace is still empty. Sellers who publish products, services or a business profile will appear here immediately.'}
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <Button asChild>
                <Link href="/requests">Post a buyer request</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/signup">
                  <Store className="mr-2 h-4 w-4" />
                  Sell on Vidnov
                </Link>
              </Button>
            </div>
          </div>
        ) : null}

        {!loading && !error && data && data.items.length > 0 ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {data.businesses} {data.businesses === 1 ? 'business' : 'businesses'}
              </Badge>
              <Badge variant="secondary">
                {data.listings} {data.listings === 1 ? 'listing' : 'listings'}
              </Badge>
              {data.windowCapped ? (
                <span className="text-xs text-muted-foreground">
                  Showing the most recent {data.scanned} listings searched
                </span>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((item) => (
                <DiscoverCard key={`${item.kind}-${item.id}`} item={item} />
              ))}
            </div>

            {data.hasMore ? (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    'Load more'
                  )}
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
