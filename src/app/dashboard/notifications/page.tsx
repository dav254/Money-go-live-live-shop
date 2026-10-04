'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Bell, Check, CheckCheck, Search, ShoppingCart, MessageSquare, Package,
  Wallet, Video, ShieldAlert, Calendar, Trash2, Sparkles, Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, writeBatch, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { sortNotificationsDesc } from '@/lib/notification-sort';

interface NotificationDoc {
  id: string;
  userId: string;
  type: string;
  category?: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  link?: string;
  isRead?: boolean;
  readAt?: unknown;
  createdAt?: unknown;
  // Legacy shape (Firebase Functions writes `status` + `timestamp`)
  status?: 'read' | 'unread';
  timestamp?: unknown;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  ORDER_CONFIRMED: <ShoppingCart className="h-4 w-4" />,
  ORDER_STATUS: <Package className="h-4 w-4" />,
  NEW_ORDER: <ShoppingCart className="h-4 w-4" />,
  BOOKING_CONFIRMED: <Calendar className="h-4 w-4" />,
  BOOKING_REMINDER: <Calendar className="h-4 w-4" />,
  MESSAGE: <MessageSquare className="h-4 w-4" />,
  NEW_MESSAGE: <MessageSquare className="h-4 w-4" />,
  PAYMENT_CONFIRMED: <Wallet className="h-4 w-4" />,
  PAYMENT_RECEIVED: <Wallet className="h-4 w-4" />,
  GENERATION_COMPLETE: <Video className="h-4 w-4" />,
  GENERATION_STARTED: <Video className="h-4 w-4" />,
  GENERATION_FAILED: <Video className="h-4 w-4" />,
  NEW_LOGIN: <ShieldAlert className="h-4 w-4" />,
  PASSWORD_CHANGED: <ShieldAlert className="h-4 w-4" />,
  SECURITY_ALERT: <ShieldAlert className="h-4 w-4" />,
  LISTING_APPROVED: <Store className="h-4 w-4" />,
  LISTING_REJECTED: <Store className="h-4 w-4" />,
  NEW_REVIEW: <Sparkles className="h-4 w-4" />,
};

const TYPE_TINTS: Record<string, string> = {
  security: 'bg-red-500/10 text-red-500',
  payments: 'bg-emerald-500/10 text-emerald-500',
  orders: 'bg-primary/10 text-primary',
  bookings: 'bg-amber-500/10 text-amber-500',
  messages: 'bg-cyan-500/10 text-cyan-500',
  ai: 'bg-violet-500/10 text-violet-500',
  business: 'bg-primary/10 text-primary',
  system: 'bg-muted text-muted-foreground',
};

const CATEGORIES = ['all', 'unread', 'orders', 'bookings', 'messages', 'payments', 'ai', 'business', 'security', 'system'] as const;
type Category = (typeof CATEGORIES)[number];

function isUnread(n: NotificationDoc): boolean {
  if (n.status) return n.status === 'unread';
  return !n.isRead;
}

function createdAtDate(n: NotificationDoc): Date | null {
  const ts = (n.createdAt ?? n.timestamp) as { toDate?: () => Date } | null | undefined;
  return ts?.toDate ? ts.toDate() : null;
}

function linkFor(n: NotificationDoc): string {
  if (n.link) return n.link;
  if (n.entityType === 'ORDER' && n.entityId) return `/invoice/${n.entityId}`;
  return '#';
}

