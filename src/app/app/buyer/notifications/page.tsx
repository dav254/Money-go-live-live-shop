'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, ChevronRight, Settings } from 'lucide-react';

import { useNotifications } from '@/lib/notifications/use-notifications';
import { cn } from '@/lib/utils';
import { BuyerEmptyState, BuyerSectionTitle } from '@/components/app/buyer/buyer-app-shell';

/**
 * BUYER APP · NOTIFICATIONS.
 *
 * The website's notification centre lives inside the shared header. The app
 * gives it a screen inside the buyer section, fed by the VPS-backed
 * `/api/notifications` routes — the API derives the uid from the verified
 * token and returns only that user's records, so one buyer can never see
 * another's alerts (never a bare collection list, never a userId parameter).
 *
 * Live updates come from the hook's polling (interval + focus + visibility),
 * so a new order alert lands without a refresh. Tapping a row marks it read;
 * the header offers "mark all read" and a shortcut to notification settings.
 *
 * ## Why every link is remapped, and why an unknown link is dropped
 *
 * Notification `link` values are written by server-side writers and by admin
 * API routes, and they are all **website** routes — the literals in this repo
 * are `/buyer/my-orders`, `/dashboard/seller/orders`, `/dashboard/reseller/…`,
 * `/dashboard/security`, `/invoice/{id}` and `/requests/{id}`. Following one
 * verbatim inside the installed app drops the buyer out of `/app/buyer/*` and
 * into the website's desktop layout on a single tap.
 *
 * So `toAppHref` maps the buyer-relevant ones into this section and returns
 * `null` for everything else — a seller or reseller alert has no buyer screen
 * to land on, so the row renders without a link rather than ejecting the app.
 * That is the whole point: a notification the buyer cannot act on in-app is
 * shown, but tapping it does nothing, instead of breaking the app's illusion.
 */

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

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
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
  const router = useRouter();
  const { items, unread, isLoading, markRead, markAllRead } = useNotifications({
    limit: 50,
    pollMs: 30_000,
  });

  const notifications = items;

  /** Tapping anywhere on a row opens it (when it has a destination) and marks it read. */
  const openRow = (id: string, href: string | null) => {
    void markRead(id);
    if (href) router.push(href);
  };

  return (
    <div className="vn-page-enter space-y-5 pb-2">
      <BuyerSectionTitle
        eyebrow="Inbox"
        title="Notifications"
        action={
          <div className="flex shrink-0 items-center gap-2">
            {unread > 0 && (
              <>
                <span className="rounded-full bg-cyan-400/15 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-300">
                  {unread} new
                </span>
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="flex items-center gap-1 rounded-full border border-border/70 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CheckCheck className="h-3 w-3" aria-hidden />
                  Read all
                </button>
              </>
            )}
            <Link
              href="/app/buyer/settings/notifications"
              aria-label="Notification settings"
              title="Notification settings"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Settings className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
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
            const isUnread = !item.isRead;
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
                    {relativeTime(item.createdAt)}
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
                  // Tapping opens the destination AND marks the row read.
                  <button
                    type="button"
                    onClick={() => openRow(item.id, href)}
                    className="block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {body}
                  </button>
                ) : (
                  // No in-app destination: shown, but not a link. Following the
                  // stored website path would eject the buyer from the app.
                  // Tapping still clears the unread state.
                  <button
                    type="button"
                    onClick={() => openRow(item.id, null)}
                    className="block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}