
'use client';

import * as React from 'react';
import { ResellerLayout } from '@/components/layout/reseller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Sparkles, Megaphone, BadgeCent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { Notification } from '@/lib/types';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sortNotificationsDesc } from '@/lib/notification-sort';

const notificationIcons: Record<string, React.ReactNode> = {
  commission: <Sparkles className="h-5 w-5 text-yellow-500" />,
  announcement: <Megaphone className="h-5 w-5 text-blue-500" />,
  payout: <BadgeCent className="h-5 w-5 text-green-500" />,
};

const NotificationItem = ({ notification, onMarkRead }: { notification: Notification; onMarkRead: (id: string) => void; }) => (
  <Link href={notification.link || '#'} className={cn(
    "block transition-colors",
    notification.status === 'unread' && "bg-primary/5"
  )}>
    <div className="flex items-start gap-4 p-4">
        <div className="flex-shrink-0 mt-1">
            {notificationIcons[notification.type] || <Sparkles className="h-5 w-5 text-gray-500" />}
        </div>
        <div className="flex-1">
            <p className="font-semibold">{notification.title}</p>
            <p className="text-sm text-muted-foreground">{notification.message}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
            <p className="text-xs text-muted-foreground whitespace-nowrap">
                {notification.timestamp?.toDate ? formatDistanceToNow(notification.timestamp.toDate(), { addSuffix: true }) : ''}
            </p>
            {notification.status === 'unread' && (
                <Button size="sm" variant="ghost" className="h-auto p-1" onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onMarkRead(notification.id);
                }}>
                    <Check className="h-4 w-4" />
                </Button>
            )}
        </div>
    </div>
  </Link>
);


export default function ResellerNotificationsPage() {
    const { toast } = useToast();
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();

    // No server-side orderBy: the userId+timestamp composite index is not
    // deployed, so the ordered query failed with FAILED_PRECONDITION.
    const notificationsQuery = React.useMemo(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'notifications'),
            where('userId', '==', user.uid),
        );
    }, [user, firestore]);

    const { data: rawNotifications, isLoading } = useCollection<Notification>(notificationsQuery);

    const notifications = React.useMemo(
        () => sortNotificationsDesc(rawNotifications ?? []),
        [rawNotifications],
    );
    
    const handleMarkRead = async (id: string) => {
        if (!firestore) return;
        const notificationRef = doc(firestore, 'notifications', id);
        try {
            await updateDoc(notificationRef, { status: 'read' });
        } catch (e) {
            console.error("Error marking notification as read: ", e);
            toast({ title: 'Error', description: 'Could not mark notification as read.', variant: 'destructive' });
        }
    };
    
    const handleMarkAllRead = async () => {
        if (!firestore || !user) return;
        const unread = notifications?.filter(n => n.status === 'unread');
        if (!unread || unread.length === 0) return;

        const batch = writeBatch(firestore);
        unread.forEach(n => {
            const notificationRef = doc(firestore, 'notifications', n.id);
            batch.update(notificationRef, { status: 'read' });
        });

        try {
            await batch.commit();
            toast({ title: 'All Caught Up!', description: 'All notifications have been marked as read.' });
        } catch (e) {
            console.error("Error marking all notifications as read: ", e);
            toast({ title: 'Error', description: 'Could not mark all notifications as read.', variant: 'destructive' });
        }
    };
    
    const unreadNotifications = React.useMemo(() => notifications?.filter(n => n.status === 'unread') || [], [notifications]);
    const commissionNotifications = React.useMemo(() => notifications?.filter(n => n.type === 'commission' || n.type === 'payout') || [], [notifications]);
    const promotionNotifications = React.useMemo(() => notifications?.filter(n => n.type === 'announcement') || [], [notifications]);
    
    const unreadCount = unreadNotifications.length;

    const renderNotificationList = (notifs: Notification[]) => {
        if (isLoading || isUserLoading) {
            return (
                <div className="space-y-4 p-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            )
        }
        if (notifs.length === 0) {
            return <p className="p-8 text-center text-muted-foreground">No notifications in this category.</p>
        }
        return (
            <div className="divide-y divide-border">
                {notifs.map(n => <NotificationItem key={n.id} notification={n} onMarkRead={handleMarkRead} />)}
            </div>
        )
    }
    
    return (
        <ResellerLayout>
            <div className="flex h-[calc(100vh-theme(space.16))] flex-col p-4 md:p-8 pt-6">
                <div className="flex items-center justify-between pb-4">
                    <h1 className="font-headline text-3xl font-bold tracking-tight">
                        Notifications
                    </h1>
                     <Button variant="ghost" onClick={handleMarkAllRead} disabled={unreadCount === 0 || isLoading}>
                        Mark all as read
                    </Button>
                </div>
                <Card className="flex-1 flex flex-col">
                    <Tabs defaultValue="all" className="flex-1 flex flex-col">
                        <TabsList className="w-full justify-start rounded-b-none border-b">
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="unread">
                                Unread {unreadCount > 0 && <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{unreadCount}</span>}
                            </TabsTrigger>
                            <TabsTrigger value="commissions">Commissions</TabsTrigger>
                            <TabsTrigger value="promotions">Promotions</TabsTrigger>
                        </TabsList>
                        
                        <ScrollArea className="flex-1">
                            <CardContent className="p-0">
                                <TabsContent value="all">
                                    {renderNotificationList(notifications || [])}
                                </TabsContent>
                                 <TabsContent value="unread">
                                    {renderNotificationList(unreadNotifications)}
                                 </TabsContent>
                                 <TabsContent value="commissions">
                                    {renderNotificationList(commissionNotifications)}
                                 </TabsContent>
                                 <TabsContent value="promotions">
                                     {renderNotificationList(promotionNotifications)}
                                </TabsContent>
                            </CardContent>
                        </ScrollArea>
                    </Tabs>
                </Card>
            </div>
        </ResellerLayout>
    );
}
