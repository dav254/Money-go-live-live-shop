
'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Package, CircleDollarSign, MessageSquare, BellDot, Settings } from 'lucide-react';
import React from 'react';
import { useUser } from '@/firebase';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { SellerSidebar } from '@/components/seller/seller-sidebar';
import { ResellerSidebar } from '@/components/reseller/reseller-sidebar';
import { BuyerSidebar } from '@/components/buyer/buyer-sidebar';


const notifications = [
  { id: 1, type: 'order', title: 'New Order Received', message: 'You have a new order for "Classic Leather Handbag".', time: '2m ago', read: false, icon: <Package className="h-5 w-5 text-blue-500" /> },
  { id: 2, type: 'commission', title: 'Commission Earned', message: 'You earned KES 120 commission from a reseller sale.', time: '1h ago', read: false, icon: <CircleDollarSign className="h-5 w-5 text-green-500" /> },
  { id: 3, type: 'message', title: 'New Message from Buyer', message: 'David Otieno: "Is this still in stock?"', time: '3h ago', read: true, icon: <MessageSquare className="h-5 w-5 text-purple-500" /> },
  { id: 4, type: 'order', title: 'Order Shipped', message: 'Your order #ORD-001 has been shipped.', time: 'Yesterday', read: true, icon: <Package className="h-5 w-5 text-blue-500" /> },
  { id: 5, type: 'announcement', title: 'Platform Update', message: 'New features added to the reseller dashboard.', time: '2 days ago', read: true, icon: <BellDot className="h-5 w-5 text-yellow-500" /> },
];

function SidebarNav({ role }: { role: string | undefined }) {
  // Explicitly check for admin first to ensure it takes precedence.
  if (role === 'admin') {
    return <AdminSidebar />;
  }
  if (role === 'seller') {
    return <SellerSidebar />;
  }
  if (role === 'reseller') {
    return <ResellerSidebar />;
  }
  // Default to buyer for any other role or if the role is undefined.
  return <BuyerSidebar />;
}

export default function NotificationsPage() {
    const { user } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);

    return (
    <MainLayout sidebar={isProfileLoading ? <p>Loading...</p> : <SidebarNav role={userProfile?.userRole} />}>
        <div className="flex-1 space-y-4 p-8 pt-6">
             <div className="flex items-center justify-between">
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    Notifications
                </h1>
                <div className="flex items-center gap-2">
                    <Button variant="outline"><Check className="mr-2 h-4 w-4" /> Mark all as read</Button>
                    <Button variant="ghost" size="icon"><Settings className="h-5 w-5" /></Button>
                </div>
            </div>
            <Tabs defaultValue="all">
                <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="unread">Unread</TabsTrigger>
                    <TabsTrigger value="orders">Orders</TabsTrigger>
                    <TabsTrigger value="earnings">Earnings</TabsTrigger>
                    <TabsTrigger value="support">Support</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="mt-6">
                    <Card>
                        <CardContent className="p-0">
                           <div className="divide-y">
                                {notifications.map(n => (
                                    <div key={n.id} className={`flex items-start gap-4 p-4 ${!n.read ? 'bg-primary/5' : ''}`}>
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                            {n.icon}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold">{n.title}</p>
                                            <p className="text-sm text-muted-foreground">{n.message}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground">{n.time}</p>
                                            {!n.read && <div className="mt-1 flex justify-end"><Badge className="h-2 w-2 p-0 bg-primary"></Badge></div>}
                                        </div>
                                    </div>
                                ))}
                           </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="unread" className="mt-6">
                    <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
                        <p className="text-muted-foreground">You have no unread notifications.</p>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    </MainLayout>
    );
}
