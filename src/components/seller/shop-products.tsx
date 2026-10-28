'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Product } from '@/lib/types';
import { ProductCard } from '@/components/products/product-card';
import { ChevronRight, Search, ShoppingBag, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPlaceholderImage } from '@/lib/placeholder-images';

/**
 * The seller-shop product showcase: circular collections, the real category
 * bar, subcategory filtering, search/sort controls, the product grid and the
 * "Explore More Products" pager.
 *
 * Everything here is derived from the seller's ACTUAL product documents —
 * categories, subcategories, collection membership and counts are computed
 * from `products`, never hardcoded. Filtering and paging are client-side over
 * the list the page already loaded, so nothing is fetched twice and no product
 * can appear twice.
 */

const PAGE_SIZE = 12;
const ALL = '__all__';

type SortKey = 'featured' | 'newest' | 'price_asc' | 'price_desc';

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'featured', label: 'Featured' },
  { key: 'newest', label: 'Newest first' },
  { key: 'price_asc', label: 'Price: low to high' },
  { key: 'price_desc', label: 'Price: high to low' },
];

/** Product documents predate a `subcategory` type — read it if a doc carries it. */
type WithSubcategory = { subcategory?: string };

function subOf(product: Product): string | null {
  const raw = (product as WithSubcategory).subcategory;
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
}

