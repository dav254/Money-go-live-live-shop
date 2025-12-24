
'use client';

import * as React from 'react';
import { ResellerLayout } from '@/components/layout/reseller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Sparkles, Megaphone, BadgeCent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, writeBatch, orderBy } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import Link from 'next/link';

const notificationIcons: Record<Notification['type'], React.ReactNode> = {
  commission: <Sparkles className="h-5 w-5 text-yellow-500" />,
  announcement: <Megaphone className="h-5 w-5 text-blue-500" />,
  payout: <BadgeCent className="h-5 w-5 text-green-500" />,
  // Add other types as needed
  order: <></>, 
  invoice: <></>,
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
                {notification.timestamp ? formatDistanceToNow(notification.timestamp.toDate(), { addSuffix: true }) : ''}
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
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const notificationsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'notifications'), where('userId', '==', user.uid), orderBy('timestamp', 'desc'));
    }, [firestore, user]);

    const { data: notifications, isLoading: isLoadingNotifications } = useCollection<Notification>(notificationsQuery);
    
    const isLoading = isUserLoading || isLoadingNotifications;

    const handleMarkRead = async (id: string) => {
        if (!firestore) return;
        const notifRef = doc(firestore, 'notifications', id);
        try {
            await updateDoc(notifRef, { status: 'read' });
        } catch (error) {
            console.error("Failed to mark notification as read:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update notification.' });
        }
    };
    
    const handleMarkAllRead = async () => {
        if (!firestore || !notifications || unreadCount === 0) return;
        
        const batch = writeBatch(firestore);
        unreadNotifications.forEach(notif => {
            const notifRef = doc(firestore, 'notifications', notif.id);
            batch.update(notifRef, { status: 'read' });
        });

        try {
            await batch.commit();
            toast({ title: 'All Caught Up!', description: 'All notifications have been marked as read.' });
        } catch (error) {
             console.error("Failed to mark all as read:", error);
             toast({ variant: 'destructive', title: 'Error', description: 'Could not mark all notifications as read.' });
        }
    };
    
    const unreadNotifications = React.useMemo(() => notifications?.filter(n => n.status === 'unread') || [], [notifications]);
    const commissionNotifications = React.useMemo(() => notifications?.filter(n => n.type === 'commission' || n.type === 'payout') || [], [notifications]);
    const promotionNotifications = React.useMemo(() => notifications?.filter(n => n.type === 'announcement') || [], [notifications]);
    
    const unreadCount = unreadNotifications.length;

    const renderNotificationList = (notifs: Notification[]) => {
        if (isLoading) {
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
            <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                <div className="flex items-center justify-between">
                    <h1 className="font-headline text-3xl font-bold tracking-tight">
                        Notifications
                    </h1>
                     <Button variant="ghost" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
                        Mark all as read
                    </Button>
                </div>
                <Card>
                    <Tabs defaultValue="all">
                        <TabsList className="w-full justify-start rounded-b-none border-b">
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="unread">
                                Unread {unreadCount > 0 && <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{unreadCount}</span>}
                            </TabsTrigger>
                            <TabsTrigger value="commissions">Commissions</TabsTrigger>
                            <TabsTrigger value="promotions">Promotions</TabsTrigger>
                        </TabsList>
                        
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
                    </Tabs>
                </Card>
            </div>
        </ResellerLayout>
    );
}
