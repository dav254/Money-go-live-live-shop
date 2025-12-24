
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
import type { Notification } from '@/lib/types';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';

const mockNotificationsData: Notification[] = [
    {
        id: '1',
        userId: 'reseller1',
        type: 'commission',
        title: 'New Commission Earned!',
        message: 'You earned $5.50 commission from the sale of "Classic Leather Handbag".',
        link: '/dashboard/reseller/commissions',
        status: 'unread',
        timestamp: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 5)), // 5 minutes ago
    },
    {
        id: '2',
        userId: 'reseller1',
        type: 'announcement',
        title: 'New Feature: AI Toolkit',
        message: 'Supercharge your shares with our new AI Caption Generator, now available in your toolkit.',
        link: '/dashboard/reseller/toolkit',
        status: 'unread',
        timestamp: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 60 * 2)), // 2 hours ago
    },
    {
        id: '3',
        userId: 'reseller1',
        type: 'payout',
        title: 'Payout Successful',
        message: 'Your withdrawal of $52.00 has been processed and sent to your account.',
        link: '/dashboard/reseller/wallet',
        status: 'read',
        timestamp: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 60 * 24)), // 1 day ago
    },
     {
        id: '4',
        userId: 'reseller1',
        type: 'commission',
        title: 'New Commission Earned!',
        message: 'You earned $12.00 commission from the sale of "NextGen Smartphone".',
        link: '/dashboard/reseller/commissions',
        status: 'read',
        timestamp: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 60 * 48)), // 2 days ago
    }
];


const notificationIcons: Record<Notification['type'], React.ReactNode> = {
  commission: <Sparkles className="h-5 w-5 text-yellow-500" />,
  announcement: <Megaphone className="h-5 w-5 text-blue-500" />,
  payout: <BadgeCent className="h-5 w-5 text-green-500" />,
  order: <></>, 
  invoice: <></>,
  message: <></>,
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
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState(true);
    const [notifications, setNotifications] = React.useState<Notification[]>([]);

    React.useEffect(() => {
        // Simulate fetching data
        setTimeout(() => {
            setNotifications(mockNotificationsData);
            setIsLoading(false);
        }, 1000);
    }, []);

    const handleMarkRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'read' } : n));
    };
    
    const handleMarkAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
        toast({ title: 'All Caught Up!', description: 'All notifications have been marked as read.' });
    };
    
    const unreadNotifications = React.useMemo(() => notifications.filter(n => n.status === 'unread') || [], [notifications]);
    const commissionNotifications = React.useMemo(() => notifications.filter(n => n.type === 'commission' || n.type === 'payout') || [], [notifications]);
    const promotionNotifications = React.useMemo(() => notifications.filter(n => n.type === 'announcement') || [], [notifications]);
    
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
