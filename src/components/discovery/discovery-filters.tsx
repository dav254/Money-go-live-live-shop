'use client';

/**
 * DISCOVERY — search and filters.
 *
 * A sheet rather than a page, because a filter screen that navigates away
 * loses the feed behind it and every "back" costs a re-render of the whole
 * catalogue. Everything applies on top of what the buyer is already looking at.
 *
 * ## Location is optional, and stays optional
 * The listing model has no coordinates — sellers publish an area name — so
 * matching an actual GPS position to a listing would be theatre. The field is
 * free text with a few one-tap suggestions, permission is never requested, and
 * leaving it blank simply means "anywhere". That is an honest Nearby: it uses
 * what the data actually holds instead of pretending to know where a shop is.
 */

import * as React from 'react';
import { MapPin, RotateCcw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { EMPTY_FILTERS, type DiscoveryFilters, type DiscoverySort } from '@/lib/discovery';

const SUGGESTED_AREAS = ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Nairobi West'];

const inputClass =
  'h-11 rounded-xl border-white/12 bg-white/8 text-sm text-white placeholder:text-white/40 focus-visible:ring-[color:var(--vn-discovery-accent)]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">
        {label}
      </span>
      {children}
    </label>
  );
}

function SortChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--vn-discovery-accent)]',
        active
          ? 'border-[color:var(--vn-discovery-accent)] bg-[color:var(--vn-discovery-accent)] text-[#0A0A0A]'
          : 'border-white/12 bg-white/6 text-white/70 hover:border-white/35 hover:text-white',
      )}
    >
      {children}
    </button>
  );
}

