'use client';

import * as React from 'react';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Bell, ShoppingCart, MessageSquare, Megaphone, Trash2, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { Notification } from '@/lib/types';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, writeBatch, doc, orderBy, updateDoc, deleteDoc } from 'firebase/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';

const notificationIcons: Record<string, React.ReactNode> = {
  order: <ShoppingCart className="h-5 w-5 text-green-500" />,
  message: <MessageSquare className="h-5 w-5 text-blue-500" />,
  announcement: <Megaphone className="h-5 w-5 text-purple-500" />,
  commission: <Sparkles className="h-5 w-5 text-yellow-500" />,
};

const NotificationItem = ({ notification, onMarkRead, onDelete }: { 
  notification: Notification; 
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) => (
  <div className={cn(
    "group relative transition-all duration-300 border-b border-white/5",
    notification.status === 'unread' ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-white/5"
  )}>
    <div className="flex items-start gap-4 p-4 pr-12">
        <div className={cn(
            "flex-shrink-0 mt-1 p-2 rounded-xl bg-neutral-900 border border-white/5",
            notification.status === 'unread' && "border-primary/20"
        )}>
            {notificationIcons[notification.type] || <Bell className="h-5 w-5 text-gray-500" />}
        </div>
        <div className="flex-1 min-w-0">
            <Link href={notification.link || '#'} className="block">
                <p className="font-bold text-sm text-white uppercase tracking-tight truncate">{notification.title}</p>
                <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">{notification.message}</p>
            </Link>
            <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest mt-2">
                {notification.timestamp?.toDate ? formatDistanceToNow(notification.timestamp.toDate(), { addSuffix: true }) : 'Just now'}
            </p>
        </div>
    </div>
    
    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {notification.status === 'unread' && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => onMarkRead(notification.id)}>
                <Check className="h-4 w-4" />
            </Button>
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8 text-neutral-600 hover:text-destructive" onClick={() => onDelete(notification.id)}>
            <Trash2 className="h-4 w-4" />
        </Button>
    </div>
  </div>
);

export default function BuyerNotificationsPage() {
    const { toast } = useToast();
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();

    const notificationsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'notifications'), 
            where('userId', '==', user.uid),
            orderBy('timestamp', 'desc')
        );
    }, [user, firestore]);

    const { data: notifications, isLoading } = useCollection<Notification>(notificationsQuery);
    
    const handleMarkRead = async (id: string) => {
        if (!firestore) return;
        const notificationRef = doc(firestore, 'notifications', id);
        try {
            await updateDoc(notificationRef, { status: 'read' });
        } catch (e) {
            console.error("Error marking notification as read: ", e);
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(doc(firestore, 'notifications', id));
            toast({ title: 'Deleted', description: 'Notification removed.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error deleting notification' });
        }
    }
    
    const handleMarkAllRead = async () => {
        if (!firestore || !user || !notifications) return;
        const unread = notifications.filter(n => n.status === 'unread');
        if (unread.length === 0) return;

        const batch = writeBatch(firestore);
        unread.forEach(n => {
            const notificationRef = doc(firestore, 'notifications', n.id);
            batch.update(notificationRef, { status: 'read' });
        });

        try {
            await batch.commit();
            toast({ title: 'Success', description: 'All notifications marked as read.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error' });
        }
    };
    
    const unreadNotifications = React.useMemo(() => notifications?.filter(n => n.status === 'unread') || [], [notifications]);
    const unreadCount = unreadNotifications.length;

    const renderNotificationList = (notifs: Notification[]) => {
        if (isLoading || isUserLoading) {
            return (
                <div className="space-y-4 p-4">
                    <Skeleton className="h-20 w-full rounded-2xl bg-white/5" />
                    <Skeleton className="h-20 w-full rounded-2xl bg-white/5" />
                    <Skeleton className="h-20 w-full rounded-2xl bg-white/5" />
                </div>
            )
        }
        if (notifs.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                    <Bell className="h-12 w-12 text-neutral-500 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Inbox is empty</p>
                </div>
            )
        }
        return (
            <div className="flex flex-col">
                {notifs.map(n => (
                    <NotificationItem 
                        key={n.id} 
                        notification={n} 
                        onMarkRead={handleMarkRead} 
                        onDelete={handleDelete}
                    />
                ))}
            </div>
        )
    }
    
    return (
        <BuyerLayout>
            <div className="flex flex-col space-y-8 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="font-headline text-3xl font-black uppercase tracking-tighter text-white">
                            Activity Center
                        </h1>
                        <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] mt-1">Updates on your orders, messages, and deals.</p>
                    </div>
                     <Button variant="ghost" onClick={handleMarkAllRead} disabled={unreadCount === 0 || isLoading} className="text-[10px] font-black uppercase tracking-widest hover:text-primary">
                        Mark all as read
                    </Button>
                </div>

                <Card className="bg-neutral-900/50 border-white/5 overflow-hidden rounded-[2rem] shadow-2xl">
                    <Tabs defaultValue="all" className="w-full">
                        <div className="px-6 pt-4 border-b border-white/5 bg-white/5">
                            <TabsList className="bg-transparent h-12 gap-6">
                                <TabsTrigger value="all" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full font-black uppercase text-[10px] tracking-widest px-0">
                                    All Notifications
                                </TabsTrigger>
                                <TabsTrigger value="unread" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full font-black uppercase text-[10px] tracking-widest px-0 flex items-center gap-2">
                                    Unread {unreadCount > 0 && <Badge className="bg-red-600 border-none h-4 px-1.5 min-w-[1rem] text-[8px]">{unreadCount}</Badge>}
                                </TabsTrigger>
                            </TabsList>
                        </div>
                        
                        <CardContent className="p-0">
                            <TabsContent value="all" className="mt-0">
                                {renderNotificationList(notifications || [])}
                            </TabsContent>
                             <TabsContent value="unread" className="mt-0">
                                {renderNotificationList(unreadNotifications)}
                             </TabsContent>
                        </CardContent>
                    </Tabs>
                </Card>
            </div>
        </BuyerLayout>
    );
}
