'use client';

import React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Users,
  ShoppingBag,
  Eye,
  ScreenShare,
  Megaphone,
  ShieldAlert,
  ClipboardCheck,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { collection, query, where } from 'firebase/firestore';
import type { LiveSession, UserProfile, Product, Order } from '@/lib/types';

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
  <Card className="rounded-[1.5rem] border-white/5 bg-neutral-900/50 shadow-xl overflow-hidden relative group transition-all hover:border-primary/20">
    <div className={cn("absolute top-0 left-0 w-1 h-full opacity-20 group-hover:opacity-100 transition-opacity", color?.replace('text-', 'bg-') || 'bg-primary')} />
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">{title}</CardTitle>
      <Icon className={cn('h-4 w-4', color || 'text-muted-foreground')} />
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <Skeleton className="h-8 w-1/2" />
      ) : (
        <div className="text-2xl font-black font-cyber tracking-tighter">{value}</div>
      )}
    </CardContent>
  </Card>
);

export default function AdminDashboardPage() {
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();

  const isAdmin = userProfile?.userRole === 'admin';

  const usersQuery = useMemoFirebase(() => {
    if (!isAdmin || !firestore) return null;
    return query(collection(firestore, 'userProfiles'));
  }, [firestore, isAdmin]);

  const { data: allUsers, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);

  const activeSessionsQuery = useMemoFirebase(() => {
    if (!isAdmin || !firestore) return null;
    return query(collection(firestore, 'liveSessions'), where('status', '==', 'live'));
  }, [firestore, isAdmin]);

  const { data: liveSessions, isLoading: areLiveSessionsLoading } = useCollection<LiveSession>(activeSessionsQuery);

  const paidOrdersQuery = useMemoFirebase(() => {
    if (!isAdmin || !firestore) return null;
    return query(collection(firestore, 'orders'), where('orderStatus', '==', 'processing'));
  }, [firestore, isAdmin]);

  const { data: paidOrders, isLoading: areOrdersLoading } = useCollection<Order>(paidOrdersQuery);
  
  const stats = [
    {
      title: 'Active Signal Nodes',
      value: (allUsers?.length || 0).toLocaleString(), 
      icon: Users,
      isLoading: areUsersLoading,
      color: 'text-blue-500'
    },
    {
      title: 'Verified Payments',
      value: (paidOrders?.length || 0).toLocaleString(), 
      icon: Zap,
      isLoading: areOrdersLoading,
      color: 'text-primary'
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
      <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
        <h1 className="font-headline text-4xl font-black tracking-tight uppercase text-white leading-none">
          Vidnov <span className="text-primary italic">Controller</span>
        </h1>
        
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <Card className="rounded-[2.5rem] border-white/5 bg-neutral-900 shadow-2xl overflow-hidden">
            <CardHeader className="p-8 bg-white/5 border-b border-white/5">
                <CardTitle className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.2em] text-white">
                    <ClipboardCheck className="text-primary h-5 w-5"/>
                    FULFILLMENT QUEUE
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Coordinate delivery for verified payments</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-4">
                <div className="p-6 rounded-3xl bg-black/40 border border-white/5 flex items-center justify-between">
                    <div>
                        <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-1">AWAITING ACTION</p>
                        <p className="text-3xl font-black text-white">{paidOrders?.length || 0}</p>
                    </div>
                    <Button asChild className="h-12 rounded-2xl px-8 font-black uppercase tracking-widest text-[10px] bg-primary hover:bg-primary/90 text-white border-none shadow-xl shadow-primary/20">
                        <Link href="/dashboard/admin/orders/all">OPEN QUEUE</Link>
                    </Button>
                </div>
                <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest leading-relaxed">
                    Once payment is verified, the admin must notify the seller to dispatch the item and confirm courier details.
                </p>
            </CardContent>
           </Card>

           <Card className="rounded-[2.5rem] border-white/5 bg-neutral-900 shadow-2xl overflow-hidden">
            <CardHeader className="p-8 bg-white/5 border-b border-white/5">
                 <CardTitle className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.2em] text-white">
                    <Megaphone className="text-primary h-5 w-5"/>
                    MARKETING PROTOCOL
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Deploy platform-wide announcements</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-3">
                 <Button asChild variant="outline" className="w-full h-14 rounded-2xl justify-between px-6 border-white/5 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-tight">
                    <Link href="/dashboard/admin/marketing/sliders"><span>Manage Homepage Grid</span> <ChevronRight className="h-4 w-4 text-primary"/></Link>
                </Button>
                 <Button asChild variant="outline" className="w-full h-14 rounded-2xl justify-between px-6 border-white/5 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-tight">
                    <Link href="/dashboard/admin/marketing/ads"><span>Ads Manager Signal</span> <ChevronRight className="h-4 w-4 text-primary"/></Link>
                </Button>
                <Button asChild variant="outline" className="w-full h-14 rounded-2xl justify-between px-6 border-white/5 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-tight">
                    <Link href="/dashboard/admin/marketing/notifications"><span>Platform Broadcast</span> <ChevronRight className="h-4 w-4 text-primary"/></Link>
                </Button>
            </CardContent>
           </Card>
        </div>

        <Card className="rounded-3xl border-primary/20 bg-primary/5 p-6 flex items-center gap-6 shadow-inner">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                <ShieldAlert className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">System Integrity Check</p>
                <p className="text-xs font-bold text-neutral-400 uppercase leading-relaxed">
                    Encrypted Signal Active • All transactional data is hashed and verified against the network master node. 
                    Unauthorized access attempts are recorded in the secondary shadow log.
                </p>
            </div>
        </Card>
      </div>
    </AdminLayout>
  );
}