/** Firestore Timestamp, Date, epoch millis or ISO string — all appear in the wild. */
function timeOf(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const v = value as { toMillis?: () => number; seconds?: number };
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function priceOf(product: Product): number {
  return product.localPrice ?? product.price ?? 0;
}

function coverImage(product: Product | undefined): string {
  const url = product?.imageUrl;
  return url && url.trim() !== '' ? url : getPlaceholderImage();
}

interface Collection {
  id: string;
  label: string;
  image: string;
}

export function ShopProducts({ products }: { products: Product[] }) {
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [activeSub, setActiveSub] = useState<string>(ALL);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('featured');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const norm = (value: string | undefined) => (value ?? '').trim().toLowerCase();
  const matchesCategory = (p: Product, category: string) =>
    norm(p.category) === norm(category);

  /* Real categories, ordered by how many products carry them. */
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const c = (p.category ?? '').trim();
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [products]);

  /* Subcategories exist only where the seller's own product docs carry them. */
  const subcategories = useMemo(() => {
    if (activeCategory === ALL) return [];
    const set = new Set<string>();
    for (const p of products) {
      const s = subOf(p);
      if (s && matchesCategory(p, activeCategory)) set.add(s);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [products, activeCategory]);

  /* Circular collections — built from real products; empty ones never render. */
  const collections = useMemo<Collection[]>(() => {
    const out: Collection[] = [];

    const newest = [...products].sort((a, b) => timeOf(b.uploadDate) - timeOf(a.uploadDate));
    if (newest.length > 0) {
      out.push({ id: 'new', label: 'New Arrivals', image: coverImage(newest[0]) });
    }

    const best = products
      .filter((p) => (p.salesCount ?? 0) > 0 || (p.likes ?? 0) > 0)
      .sort(
        (a, b) => (b.salesCount ?? 0) * 2 + (b.likes ?? 0) - ((a.salesCount ?? 0) * 2 + (a.likes ?? 0)),
      );
    if (best.length > 0) {
      out.push({ id: 'best', label: 'Best Sellers', image: coverImage(best[0]) });
    }

    for (const category of categories.slice(0, 4)) {
      const example = products.find((p) => matchesCategory(p, category));
      out.push({ id: `cat:${category}`, label: category, image: coverImage(example) });
    }

    const offers = products.filter((p) => (p.wasPrice ?? 0) > 0 && p.wasPrice! > priceOf(p));
    if (offers.length > 0) {
      out.push({ id: 'offers', label: 'Offers', image: coverImage(offers[0]) });
    }

    return out;
  }, [products, categories]);

  /* The actual filter → sort pipeline over the already-loaded products. */
  const filtered = useMemo(() => {
    let list = products;

    if (activeCollection === 'offers') {
      list = list.filter((p) => (p.wasPrice ?? 0) > 0 && p.wasPrice! > priceOf(p));
    }
    if (activeCategory !== ALL) {
      list = list.filter((p) => matchesCategory(p, activeCategory));
    }
    if (activeSub !== ALL) {
      list = list.filter((p) => subOf(p) === activeSub);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          (p.name ?? '').toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q) ||
          (p.category ?? '').toLowerCase().includes(q),
      );
    }

    const sorted = [...list];
    if (activeCollection === 'best') {
      sorted.sort(
        (a, b) =>
          (b.salesCount ?? 0) * 2 + (b.likes ?? 0) - ((a.salesCount ?? 0) * 2 + (a.likes ?? 0)),
      );
    } else if (sort === 'newest') {
      sorted.sort((a, b) => timeOf(b.uploadDate) - timeOf(a.uploadDate));
    } else if (sort === 'price_asc') {
      sorted.sort((a, b) => priceOf(a) - priceOf(b));
    } else if (sort === 'price_desc') {
      sorted.sort((a, b) => priceOf(b) - priceOf(a));
    }
    return sorted;
  }, [products, activeCollection, activeCategory, activeSub, query, sort]);

  /* Any filter change restarts paging — the same product is never shown twice. */
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [activeCategory, activeSub, activeCollection, query, sort]);

  const scrollToGrid = () => {
    const el = document.getElementById('shop-products');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const chooseCategory = (category: string) => {
    setActiveCategory(category);
    setActiveSub(ALL);
    setActiveCollection(null);
    scrollToGrid();
  };

  const applyCollection = (id: string) => {
    setActiveSub(ALL);
    setQuery('');
    if (id === 'new') {
      setActiveCategory(ALL);
      setSort('newest');
      setActiveCollection(null); // sorting already shows newest first
    } else if (id === 'best') {
      setActiveCategory(ALL);
      setSort('featured');
      setActiveCollection('best');
    } else if (id === 'offers') {
      setActiveCategory(ALL);
      setActiveCollection('offers');
    } else if (id.startsWith('cat:')) {
      setActiveCategory(id.slice(4));
      setActiveCollection(null);
    }
    scrollToGrid();
  };

  const clearFilters = () => {
    setActiveCategory(ALL);
    setActiveSub(ALL);
    setActiveCollection(null);
    setQuery('');
    setSort('featured');
  };

  const hasActiveFilter =
    activeCategory !== ALL || activeSub !== ALL || activeCollection !== null || query.trim() !== '';

  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;

  return (
    <section className="space-y-5" aria-label="Shop products">
      {/* Circular collections, from the seller's real products */}
      {collections.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-1" aria-label="Shop collections">
          {collections.map((c) => {
            const isActive =
              (c.id === 'best' && activeCollection === 'best') ||
              (c.id === 'offers' && activeCollection === 'offers') ||
              (c.id.startsWith('cat:') && activeCategory === c.id.slice(4));
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => applyCollection(c.id)}
                aria-label={`Browse ${c.label}`}
                className="group flex w-16 shrink-0 flex-col items-center gap-2 sm:w-20"
              >
                <span
                  className={cn(
                    'rounded-full p-[2px] ring-2 transition-all',
                    isActive
                      ? 'ring-[#FF2D55] shadow-[0_0_16px_rgba(255,45,85,0.75)]'
                      : 'ring-[#FF0033] group-hover:shadow-[0_0_16px_rgba(255,0,51,0.6)]',
                  )}
                >
                  {/* Plain <img>: seller media URLs are user-provided remote URLs,
                      exactly like ProductCard, so next/image is not applicable. */}
                  <img
                    src={c.image}
                    alt=""
                    onError={(e) => {
                      const el = e.currentTarget;
                      if (el.dataset.fallbackApplied === 'true') return;
                      el.dataset.fallbackApplied = 'true';
                      el.src = getPlaceholderImage();
                    }}
                    className="h-14 w-14 rounded-full object-cover sm:h-16 sm:w-16"
                  />
                </span>
                <span className="w-full text-center text-[10px] font-bold leading-tight text-neutral-300 group-hover:text-white">
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Category bar + search/filter controls */}
      <div className="flex items-center gap-2">
        <div
          className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto rounded-full"
          role="tablist"
          aria-label="Product categories"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === ALL}
            onClick={() => chooseCategory(ALL)}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors',
              activeCategory === ALL
                ? 'bg-[#FF0033] text-white shadow-[0_0_18px_rgba(255,0,51,0.5)]'
                : 'bg-white/5 text-neutral-200 hover:bg-white/10',
            )}
          >
            All Products
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={activeCategory === category}
              onClick={() => chooseCategory(category)}
              className={cn(
                'shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors',
                activeCategory === category
                  ? 'bg-[#FF0033] text-white shadow-[0_0_18px_rgba(255,0,51,0.5)]'
                  : 'bg-white/5 text-neutral-200 hover:bg-white/10',
              )}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Functional circular controls — search toggles the real search box,
            filter toggles the real sort menu. Nothing decorative. */}
        <div className="relative flex shrink-0 gap-2">
          <button
            type="button"
            aria-label={searchOpen ? 'Close product search' : 'Search products'}
            onClick={() => setSearchOpen((v) => !v)}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full border transition-colors',
              searchOpen
                ? 'border-[#FF0033] bg-[#FF0033] text-white'
                : 'border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10',
            )}
          >
            {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>
          <button
            type="button"
            aria-label="Sort products"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((v) => !v)}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full border transition-colors',
              filterOpen
                ? 'border-[#FF0033] bg-[#FF0033] text-white'
                : 'border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>

          {filterOpen && (
            <div className="absolute right-0 top-11 z-30 w-52 rounded-xl border border-white/10 bg-[#0B1220] p-2 shadow-2xl">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setSort(option.key);
                    setFilterOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold',
                    sort === option.key
                      ? 'bg-[#FF0033]/15 text-[#FF2D55]'
                      : 'text-neutral-300 hover:bg-white/5',
                  )}
                >
                  {option.label}
                  {sort === option.key && <span aria-hidden>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Real search input */}
      {searchOpen && (
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
          <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${products.length} product${products.length === 1 ? '' : 's'} in this shop`}
            aria-label="Search products in this shop"
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-neutral-500"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="text-neutral-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Subcategories — rendered only when the seller's data has them */}
      {subcategories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto" aria-label="Subcategories">
          <button
            type="button"
            aria-selected={activeSub === ALL}
            onClick={() => setActiveSub(ALL)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold transition-colors',
              activeSub === ALL
                ? 'border-[#FF2D55] bg-[#FF2D55]/15 text-[#FF2D55]'
                : 'border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10',
            )}
          >
            All
          </button>
          {subcategories.map((sub) => (
            <button
              key={sub}
              type="button"
              aria-selected={activeSub === sub}
              onClick={() => setActiveSub(sub)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold transition-colors',
                activeSub === sub
                  ? 'border-[#FF2D55] bg-[#FF2D55]/15 text-[#FF2D55]'
                  : 'border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10',
              )}
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      {/* Active filter chip */}
      {hasActiveFilter && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-neutral-300 hover:bg-white/10"
          >
            Clear filters <X className="h-3 w-3" aria-hidden />
          </button>
          <span className="text-[11px] text-neutral-500">
            {filtered.length} matching product{filtered.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {/* Product grid — 3-up on desktop/tablet, 2-up on phones, 1-up only when
          the screen truly cannot fit two readable cards. */}
      {shown.length > 0 ? (
        <div
          id="shop-products"
          className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 gap-4 scroll-mt-24"
        >
          {shown.map((product) => (
            <ProductCard key={product.id} product={product} variant="shop" />
          ))}
        </div>
      ) : (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neutral-800 bg-neutral-900/60 text-center">
          <p className="text-sm text-neutral-400">
            {products.length === 0
              ? 'This shop has not listed any products yet.'
              : 'No products match the current filters.'}
          </p>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full bg-[#FF0033] px-5 py-2 text-xs font-bold text-white hover:bg-[#e6002d]"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Explore more — reveals the next page of the SAME loaded list, no re-fetch, no duplicates */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF0033] to-[#FF2D55] py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-[0_0_25px_rgba(255,0,51,0.4)] transition-transform hover:scale-[1.01]"
        >
          <ShoppingBag className="h-4 w-4" aria-hidden />
          Explore More Products
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      )}
    </section>
  );
}