export function DiscoveryFilterSheet({
  open,
  onOpenChange,
  filters,
  onChange,
  resultCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: DiscoveryFilters;
  onChange: (next: DiscoveryFilters) => void;
  resultCount: number;
}) {
  const [draft, setDraft] = React.useState<DiscoveryFilters>(filters);

  // Re-seed from the live filters every time the sheet opens, so a dismissal
  // cannot leave the panel showing values the feed never applied.
  React.useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const patch = (part: Partial<DiscoveryFilters>) => setDraft((prev) => ({ ...prev, ...part }));

  const parsePrice = (value: string): number | null => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="vn-discovery-scope h-[88dvh] gap-0 overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#0A0A0A] p-0 text-white"
      >
        <SheetHeader className="flex-row items-center justify-between border-b border-white/10 px-5 pb-3 pt-6">
          <SheetTitle className="font-grotesk text-base font-bold text-white">Search &amp; filters</SheetTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close filters"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </SheetHeader>

        <div className="h-[calc(88dvh-8rem)] space-y-6 overflow-y-auto px-5 py-5">
          <Field label="Search">
            <Input
              value={draft.query}
              onChange={(e) => patch({ query: e.target.value })}
              placeholder="Products, services, businesses…"
              className={inputClass}
            />
          </Field>

          <div>
            <Field label="Location">
              <Input
                value={draft.location}
                onChange={(e) => patch({ location: e.target.value })}
                placeholder="Anywhere"
                className={inputClass}
              />
            </Field>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTED_AREAS.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => patch({ location: draft.location === area ? '' : area })}
                  className={cn(
                    'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition',
                    draft.location === area
                      ? 'border-[color:var(--vn-discovery-accent)] bg-[color:var(--vn-discovery-accent)] text-[#0A0A0A]'
                      : 'border-white/12 bg-white/6 text-white/60 hover:border-white/35 hover:text-white',
                  )}
                >
                  <MapPin className="h-3 w-3" aria-hidden />
                  {area}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-white/45">
              Optional. Leave it blank to search everywhere — Vidnov never asks for your device
              location here.
            </p>
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">
              Price range
            </span>
            <div className="flex items-center gap-2">
              <Input
                inputMode="numeric"
                value={draft.minPrice ?? ''}
                onChange={(e) => patch({ minPrice: parsePrice(e.target.value) })}
                placeholder="Min"
                aria-label="Minimum price"
                className={inputClass}
              />
              <span className="text-white/40">–</span>
              <Input
                inputMode="numeric"
                value={draft.maxPrice ?? ''}
                onChange={(e) => patch({ maxPrice: parsePrice(e.target.value) })}
                placeholder="Max"
                aria-label="Maximum price"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">
              Sort by
            </span>
            <div className="flex flex-wrap gap-2">
              {(['newest', 'popular'] as DiscoverySort[]).map((sort) => (
                <SortChip key={sort} active={draft.sort === sort} onClick={() => patch({ sort })}>
                  {sort === 'newest' ? 'Newest' : 'Popular'}
                </SortChip>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-white/12 bg-white/6 p-4">
            <input
              type="checkbox"
              checked={draft.availableOnly}
              onChange={(e) => patch({ availableOnly: e.target.checked })}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--vn-discovery-accent)]"
            />
            <span>
              <span className="block text-[13px] font-semibold text-white">Available only</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-white/50">
                Hide listings that are out of stock or fully booked.
              </span>
            </span>
          </label>

          <p className="text-[11px] text-white/50">
            {resultCount === 0
              ? 'Nothing matches these filters yet.'
              : `${resultCount} listing${resultCount === 1 ? '' : 's'} match.`}
          </p>
        </div>

        <div className="shrink-0 border-t border-white/10 bg-[#0A0A0A] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setDraft({ ...EMPTY_FILTERS, sort: draft.sort })}
              className="h-11 flex-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-white/60 hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
            <Button
              onClick={() => {
                onChange(draft);
                onOpenChange(false);
              }}
              className="h-11 flex-[2] rounded-full bg-[color:var(--vn-discovery-accent)] text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A] hover:bg-[color:var(--vn-discovery-accent-hover)]"
            >
              Show results
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * The strip under the rail showing what is currently on, switchable without
 * opening the sheet. A filter that can only be inspected by opening a modal is
 * a filter nobody turns off.
 */
export function ActiveFilterStrip({
  filters,
  onChange,
}: {
  filters: DiscoveryFilters;
  onChange: (next: DiscoveryFilters) => void;
}) {
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.query.trim()) {
    chips.push({ key: 'q', label: `“${filters.query.trim()}”`, clear: () => onChange({ ...filters, query: '' }) });
  }
  if (filters.location.trim()) {
    chips.push({ key: 'loc', label: filters.location.trim(), clear: () => onChange({ ...filters, location: '' }) });
  }
  if (filters.minPrice !== null || filters.maxPrice !== null) {
    chips.push({
      key: 'price',
      label: `${filters.minPrice ?? 0} – ${filters.maxPrice ?? 'any'}`,
      clear: () => onChange({ ...filters, minPrice: null, maxPrice: null }),
    });
  }
  if (filters.availableOnly) {
    chips.push({ key: 'avail', label: 'Available', clear: () => onChange({ ...filters, availableOnly: false }) });
  }
  if (filters.sort !== 'newest') {
    chips.push({ key: 'sort', label: 'Popular', clear: () => onChange({ ...filters, sort: 'newest' }) });
  }

  if (chips.length === 0) return null;

  return (
    <div className="scrollbar-hide flex shrink-0 gap-1.5 overflow-x-auto border-b border-white/8 px-4 py-2 sm:px-6">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.clear}
          aria-label={`Remove filter ${chip.label}`}
          className="flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--vn-discovery-accent)] px-3 py-1 text-[10px] font-semibold text-[#0A0A0A] transition hover:bg-[color:var(--vn-discovery-accent-hover)]"
        >
          {chip.label}
          <X className="h-3 w-3" aria-hidden />
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange({ ...EMPTY_FILTERS })}
        className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-[10px] font-semibold text-white/60 transition hover:border-white/40 hover:text-white"
      >
        Clear all
      </button>
    </div>
  );
}
