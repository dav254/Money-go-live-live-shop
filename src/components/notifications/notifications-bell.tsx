'use client';

/**
 * SHARED NOTIFICATIONS BELL — one icon, an honest unread badge, and a link to
 * whichever inbox the current surface owns (buyer app, seller app, website
 * buyer area, admin dashboard).
 *
 * ## Why the unread count reads BOTH field shapes
 *
 * The `notifications` collection is written by two generations of code:
 *
 *   - Cloud Functions / older API routes → `{ status: 'unread' | 'read' }`
 *   - `lib/notifications/engine.ts`      → `{ isRead: boolean, readAt }`
 *
 * A count that only understood one shape would show a badge that is either
 * permanently stuck on or silently zero. The predicate below is the same one
 * the seller site header and the dashboard inbox already use, so every surface
 * agrees on the number.
 *
 * ## Why no orderBy
 *
 * `userId == uid` alone needs no composite index — the equality filter is all
 * the Firestore rules allow on this collection anyway. Ordering by `createdAt`
 * would require a composite index this project has not provisioned, which is
 * exactly why the inbox pages sort locally too.
 *
 * Signed-out visitors get `null`: a bell with nothing behind it is worse than
 * no bell, so the component removes itself instead of rendering a dead link.
 */

import * as React from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { collection, limit, query, where } from 'firebase/firestore';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { cn } from '@/lib/utils';

interface NotificationDoc {
  isRead?: boolean;
  status?: string;
}

/** Same both-shapes predicate the seller header and dashboard inbox use. */
function isUnread(n: NotificationDoc): boolean {
  if (n.status) return n.status === 'unread';
  return !n.isRead;
}

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
  const { user } = useUser();
  const firestore = useFirestore();

  const notifQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'notifications'),
      where('userId', '==', user.uid),
      limit(100),
    );
  }, [firestore, user]);

  const { data } = useCollection<NotificationDoc>(notifQuery);

  const unread = React.useMemo(
    () => (data ?? []).filter(isUnread).length,
    [data],
  );

  if (!user) return null;

  return (
    <Link
      href={href}
      aria-label={unread > 0 ? `${label}, ${unread} unread` : label}
      title={label}
      className={cn(
        'relative flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary',
        className,
      )}
    >
      <Bell className={iconClassName} />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white shadow-md shadow-red-600/30">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
