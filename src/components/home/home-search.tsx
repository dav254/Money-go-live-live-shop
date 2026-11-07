'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Search } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * UNIVERSAL HOMEPAGE SEARCH.
 *
 * This is not a decorative field: it submits to `/discover`, the platform's
 * public discovery surface, and forwards the same parameters that surface
 * already validates (`q`, `kind`, `location`). Businesses, products, services
 * and locations are all resolved there by `searchDiscover()` — there is no
 * second search backend behind this box.
 */

type Kind = 'all' | 'businesses' | 'listings';

const KINDS: { value: Kind; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'businesses', label: 'Businesses' },
  { value: 'listings', label: 'Products & services' },
];

export function HomeSearch({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const router = useRouter();
  const [term, setTerm] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [kind, setKind] = React.useState<Kind>('all');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    const q = term.trim();
    const where = location.trim();
    if (q) params.set('q', q);
    if (where) params.set('location', where);
    if (kind !== 'all') params.set('kind', kind);
    router.push(params.toString() ? `/discover?${params.toString()}` : '/discover');
  };

  const light = variant === 'light';

  return (
    <form onSubmit={submit} role="search" aria-label="Search Vidnov" className="w-full">
      <div
        className={cn(
          'flex flex-col gap-2 rounded-[22px] border p-2 sm:flex-row sm:items-center sm:rounded-full sm:p-1.5',
          light
            ? 'border-black/10 bg-white shadow-[0_18px_50px_rgba(10,10,12,0.10)]'
            : 'border-white/12 bg-white/[0.06] shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl',
        )}
      >
        <label className="flex min-w-0 flex-1 items-center gap-2.5 px-3.5 py-2">
          <Search
            className={cn('h-4 w-4 shrink-0', light ? 'text-black/40' : 'text-white/45')}
            aria-hidden
          />
          <span className="sr-only">What are you looking for?</span>
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="What are you looking for today?"
            aria-label="Search businesses, products, services and categories"
            className={cn(
              'w-full min-w-0 bg-transparent text-sm outline-none',
              light
                ? 'text-[#0B0B0C] placeholder:text-black/40'
                : 'text-white placeholder:text-white/40',
            )}
          />
        </label>

        <span
          aria-hidden
          className={cn('hidden h-6 w-px sm:block', light ? 'bg-black/10' : 'bg-white/12')}
        />

        <label className="flex min-w-0 items-center gap-2 px-3.5 py-2 sm:w-[190px]">
          <MapPin
            className={cn('h-4 w-4 shrink-0', light ? 'text-black/40' : 'text-white/45')}
            aria-hidden
          />
          <span className="sr-only">Location</span>
          <input
            type="search"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="City or county"
            aria-label="Filter by location"
            className={cn(
              'w-full min-w-0 bg-transparent text-sm outline-none',
              light
                ? 'text-[#0B0B0C] placeholder:text-black/40'
                : 'text-white placeholder:text-white/40',
            )}
          />
        </label>

        <button
          type="submit"
          className="h-11 shrink-0 rounded-full bg-[#FF4D2E] px-6 text-[11px] font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#e63f21] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4D2E]"
        >
          Search
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Search scope">
        {KINDS.map((option) => {
          const active = kind === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setKind(option.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-[11px] font-medium transition-colors',
                active
                  ? 'border-[#FF4D2E]/60 bg-[#FF4D2E]/12 text-[#FF4D2E]'
                  : light
                    ? 'border-black/10 text-black/55 hover:border-black/25 hover:text-black'
                    : 'border-white/12 text-white/55 hover:border-white/30 hover:text-white',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </form>
  );
}
