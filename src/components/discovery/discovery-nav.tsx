'use client';

/**
 * DISCOVERY — bottom tab bar.
 *
 * Only rendered on the app surfaces. The website has its own header and
 * sidebar; the app's shell hides its own tab bar on immersive routes (which
 * Discovery is, because the feed has to own the whole viewport), so without
 * this bar a buyer three listings deep has no way home and no way to search.
 *
 * It is deliberately not the shell's bar re-skinned. The shell's slots are
 * section-specific; these are the five destinations a person browsing a feed
 * actually wants, with the active one in the brand lime.
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface DiscoveryNavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Match the section root exactly rather than by prefix. */
  exact?: boolean;
  /** Renders the raised centre button, as in the reference. */
  raised?: boolean;
}

export function DiscoveryBottomNav({ items }: { items: DiscoveryNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="App navigation"
      className="relative z-40 shrink-0 border-t border-white/8 bg-[#0A0A0A]/95 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-md items-end justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {items.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 px-1 py-1 transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E53935]',
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full transition',
                  isActive
                    ? 'bg-[#E53935] text-white'
                    : 'text-white/60 group-hover:text-white',
                  item.raised && !isActive && 'border border-white/15',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span
                className={cn(
                  'vn-micro text-[9px] font-semibold uppercase tracking-[0.12em]',
                  isActive ? 'text-[#E53935]' : 'text-white/55',
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
