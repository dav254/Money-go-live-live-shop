'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Users,
  Receipt,
  Settings,
  LifeBuoy,
  BarChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ADMIN CONSOLE TAB BAR.
 *
 * The admin console is its own application, so it gets its own navigation —
 * and deliberately none of the consumer sections. There is no Shop, Cart,
 * Requests or Live here: an administrator works the platform, they do not shop
 * on it. That separation is the point of a separate app.
 *
 * Tabs point at the real admin routes, so this is navigation only — every
 * screen underneath is the same admin page used on the website.
 */
const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid, href: '/dashboard/admin' },
  { key: 'users', label: 'Users', icon: Users, href: '/dashboard/admin/users/buyers' },
  { key: 'orders', label: 'Orders', icon: Receipt, href: '/dashboard/admin/orders/all' },
  { key: 'support', label: 'Support', icon: LifeBuoy, href: '/dashboard/admin/support/complaints' },
  { key: 'system', label: 'System', icon: Settings, href: '/dashboard/admin/system/server-status' },
  { key: 'logs', label: 'Logs', icon: BarChart, href: '/dashboard/admin/analytics/activity' },
];

export function AdminAppTabBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    !!pathname && (pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-label={tab.label}
            aria-current={isActive(tab.href) ? 'page' : undefined}
            className="flex flex-1 flex-col items-center gap-0.5 px-1 py-1"
          >
            <tab.icon
              className={cn('h-5 w-5', isActive(tab.href) ? 'text-primary' : 'text-muted-foreground')}
            />
            <span
              className={cn(
                'text-[9px] font-semibold uppercase tracking-wide',
                isActive(tab.href) ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {tab.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}