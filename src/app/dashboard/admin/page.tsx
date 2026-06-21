'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import {
  DollarSign,
  Users,
  ShoppingBag,
  CircleDollarSign,
  Package,
  ArrowRight,
  Eye,
  ScreenShare,
  Megaphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { collection, query, where } from 'firebase/firestore';
import type { LiveSession, UserProfile, Product } from '@/lib/types';

const StatCard = ({
  title,
  value,
  icon: Icon,
  color,
  isLoading,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color?: string;
  isLoading: boolean;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className={cn('h-4 w-4 text-muted-foreground', color)} />
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <Skeleton className="h-8 w-1/2" />
      ) : (
        <div className="text-2xl font-bold">{value}</div>
      )}
    </CardContent>
  </Card>
);

export default function AdminDashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  // Guarded queries to ensure valid admin session and prevent permission denied crashes
  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'userProfiles')), [firestore]);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);

  const productsQuery = useMemoFirebase(() => collection(firestore, 'products'), [firestore]);
  const { data: allProducts, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

  const liveSessionsQuery = useMemoFirebase(() => query(collection(firestore, 'liveSessions'), where('status', '==', 'live')), [firestore]);
  const { data: liveSessions, isLoading: areLiveSessionsLoading } = useCollection<LiveSession>(liveSessionsQuery);
  
  const stats = [
    {
      title: 'Total Users',
      value: (allUsers?.length || 0).toLocaleString(), 
      icon: Users,
      isLoading: areUsersLoading,
    },
    {
      title: 'Total Products',
      value: (allProducts?.length || 0).toLocaleString(), 
      icon: ShoppingBag,
      isLoading: areProductsLoading,
    },
    {
      title: 'Live Streams',
      value: (liveSessions?.length || 0).toLocaleString(),
      icon: Eye,
      isLoading: areLiveSessionsLoading, 
      color: 'text-green-500',
    },
  ];

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Admin Dashboard
        </h1>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
           <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ScreenShare className="text-primary"/>
                    Live Shopping Control Room
                </CardTitle>
                <CardDescription>Monitor and manage all live streams on the platform.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                <Button asChild variant="outline" className="w-full justify-start">
                    <Link href="/dashboard/admin/live-shopping/sessions">View Live Sessions</Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                    <Link href="/dashboard/admin/live-shopping/analytics">View Analytics</Link>
                </Button>
            </CardContent>
           </Card>

           <Card>
            <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                    <Megaphone className="text-primary"/>
                    Marketing & Growth
                </CardTitle>
                <CardDescription>Manage promotional content and send platform-wide announcements.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                 <Button asChild variant="outline" className="w-full justify-start">
                    <Link href="/dashboard/admin/marketing/sliders">Manage Homepage</Link>
                </Button>
                 <Button asChild variant="outline" className="w-full justify-start">
                    <Link href="/dashboard/admin/marketing/ads">Ads Manager</Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                    <Link href="/dashboard/admin/marketing/notifications">Send Notifications</Link>
                </Button>
            </CardContent>
           </Card>
        </div>
      </div>
    </AdminLayout>
  );
}