export default function NotificationCenterPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [category, setCategory] = React.useState<Category>('all');
  const [search, setSearch] = React.useState('');

  // No server-side orderBy: the userId+createdAt / userId+timestamp composite
  // indexes are not deployed, so ordered queries failed with FAILED_PRECONDITION.
  // A single unfiltered-by-order query covers both doc shapes; we sort locally.
  const notificationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'notifications'),
      where('userId', '==', user.uid),
    );
  }, [user, firestore]);

  const all = useCollection<NotificationDoc>(notificationsQuery);

  const notifications = React.useMemo(() => {
    const seen = new Set<string>();
    const merged = (all.data ?? []).filter(n => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
    return sortNotificationsDesc(merged);
  }, [all.data]);

  const isLoading = isUserLoading || all.isLoading;

  const unreadCount = React.useMemo(() => notifications.filter(isUnread).length, [notifications]);

  const filtered = React.useMemo(() => {
    let list = notifications;
    if (category === 'unread') list = list.filter(isUnread);
    else if (category !== 'all') {
      list = list.filter(n => {
        const cat = n.category ?? (n.type === 'order' || n.type === 'commission' ? 'orders' : n.type === 'message' ? 'messages' : 'system');
        return cat === category;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n => n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q));
    }
    return list;
  }, [notifications, category, search]);

  const handleMarkRead = async (n: NotificationDoc) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'notifications', n.id), {
      isRead: true,
      readAt: new Date(),
      status: 'read',
    }).catch(() => {});
  };

  const handleMarkUnread = async (n: NotificationDoc) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'notifications', n.id), {
      isRead: false,
      readAt: null,
      status: 'unread',
    }).catch(() => {});
  };

  const handleDelete = async (n: NotificationDoc) => {
    if (!firestore) return;
    await deleteDoc(doc(firestore, 'notifications', n.id)).catch(() => {});
  };

  const handleMarkAllRead = async () => {
    if (!firestore || !user) return;
    const unread = notifications.filter(isUnread);
    if (unread.length === 0) return;
    const batch = writeBatch(firestore);
    unread.forEach(n => {
      batch.update(doc(firestore, 'notifications', n.id), {
        isRead: true, readAt: new Date(), status: 'read',
      });
    });
    try {
      await batch.commit();
      toast({ title: 'All caught up', description: 'Every notification is marked as read.' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not update notifications' });
    }
  };

  const renderList = () => {
    if (isLoading) {
      return (
        <div className="space-y-3 p-5">
          {[1, 2, 3, 4].map(n => <Skeleton key={n} className="h-16 w-full rounded-xl" />)}
        </div>
      );
    }
    if (filtered.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Bell className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-semibold">Nothing here yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {search ? 'No notifications match your search.' : 'Orders, bookings, payments and security alerts will appear here.'}
          </p>
        </div>
      );
    }
    return (
      <div className="divide-y divide-border">
        {filtered.map(n => {
          const cat = n.category ?? 'system';
          const unread = isUnread(n);
          const href = linkFor(n);
          const created = createdAtDate(n);
          return (
            <div
              key={n.id}
              className={cn('group flex items-start gap-4 p-4 md:p-5 vn-transition', unread && 'bg-primary/[0.04]')}
            >
              <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', TYPE_TINTS[cat] ?? TYPE_TINTS.system)}>
                {TYPE_ICONS[n.type] ?? <Bell className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={cn('truncate text-[14px]', unread ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')}>
                    {n.title}
                  </p>
                  {unread && <span className="vn-dot vn-dot-live shrink-0" />}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{n.message}</p>
                {created && (
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    {formatDistanceToNow(created, { addSuffix: true })}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {unread && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Mark as read" onClick={() => handleMarkRead(n)}>
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                {!unread && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" title="Mark as unread" onClick={() => handleMarkUnread(n)}>
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:text-destructive" title="Delete" onClick={() => handleDelete(n)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                {href !== '#' && (
                  <Button variant="ghost" size="sm" className="h-8 rounded-lg text-[12px] font-semibold text-primary" asChild>
                    <Link href={href}>Open</Link>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 vn-page-enter">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary mb-1">Vidnov Inbox</p>
          <h1 className="font-grotesk text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'You’re all caught up'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-48 md:w-56">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-10 rounded-xl pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0 || isLoading}
            className="h-10 rounded-xl font-semibold"
          >
            <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border-border overflow-hidden">
        <Tabs value={category} onValueChange={v => setCategory(v as Category)}>
          <div className="border-b border-border px-2 pt-2 overflow-x-auto">
            <TabsList className="bg-transparent h-11">
              {CATEGORIES.map(c => (
                <TabsTrigger key={c} value={c} className="rounded-lg capitalize text-[12px]">
                  {c}
                  {c === 'unread' && unreadCount > 0 && (
                    <span className="ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <ScrollArea className="h-[calc(100vh-22rem)] min-h-[320px]">
            <CardContent className="p-0">{renderList()}</CardContent>
          </ScrollArea>
        </Tabs>
      </Card>
    </div>
  );
}
