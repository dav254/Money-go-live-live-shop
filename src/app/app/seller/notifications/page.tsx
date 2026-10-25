'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, ChevronRight, Settings, X } from 'lucide-react';

import { useNotifications } from '@/lib/notifications/use-notifications';
import { cn } from '@/lib/utils';
import {
  EmptyState,
  SellerSectionTitle,
} from '@/components/app/seller/seller-app-shell';

/**
 * SELLER APP · NOTIFICATIONS.
 *
 * The website's notification centre lives inside the shared header. The app
 * gives it a screen inside the seller section, fed by the VPS-backed
 * `/api/notifications` routes — the API derives the uid from the verified
 * token and returns only that seller's records, so one seller can never page
 * through another's alerts.
 *
 * ## One normalized shape
 *
 * The store collapses every generation of writer (engine, legacy actions,
 * broadcasts) into a single `{ isRead, createdAt, … }` record server-side
 * (see `lib/notifications/normalize.ts`), so this screen only ever sees one
 * shape — no more `status` vs `isRead` guessing.
 *
 * Live updates come from the hook's polling (interval + focus + visibility).
 * Tapping a row marks it read, the header offers "mark all read", each row
 * can be dismissed with ✕, and the gear opens notification settings.
 */

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

/** Open the stored link only when it is a safe same-surface path. */
function safeHref(raw: string | undefined): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

export default function SellerSectionNotifications() {
  const router = useRouter();
  const { items, unread, isLoading, markRead, markAllRead, remove } =
    useNotifications({ limit: 50, pollMs: 30_000 });

  const openRow = (id: string, href: string | null) => {
    void markRead(id);
    if (href) router.push(href);
  };

  return (
    <div className="vn-page-enter space-y-5 pb-2">
      <SellerSectionTitle
        eyebrow="Inbox"
        title="Notifications"
        action={
          <div className="flex shrink-0 items-center gap-2">
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="flex items-center gap-1 rounded-full border border-border/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CheckCheck className="h-3 w-3" aria-hidden />
                Read all
              </button>
            )}
            <Link
              href="/app/seller/settings/notifications"
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
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nothing yet"
          body="Sales, commissions, referral bonuses and stock alerts all land here as they happen."
          action={
            <Link
              href="/app/seller"
              className="bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
            >
              Back to overview
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2 px-4">
          {items.map((item) => {
            const unreadRow = !item.isRead;
            const href = safeHref(item.link);
            const body = (
              <div
                className={cn(
                  'vn-app-card relative flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition',
                  unreadRow
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border/80 bg-card hover:border-primary/30',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    unreadRow
                      ? 'bg-primary/15 text-primary'
                      : 'bg-secondary text-muted-foreground',
                  )}
                >
                  <Bell className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold leading-snug text-foreground">
                      {item.title || 'Notification'}
                    </span>
                    {unreadRow && (
                      <span className="bg-primary mt-1 h-2 w-2 shrink-0 rounded-full" />
                    )}
                  </span>
                  {item.message && (
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {item.message}
                    </span>
                  )}
                  <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    {relativeTime(item.createdAt)}
                    {item.type ? ` · ${item.type}` : ''}
                  </span>
                </span>
                {href && <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />}
              </div>
            );

            return (
              <li key={item.id} className="relative">
                <button
                  type="button"
                  onClick={() => openRow(item.id, href)}
                  className="block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {body}
                </button>
                {/* Dismiss — removes it from this seller's inbox only; the
                    server re-checks ownership before deleting. */}
                <button
                  type="button"
                  aria-label={`Dismiss ${item.title || 'notification'}`}
                  onClick={() => void remove(item.id)}
                  className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-muted-foreground transition hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}