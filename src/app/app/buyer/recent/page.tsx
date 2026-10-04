'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock, Trash2 } from 'lucide-react';

import {
  clearRecentlyViewed, useRecentlyViewed,
} from '@/lib/buyer/recently-viewed';
import { cn } from '@/lib/utils';
import { BuyerEmptyState, BuyerSectionTitle } from '@/components/app/buyer/buyer-app-shell';

/**
 * BUYER APP · RECENTLY VIEWED.
 *
 * Reads the local history written by `useRecordOnScreen` in the feed. Because
 * that history is per-device and cleared with site data, the empty state says
 * so plainly rather than implying a cloud sync that does not exist.
 *
 * As with My sellers, the tiles are **not links**: the only product detail route
 * in this project is `/products/[productId]`, which is a website route, and
 * following it from inside the installed app would drop the buyer out of
 * `/app/buyer/*`. These become links when an app-side detail screen exists.
 */

function relativeDay(epochMs: number): string {
  const diff = Date.now() - epochMs;
  if (diff < 60_000) return 'Just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(epochMs).toLocaleDateString();
}

export default function BuyerSectionRecent() {
  const { items, ready } = useRecentlyViewed();

  return (
    <div className="vn-page-enter space-y-5 pb-2">
      <BuyerSectionTitle
        eyebrow="History"
        title="Recently viewed"
        action={
          items.length > 0 ? (
            <button
              type="button"
              onClick={clearRecentlyViewed}
              className="shrink-0 rounded-full bg-card px-3 py-1 font-sans text-[10px] font-bold uppercase tracking-widest text-muted-foreground ring-1 ring-border transition hover:text-foreground"
            >
              Clear
            </button>
          ) : undefined
        }
      />

      {!ready ? (
        <div className="space-y-2.5 px-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="vn-skeleton h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <BuyerEmptyState
          icon={Clock}
          title="Nothing here yet"
          body="Products you spend a moment on in the feed collect here, on this device only."
          action={
            <Link
              href="/app/buyer/shop"
              className="vn-buyer-card px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
            >
              Start browsing
            </Link>
          }
        />
      ) : (
        <>
          <ul className="space-y-2 px-4">
            {items.map((item) => (
              <li key={item.id} className="vn-buyer-card flex items-center gap-3 p-3">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-muted">
                  <Image
                    src={item.imageUrl || '/placeholder.svg'}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                    unoptimized
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {item.name}
                  </span>
                  <span className="mt-0.5 block font-sans text-xs font-semibold tabular-nums text-cyan-600 dark:text-cyan-300">
                    {item.price.toLocaleString()}
                  </span>
                </span>
                <span
                  className={cn(
                    'vn-micro shrink-0 text-[9px] font-bold uppercase tracking-[0.15em]',
                    'text-muted-foreground',
                  )}
                >
                  {relativeDay(item.seenAt)}
                </span>
              </li>
            ))}
          </ul>

          <p className="flex items-center justify-center gap-1.5 px-4 font-sans text-[11px] text-muted-foreground">
            <Trash2 className="h-3 w-3" />
            Stored on this device only
          </p>
        </>
      )}
    </div>
  );
}