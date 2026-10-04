'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell, ChevronRight } from 'lucide-react';
import { collection, limit, query, where } from 'firebase/firestore';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import { BuyerEmptyState, BuyerSectionTitle } from '@/components/app/buyer/buyer-app-shell';

/**
 * BUYER APP · NOTIFICATIONS.
 *
 * The website's notification centre lives inside the shared header. The app
 * gives it a screen inside the buyer section, reading only this user's own
 * notifications — the query is equality-filtered on `userId`, which is all the
 * Firestore rules allow on that collection. Never a bare `list()`.
 *
 * ## Why every link is remapped, and why an unknown link is dropped
 *
 * Notification `link` values are written by Cloud Functions and by admin API
 * routes, and they are all **website** routes — the literals in this repo are
 * `/buyer/my-orders`, `/dashboard/seller/orders`, `/dashboard/reseller/…`,
 * `/dashboard/security`, `/invoice/{id}` and `/requests/{id}`. Following one
 * verbatim inside the installed app drops the buyer out of `/app/buyer/*` and
 * into the website's desktop layout on a single tap.
 *
 * So `toAppHref` maps the buyer-relevant ones into this section and returns
 * `null` for everything else — a seller or reseller alert has no buyer screen to
 * land on, so the row renders without a link rather than ejecting the app. That
 * is the whole point: a notification the buyer cannot act on in-app is shown,
 * but tapping it does nothing, instead of breaking the app's illusion.
 */

interface BuyerNotification {
  id: string;
  type?: string;
  title?: string;
  message?: string;
  link?: string;
  status?: string;
  timestamp?: unknown;
}

/** Notification-link literals observed in this repo, mapped to buyer app routes. */
const APP_ROUTE_BY_LINK: Record<string, string> = {
  '/buyer/my-orders': '/app/buyer/orders',
  '/buyer/orders': '/app/buyer/orders',
  '/buyer/dashboard': '/app/buyer',
  '/buyer/requests': '/app/buyer/requests',
  '/buyer/wishlist': '/app/buyer/shop?view=saved',
  '/buyer/wallet': '/app/buyer/wallet',
  '/buyer/help': '/app/buyer/care',
  '/buyer/live': '/app/buyer/live',
  '/dashboard/security': '/app/buyer/account',
  '/dashboard/notifications': '/app/buyer/notifications',
};

/**
 * Resolve a stored notification link to a route inside the buyer section, or
 * `null` when there is nowhere in-app for it to go. Never returns the raw value.
 */
function toAppHref(raw: string | undefined): string | null {
  if (!raw || !raw.startsWith('/')) return null;

  // Already an app route — pass it through unchanged.
  if (raw === '/app' || raw.startsWith('/app/')) return raw;

  if (APP_ROUTE_BY_LINK[raw]) return APP_ROUTE_BY_LINK[raw];

  // `/invoice/{orderId}` and `/requests/{id}` both point at an order or a
  // brief; in the app those live on the orders and requests screens.
  if (raw.startsWith('/invoice/')) return '/app/buyer/orders';
  if (raw.startsWith('/requests/')) return '/app/buyer/requests';
  if (raw.startsWith('/orders/')) return '/app/buyer/orders';
  if (raw.startsWith('/messages')) return '/app/buyer/orders';

  // Anything else — seller dashboards, reseller pages, admin — has no buyer
  // destination. Refuse to link out.
  return null;
}

function toMillis(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in (value as { toMillis?: unknown })) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return 0;
}

function relativeTime(value: unknown): string {
  const ms = toMillis(value);
  if (!ms) return '';
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

export default function BuyerSectionNotifications() {
  const { user } = useUser();
  const firestore = useFirestore();

  const notificationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    // No `orderBy` on purpose: an equality filter plus a range on a different
    // field would need a composite index this project has not provisioned.
    return query(
      collection(firestore, 'notifications'),
      where('userId', '==', user.uid),
      limit(50),
    );
  }, [firestore, user]);

  const { data: rawNotifications, isLoading } = useCollection<BuyerNotification>(notificationsQuery);

  const notifications = React.useMemo(
    () =>
      (rawNotifications ?? [])
        .slice()
        .sort((a, b) => toMillis(b.timestamp) - toMillis(a.timestamp)),
    [rawNotifications],
  );

  const unread = notifications.filter((n) => n.status === 'unread').length;

  return (
    <div className="vn-page-enter space-y-5 pb-2">
      <BuyerSectionTitle
        eyebrow="Inbox"
        title="Notifications"
        action={
          unread > 0 ? (
            <span className="shrink-0 rounded-full bg-cyan-400/15 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-300">
              {unread} new
            </span>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-2.5 px-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="vn-skeleton h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <BuyerEmptyState
          icon={Bell}
          title="Nothing yet"
          body="Order updates, offers on your requests and seller replies all land here as they happen."
          action={
            <Link
              href="/app/buyer"
              className="vn-buyer-card px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
            >
              Back to home
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2 px-4">
          {notifications.map((item) => {
            const isUnread = item.status === 'unread';
            const href = toAppHref(item.link);
            const body = (
              <div
                className={cn(
                  'vn-buyer-card flex w-full items-start gap-3 p-3.5 text-left transition',
                  isUnread && 'ring-1 ring-inset ring-cyan-400/40',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl',
                    isUnread
                      ? 'bg-gradient-to-br from-cyan-400/20 to-violet-500/25 text-cyan-600 dark:text-cyan-300'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Bell className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold leading-snug text-foreground">
                      {item.title || 'Notification'}
                    </span>
                    {isUnread && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />
                    )}
                  </span>
                  {item.message && (
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {item.message}
                    </span>
                  )}
                  <span className="vn-micro mt-1.5 block text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {relativeTime(item.timestamp)}
                    {item.type ? ` · ${item.type}` : ''}
                  </span>
                </span>
                {href && (
                  <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </div>
            );

            return (
              <li key={item.id}>
                {href ? (
                  <Link href={href} className="block">
                    {body}
                  </Link>
                ) : (
                  // No in-app destination: shown, but not a link. Following the
                  // stored website path would eject the buyer from the app.
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}