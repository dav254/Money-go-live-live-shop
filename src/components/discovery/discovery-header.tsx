'use client';

/**
 * DISCOVERY — the single header bar.
 *
 * One bar, not three. Identity, lanes and search used to stack into three
 * separately-pinned rows, which ate a third of a phone viewport before a
 * single listing was on screen. Everything now lives on one row: the logo,
 * the lane rail (which scrolls horizontally), search/filters and the account
 * chip. Search itself moved into the filter sheet, which already carries a
 * search field — a duplicate input row was the third bar's only real job.
 *
 * The lane rail is still the circular picker from the reference: an icon in a
 * circle, the label under it, the active lane a filled accent circle with an
 * underlined label. It reads as a row of destinations, not a filter chip list.
 *
 * The accent is not hard-coded: it is `--vn-discovery-accent`, set per
 * audience (blue for buyers, orange for sellers) by `DiscoverySection`.
 */

import * as React from 'react';
import Link from 'next/link';
import { Loader2, Search, UserRound } from 'lucide-react';

import { Logo } from '@/components/logo';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import {
  DISCOVERY_CATEGORIES,
  activeFilterCount,
  type DiscoveryCategory,
  type DiscoveryFilters,
} from '@/lib/discovery';

/* ── Small round action button ──────────────────────────────────────────── */

function IconButton({
  label,
  href,
  onClick,
  active,
  children,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  const className = cn(
    'relative flex h-9 w-9 items-center justify-center rounded-full border transition',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--vn-discovery-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]',
    active
      ? 'border-[color:var(--vn-discovery-accent)] bg-[color:var(--vn-discovery-accent)] text-[#0A0A0A]'
      : 'border-white/12 bg-white/6 text-white hover:border-white/35 hover:bg-white/12',
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={className}>
      {children}
    </button>
  );
}

/* ── The pinned bar ─────────────────────────────────────────────────────── */

export function DiscoveryTopBar({
  filters,
  onOpenFilters,
  activeCategory,
  onSelectCategory,
}: {
  filters: DiscoveryFilters;
  onOpenFilters: () => void;
  activeCategory: DiscoveryCategory['id'];
  onSelectCategory: (id: DiscoveryCategory['id']) => void;
}) {
  const { user, isLoading } = useUser();
  const railRef = React.useRef<HTMLDivElement>(null);
  const filterCount = activeFilterCount(filters);

  React.useEffect(() => {
    const el = railRef.current?.querySelector<HTMLElement>(`[data-category="${activeCategory}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeCategory]);

  return (
    <div className="vn-discovery-topbar relative z-40 shrink-0 border-b border-white/8 bg-[#0A0A0A]/92 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-2.5 sm:px-6">
        <Link href="/" aria-label="Vidnov home" className="shrink-0 rounded-sm">
          <Logo className="text-[18px] leading-none sm:text-[22px]" />
        </Link>

        {/* Lane rail — the bar's reason to exist. Circular destinations,
            horizontally scrollable, never wrapped. */}
        <nav aria-label="Discovery categories" className="min-w-0 flex-1">
          <div
            ref={railRef}
            className="scrollbar-hide flex items-start gap-2 overflow-x-auto py-0.5"
          >
            {DISCOVERY_CATEGORIES.map((category) => {
              const isActive = category.id === activeCategory;
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  type="button"
                  data-category={category.id}
                  data-active={isActive}
                  onClick={() => onSelectCategory(category.id)}
                  aria-pressed={isActive}
                  className="group flex w-12 shrink-0 flex-col items-center gap-1 focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full transition',
                      'group-focus-visible:ring-2 group-focus-visible:ring-[color:var(--vn-discovery-accent)]',
                      isActive
                        ? 'bg-[color:var(--vn-discovery-accent)] text-[#0A0A0A]'
                        : 'bg-white/8 text-white/85 group-hover:bg-white/14',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span
                    className={cn(
                      'vn-micro text-center text-[9px] font-semibold leading-tight',
                      isActive
                        ? 'text-[color:var(--vn-discovery-accent)] underline decoration-[color:var(--vn-discovery-accent)] underline-offset-2'
                        : 'text-white/60 group-hover:text-white/85',
                    )}
                  >
                    {category.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <IconButton
            label={
              filterCount
                ? `Search & filters, ${filterCount} active`
                : 'Search & filters'
            }
            onClick={onOpenFilters}
            active={filterCount > 0}
          >
            <Search className="h-4 w-4" />
            {filterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-[#0A0A0A] ring-2 ring-[#0A0A0A]">
                {filterCount}
              </span>
            )}
          </IconButton>

          {isLoading ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/6">
              <Loader2 className="h-4 w-4 animate-spin text-white/70" />
            </span>
          ) : (
            <IconButton
              label={user ? 'Your account' : 'Sign in'}
              href={user ? '/dashboard/account' : '/login?returnTo=%2Fbuyer%2Fdiscovery'}
              active={!!user}
            >
              {user ? (
                <span className="text-[11px] font-bold uppercase">
                  {(user.displayName || user.email || 'You').charAt(0)}
                </span>
              ) : (
                <UserRound className="h-4 w-4" />
              )}
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );
}
