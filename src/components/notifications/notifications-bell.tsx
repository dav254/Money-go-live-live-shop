'use client';

/**
 * SHARED NOTIFICATIONS BELL — icon, honest unread badge, and a popup panel of
 * recent notifications, linking to whichever inbox the current surface owns
 * (buyer app, seller app, website buyer area, admin dashboard).
 *
 * ## VPS data, not Firestore
 *
 * The bell reads through `useNotifications` → `/api/notifications`, which is
 * backed by the VPS-controlled store (see `lib/notifications/store.ts`). The
 * client never queries a notification collection directly, never sends a
 * userId, and no longer imports the Firebase client SDK for this feature.
 *
 * ## Live updates without a refresh
 *
 * The hook polls on an interval and re-fetches on focus / visibility change,
 * so a new order alert appears while the page stays open — and the badge
 * clears the moment an item is marked read, in the inbox and here alike.
 *
 * Signed-out visitors get `null`: a bell with nothing behind it is worse than
 * no bell, so the component removes itself instead of rendering a dead control.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';

import { useUser } from '@/firebase';
import { useNotifications } from '@/lib/notifications/use-notifications';
import { cn } from '@/lib/utils';

/** Compact "3m ago"-style stamp for the panel. */
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

const PANEL_ITEMS = 8;

export function NotificationsBell({
  href,
  className,
  iconClassName = 'h-4 w-4',
  label = 'Notifications',
}: {
  /** Inbox route for this surface, e.g. `/app/buyer/notifications`. */
  href: string;
  className?: string;
  iconClassName?: string;
  label?: string;
}) {
  const router = useRouter();
  const { user } = useUser();
  const [open, setOpen] = React.useState(false);
  const { items, unread, markRead, markAllRead } = useNotifications({
    limit: 15,
    pollMs: 30_000,
  });

  const recent = React.useMemo(() => items.slice(0, PANEL_ITEMS), [items]);

  const openItem = (id: string, link?: string) => {
    void markRead(id);
    setOpen(false);
    const target = link && link.startsWith('/') && !link.startsWith('//') ? link : href;
    router.push(target);
  };

  // Signed-out visitors get nothing — a bell with no inbox behind it is worse
  // than no bell. Auth itself stays on Firebase (unchanged by this migration).
  if (!user) return null;

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        aria-label={unread > 0 ? `${label}, ${unread} unread` : label}
        title={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <Bell className={iconClassName} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white shadow-md shadow-red-600/30">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Tap-outside to close; the panel itself must not close on click. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-transparent"
          />
          <div
            role="dialog"
            aria-label={label}
            className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border/70 bg-popover shadow-xl shadow-black/10"
          >
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <span className="text-sm font-bold text-foreground">{label}</span>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-600/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                  Mark all read
                </button>
              )}
            </div>

            {recent.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs leading-relaxed text-muted-foreground">
                Nothing yet. Order updates, offers and seller replies land here as
                they happen.
              </p>
            ) : (
              <ul className="max-h-[60vh] divide-y divide-border/60 overflow-y-auto">
                {recent.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n.id, n.link)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                        !n.isRead && 'bg-red-600/[0.04]',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                          n.isRead ? 'bg-transparent' : 'bg-red-600',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block truncate text-[13px] leading-snug text-foreground',
                            !n.isRead && 'font-semibold',
                          )}
                        >
                          {n.title}
                        </span>
                        {n.message && (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {n.message}
                          </span>
                        )}
                        <span className="mt-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                          {relativeTime(n.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-border/70">
              <Link
                href={href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-red-600 transition hover:bg-secondary/60"
              >
                View all notifications
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}