
'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Package, CircleDollarSign, MessageSquare, BellDot, Settings, Loader2 } from 'lucide-react';
import React, { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile } from '@/firebase';
import { collection, query, where, orderBy, writeBatch, doc } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { SellerSidebar } from '@/components/seller/seller-sidebar';
import { ResellerSidebar } from '@/components/reseller/reseller-sidebar';
import { BuyerSidebar } from '@/components/buyer/buyer-sidebar';
import Link from 'next/link';

// NOTE: This page is now deprecated in favor of role-specific notification pages
// like /buyer/notifications. It can be removed in a future cleanup.

const notificationIcons: { [key: string]: React.ReactNode } = {
  order: <Package className="h-5 w-5 text-blue-500" />,
  commission: <CircleDollarSign className="h-5 w-5 text-green-500" />,
  message: <MessageSquare className="h-5 w-5 text-purple-500" />,
  announcement: <BellDot className="h-5 w-5 text-yellow-500" />,
  default: <BellDot className="h-5 w-5 text-gray-500" />,
};

function SidebarNav({ role }: { role: string | undefined }) {
  if (role === 'admin') return <AdminSidebar />;
  if (role === 'seller') return <SellerSidebar />;
  if (role === 'reseller') return <ResellerSidebar />;
  return <BuyerSidebar />;
}

export default function NotificationsPage() {
  const { user } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const firestore = useFirestore();

  const notificationsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'notifications'), where('userId', '==', user.uid), orderBy('timestamp', 'desc'));
  }, [user, firestore]);

  const { data: notifications, isLoading: areNotificationsLoading } = useCollection<Notification>(notificationsQuery);

  const isLoading = isProfileLoading || areNotificationsLoading;

  const handleMarkAllAsRead = async () => {
    if (!firestore || !notifications || notifications.length === 0) return;
    
    const unreadNotifications = notifications.filter(n => n.status === 'unread');
    if (unreadNotifications.length === 0) return;

    const batch = writeBatch(firestore);
    unreadNotifications.forEach(n => {
      const notifRef = doc(firestore, 'notifications', n.id);
      batch.update(notifRef, { status: 'read' });
    });

    await batch.commit();
  };
  
  const getFilteredNotifications = (types: string[]) => {
      if (!notifications) return [];
      if (types.includes('all')) return notifications;
      if (types.includes('unread')) return notifications.filter(n => n.status === 'unread');
      return notifications.filter(n => types.includes(n.type));
  }
  
  const renderNotifications = (items: Notification[]) => {
      if (isLoading) {
          return <div className="p-4 text-center">Loading notifications...</div>
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
                            {n.timestamp ? formatDistanceToNow(n.timestamp.toDate(), { addSuffix: true }) : ''}
                        </p>
                        {n.status === 'unread' && <div className="mt-1 flex justify-end"><Badge className="h-2 w-2 p-0 bg-primary"></Badge></div>}
                    </div>
                </Link>
            ))}
       </div>
      )
  }

  return (
    <MainLayout sidebar={isLoading ? <p>Loading...</p> : <SidebarNav role={userProfile?.userRole} />}>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Notifications
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleMarkAllAsRead}>
              <Check className="mr-2 h-4 w-4" /> Mark all as read
            </Button>
            <Button variant="ghost" size="icon"><Settings className="h-5 w-5" /></Button>
          </div>
        </div>
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
          </TabsList>
          <Card className="mt-6">
              <CardContent className="p-0">
                    <TabsContent value="all">{renderNotifications(getFilteredNotifications(['all']))}</TabsContent>
                    <TabsContent value="unread">{renderNotifications(getFilteredNotifications(['unread']))}</TabsContent>
                    <TabsContent value="orders">{renderNotifications(getFilteredNotifications(['order']))}</TabsContent>
                    <TabsContent value="earnings">{renderNotifications(getFilteredNotifications(['commission']))}</TabsContent>
                    <TabsContent value="messages">{renderNotifications(getFilteredNotifications(['message']))}</TabsContent>
              </CardContent>
          </Card>
        </Tabs>
      </div>
    </MainLayout>
  );
}
