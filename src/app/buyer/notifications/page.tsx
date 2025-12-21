'use client';

import { useState } from 'react';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Package, MessageSquare, Tag, Bell, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';

type NotificationType = 'order' | 'message' | 'promotion' | 'announcement';

interface MockNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: Date;
  isRead: boolean;
  actor?: {
    name: string;
    avatarUrl: string;
  };
}

const mockNotifications: MockNotification[] = [
  {
    id: '1',
    type: 'order',
    title: 'Order Shipped!',
    description: "Your order for 'Classic Leather Handbag' has been shipped.",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    isRead: false,
  },
  {
    id: '2',
    type: 'message',
    title: 'New Message from Aisha\'s Handbags',
    description: 'Yes, we can ship to your location. The estimated time is...',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    isRead: false,
    actor: { name: 'Aisha\'s Handbags', avatarUrl: 'https://picsum.photos/seed/seller-avatar-1/100' }
  },
  {
    id: '3',
    type: 'promotion',
    title: 'Flash Sale: 20% Off!',
    description: 'TechUnboxed is having a flash sale on all electronics for the next 24 hours.',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    isRead: true,
    actor: { name: 'TechUnboxed', avatarUrl: 'https://picsum.photos/seed/seller-avatar-2/100' }
  },
    {
    id: '4',
    type: 'order',
    title: 'Order Delivered',
    description: "Your order for 'Urban Explorer Sneakers' has been delivered. Please confirm receipt.",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    isRead: true,
  },
  {
    id: '5',
    type: 'announcement',
    title: 'New Feature: AI Poster Maker',
    description: 'Sellers can now generate amazing promotional posters with our new AI tool!',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    isRead: true,
  },
];

const notificationIcons: Record<NotificationType, React.ReactNode> = {
  order: <Package className="h-5 w-5 text-blue-500" />,
  message: <MessageSquare className="h-5 w-5 text-purple-500" />,
  promotion: <Tag className="h-5 w-5 text-green-500" />,
  announcement: <Bell className="h-5 w-5 text-orange-500" />,
};

const NotificationItem = ({ notification, onMarkRead }: { notification: MockNotification; onMarkRead: (id: string) => void; }) => (
  <div className={cn(
    "flex items-start gap-4 p-4 transition-colors",
    !notification.isRead && "bg-primary/5"
  )}>
    <div className="flex-shrink-0">
      {notification.actor ? (
        <Avatar className="h-9 w-9">
          <AvatarImage src={notification.actor.avatarUrl} alt={notification.actor.name} />
          <AvatarFallback>{notification.actor.name.charAt(0)}</AvatarFallback>
        </Avatar>
      ) : (
        notificationIcons[notification.type]
      )}
    </div>
    <div className="flex-1">
      <p className="font-semibold">{notification.title}</p>
      <p className="text-sm text-muted-foreground">{notification.description}</p>
    </div>
    <div className="flex flex-col items-end gap-2">
      <p className="text-xs text-muted-foreground whitespace-nowrap">
        {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
      </p>
      {!notification.isRead && (
        <Button size="sm" variant="ghost" className="h-auto p-1" onClick={() => onMarkRead(notification.id)}>
          <Check className="h-4 w-4" />
        </Button>
      )}
    </div>
  </div>
);


export default function BuyerNotificationsPage() {
    const [notifications, setNotifications] = useState(mockNotifications);

    const handleMarkRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    };

    const handleMarkAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const filteredNotifications = (type: NotificationType | 'unread') => {
        if (type === 'unread') {
            return notifications.filter(n => !n.isRead);
        }
        return notifications.filter(n => n.type === type);
    }
    
    return (
        <BuyerLayout>
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
                            <TabsTrigger value="orders">Orders</TabsTrigger>
                            <TabsTrigger value="messages">Messages</TabsTrigger>
                        </TabsList>
                        
                        <CardContent className="p-0">
                            <TabsContent value="all">
                                <div className="divide-y divide-border">
                                {notifications.map(n => <NotificationItem key={n.id} notification={n} onMarkRead={handleMarkRead} />)}
                                </div>
                            </TabsContent>
                             <TabsContent value="unread">
                                <div className="divide-y divide-border">
                                {filteredNotifications('unread').length > 0 ? (
                                    filteredNotifications('unread').map(n => <NotificationItem key={n.id} notification={n} onMarkRead={handleMarkRead} />)
                                ) : (
                                    <p className="p-8 text-center text-muted-foreground">No unread notifications.</p>
                                )}
                                </div>
                            </TabsContent>
                             <TabsContent value="orders">
                                <div className="divide-y divide-border">
                                 {filteredNotifications('order').length > 0 ? (
                                    filteredNotifications('order').map(n => <NotificationItem key={n.id} notification={n} onMarkRead={handleMarkRead} />)
                                ) : (
                                    <p className="p-8 text-center text-muted-foreground">No order notifications.</p>
                                )}
                                </div>
                            </TabsContent>
                             <TabsContent value="messages">
                                <div className="divide-y divide-border">
                                 {filteredNotifications('message').length > 0 ? (
                                    filteredNotifications('message').map(n => <NotificationItem key={n.id} notification={n} onMarkRead={handleMarkRead} />)
                                ) : (
                                    <p className="p-8 text-center text-muted-foreground">No message notifications.</p>
                                )}
                                </div>
                            </TabsContent>
                        </CardContent>
                    </Tabs>
                </Card>
            </div>
        </BuyerLayout>
    );
}