
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Package, CircleDollarSign, MessageSquare, BellDot, Settings, Loader2 } from 'lucide-react';
import React from 'react';
import Link from 'next/link';

// Mock Notification type for frontend display
interface MockNotification {
    id: string;
    type: 'order' | 'message' | 'announcement';
    title: string;
    message: string;
    timestamp: Date;
    status: 'read' | 'unread';
    link?: string;
}

const mockNotifications: MockNotification[] = [
    {
        id: '1',
        type: 'order',
        title: 'Order Shipped!',
        message: 'Your Classic Leather Handbag has been shipped. Track your package now.',
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
        status: 'unread',
        link: '/buyer/my-orders'
    },
    {
        id: '2',
        type: 'message',
        title: 'New Message from TechUnboxed',
        message: '"Hi, yes we have the blue one in stock. Would you like me to create a custom order for you?"',
        timestamp: new Date(Date.now() - 3600000 * 3), // 3 hours ago
        status: 'unread',
        link: '/messages'
    },
    {
        id: '3',
        type: 'announcement',
        title: 'Weekend Flash Sale!',
        message: 'Get 20% off all electronics this weekend only. Don\'t miss out!',
        timestamp: new Date(Date.now() - 86400000), // 1 day ago
        status: 'read',
        link: '/categories/electronics'
    },
    {
        id: '4',
        type: 'order',
        title: 'Order Delivered',
        message: 'Your Gourmet Pasta Kit has been delivered. Leave a review to share your experience!',
        timestamp: new Date(Date.now() - 86400000 * 2), // 2 days ago
        status: 'read',
        link: '/buyer/my-orders'
    }
];

const notificationIcons: { [key: string]: React.ReactNode } = {
  order: <Package className="h-5 w-5 text-blue-500" />,
  announcement: <BellDot className="h-5 w-5 text-yellow-500" />,
  message: <MessageSquare className="h-5 w-5 text-purple-500" />,
  default: <BellDot className="h-5 w-5 text-gray-500" />,
};

function formatDistanceToNow(date: Date) {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
}

export default function BuyerNotificationsPage() {
    const [notifications, setNotifications] = React.useState(mockNotifications);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        // Simulate fetching data
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const handleMarkAllAsRead = () => {
        setNotifications(notifications.map(n => ({ ...n, status: 'read' })));
    };
  
    const getFilteredNotifications = (types: string[]) => {
      if (types.includes('all')) return notifications;
      if (types.includes('unread')) return notifications.filter(n => n.status === 'unread');
      return notifications.filter(n => types.includes(n.type));
    }
  
    const renderNotifications = (items: MockNotification[]) => {
      if (isLoading) {
          return <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
      }
      if (items.length === 0) {
           return <div className="p-12 text-center text-muted-foreground">No notifications in this category.</div>
      }
      return (
        <div className="divide-y">
            {items.map(n => (
                <Link key={n.id} href={n.link || '#'} className={`flex items-start gap-4 p-4 hover:bg-muted/50 ${n.status === 'unread' ? 'bg-primary/5' : ''}`}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        {notificationIcons[n.type] || notificationIcons.default}
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold">{n.title}</p>
                        <p className="text-sm text-muted-foreground">{n.message}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(n.timestamp)}
                        </p>
                    </div>
                </Link>
            ))}
       </div>
      )
    }

    return (
        <BuyerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between">
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    Notifications
                </h1>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleMarkAllAsRead}>
                        <Check className="mr-2 h-4 w-4" /> Mark all as read
                    </Button>
                </div>
                </div>
                <Tabs defaultValue="all">
                <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="unread">Unread</TabsTrigger>
                    <TabsTrigger value="orders">Orders</TabsTrigger>
                    <TabsTrigger value="messages">Messages</TabsTrigger>
                    <TabsTrigger value="promotions">Promotions</TabsTrigger>
                </TabsList>
                <Card className="mt-6">
                    <CardContent className="p-0">
                        <TabsContent value="all">{renderNotifications(getFilteredNotifications(['all']))}</TabsContent>
                        <TabsContent value="unread">{renderNotifications(getFilteredNotifications(['unread']))}</TabsContent>
                        <TabsContent value="orders">{renderNotifications(getFilteredNotifications(['order']))}</TabsContent>
                        <TabsContent value="messages">{renderNotifications(getFilteredNotifications(['message']))}</TabsContent>
                        <TabsContent value="promotions">{renderNotifications(getFilteredNotifications(['announcement']))}</TabsContent>
                    </CardContent>
                </Card>
                </Tabs>
            </div>
        </BuyerLayout>
    );
}
