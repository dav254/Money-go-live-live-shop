'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell, ChevronRight } from 'lucide-react';
import { collection, limit, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import {
  EmptyState, SellerSectionTitle,
} from '@/components/app/seller/seller-app-shell';

/**
 * SELLER APP · NOTIFICATIONS.
 *
 * The website's notification centre lives inside the shared header. The app
 * gives it a screen inside the seller section, reading only this user's own
 * notifications — the query is scoped by `userId` so one seller can never page
 * through another's alerts.
 */

interface SellerNotification {
  id: string;
  type?: string;
  title?: string;
  message?: string;
  link?: string;
  status?: string;
  timestamp?: unknown;
}

function relativeTime(value: unknown): string {
  const ts =
    value && typeof value === 'object' && 'toDate' in (value as { toDate?: unknown })
      ? (value as { toDate: () => Date }).toDate()
      : value instanceof Date
        ? value
        : null;
  if (!ts) return '';
  const diffMs = Date.now() - ts.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return ts.toLocaleDateString();
}

export default function SellerSectionNotifications() {
  const { user } = useUser();
  const firestore = useFirestore();

  const notificationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    // No `orderBy` here on purpose: an equality filter plus a range/order on a
    // different field would demand a composite index this project has not
    // provisioned. The list is small and sorted in memory instead.
    return query(
      collection(firestore, 'notifications'),
      where('userId', '==', user.uid),
      limit(50),
    );
  }, [firestore, user]);

  const { data: rawNotifications, isLoading } = useCollection<SellerNotification>(notificationsQuery);

  const notifications = React.useMemo(() => {
    const ms = (value: unknown): number => {
      if (value && typeof value === 'object' && 'toMillis' in (value as { toMillis?: unknown })) {
        return (value as { toMillis: () => number }).toMillis();
      }
      if (value instanceof Date) return value.getTime();
      if (typeof value === 'number') return value;
      return 0;
    };
    return (rawNotifications ?? [])
      .slice()
      .sort((a, b) => ms(b.timestamp) - ms(a.timestamp));
  }, [rawNotifications]);

  return (
    <div className="vn-page-enter space-y-5 pb-2">
      <SellerSectionTitle eyebrow="Inbox" title="Notifications" />

      {isLoading ? (
        <div className="space-y-2.5 px-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="vn-skeleton h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : !notifications || notifications.length === 0 ? (
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
          {notifications.map((item) => {
            const unread = item.status === 'unread';
            const body = (
              <div
                className={cn(
                  'vn-app-card flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition',
                  unread
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border/80 bg-card hover:border-primary/30',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    unread ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground',
                  )}
                >
                  <Bell className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold leading-snug text-foreground">
                      {item.title || 'Notification'}
                    </span>
                    {unread && <span className="bg-primary mt-1 h-2 w-2 shrink-0 rounded-full" />}
                  </span>
                  {item.message && (
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {item.message}
                    </span>
                  )}
                  <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    {relativeTime(item.timestamp)}
                    {item.type ? ` · ${item.type}` : ''}
                  </span>
                </span>
                {item.link && <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />}
              </div>
            );

            return (
              <li key={item.id}>
                {item.link ? (
                  <Link href={item.link} className="block">
                    {body}
                  </Link>
                ) : (
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
