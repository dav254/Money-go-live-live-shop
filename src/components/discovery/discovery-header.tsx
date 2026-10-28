'use client';

/**
 * DISCOVERY — the single header bar.
 *
 * One bar, one row, no duplicates — and only where there is no shell header
 * to take its place. On `/app/*` the shell's own top bar IS the header (it
 * carries the hamburger, the Vidnov name and the search button), so
 * `DiscoverySection` renders this bar only on the website route, which has no
 * shell. Two things were deliberately dropped from here: the lane rail (For
 * You · Products · Services · Businesses — it read as a second header) and
 * the account chip (the account lives in the shell header / bottom bar).
 *
 * What is left: the logo — the name, exactly where it was — and the
 * search/filters button, which opens the filter sheet (search lives there).
 *
 * The accent is not hard-coded: it is `--vn-discovery-accent`, declared on
 * `.vn-discovery-scope` in `globals.css` (lime, the section's fixed identity) —
 * so an active chip, a focus ring and a primary button are always the same
 * colour as each other.
 */

import * as React from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import { activeFilterCount, type DiscoveryFilters } from '@/lib/discovery';

/* ── Small round action button ──────────────────────────────────────────── */

function IconButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
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
}: {
  filters: DiscoveryFilters;
  onOpenFilters: () => void;
}) {
  const filterCount = activeFilterCount(filters);

  return (
    <div className="vn-discovery-topbar relative z-40 shrink-0 border-b border-[rgba(0,229,255,0.15)] bg-[#050a16]/92 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-2.5 sm:px-6">
        <Link href="/" aria-label="Vidnov home" className="shrink-0 rounded-sm">
          <Logo className="text-[18px] leading-none sm:text-[22px]" />
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
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
        </div>
      </div>
    </div>
  );
}
