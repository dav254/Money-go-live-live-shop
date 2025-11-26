
'use client';

import React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    DollarSign, 
    Users, 
    ShoppingBag, 
    BarChart, 
    Video, 
    CircleDollarSign,
    Clock,
    Package,
    ShieldAlert
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import type { UserProfile, Product, Order, Payout } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const StatCard = ({ title, value, icon: Icon, color, isLoading }: { title: string, value: string, icon: React.ElementType, color?: string, isLoading: boolean }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className={cn('h-4 w-4 text-muted-foreground', color)} />
        </CardHeader>
        <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{value}</div>}
        </CardContent>
    </Card>
);

export default function AdminDashboardPage() {
  const firestore = useFirestore();

  // Queries for all data
  const { data: buyers, isLoading: loadingBuyers } = useCollection<UserProfile>(useMemoFirebase(() => query(collection(firestore, 'userProfiles'), where('userRole', '==', 'buyer')), [firestore]));
  const { data: sellers, isLoading: loadingSellers } = useCollection<UserProfile>(useMemoFirebase(() => query(collection(firestore, 'userProfiles'), where('userRole', '==', 'seller')), [firestore]));
  const { data: resellers, isLoading: loadingResellers } = useCollection<UserProfile>(useMemoFirebase(() => query(collection(firestore, 'userProfiles'), where('userRole', '==', 'reseller')), [firestore]));
  const { data: products, isLoading: loadingProducts } = useCollection<Product>(useMemoFirebase(() => query(collection(firestore, 'products')), [firestore]));
  const { data: orders, isLoading: loadingOrders } = useCollection<Order>(useMemoFirebase(() => query(collection(firestore, 'orders')), [firestore]));
  const { data: pendingPayouts, isLoading: loadingPayouts } = useCollection<Payout>(useMemoFirebase(() => query(collection(firestore, 'payouts'), where('status', '==', 'pending')), [firestore]));
  
  const isLoading = loadingBuyers || loadingSellers || loadingResellers || loadingProducts || loadingOrders || loadingPayouts;

  const todayStats = React.useMemo(() => {
    if (!orders) return { revenue: 0, count: 0 };
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayOrders = orders.filter(o => o.orderDate.toDate() >= todayStart);
    const revenue = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    return { revenue, count: todayOrders.length };
  }, [orders]);

  const stats = [
    { title: 'Total Buyers', value: (buyers?.length || 0).toLocaleString(), icon: Users, isLoading },
    { title: 'Total Sellers', value: (sellers?.length || 0).toLocaleString(), icon: Users, isLoading },
    { title: 'Total Resellers', value: (resellers?.length || 0).toLocaleString(), icon: Users, isLoading },
    { title: 'Total Products', value: (products?.length || 0).toLocaleString(), icon: ShoppingBag, isLoading },
    { title: 'Live Users Online', value: '1,890', icon: Video, color: 'text-red-500', isLoading: false }, // Placeholder
    { title: 'Today\'s Revenue', value: `$${todayStats.revenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-500', isLoading },
    { title: 'Commission Paid', value: '22,500', icon: CircleDollarSign, color: 'text-green-500', isLoading: false }, // Placeholder
    { title: 'Pending Payouts', value: `$${(pendingPayouts?.reduce((sum, p) => sum + p.amount, 0) || 0).toLocaleString()}`, icon: Clock, color: 'text-yellow-500', isLoading },
    { title: 'Daily Orders', value: todayStats.count.toLocaleString(), icon: Package, isLoading },
    { title: 'Flagged Issues', value: '12', icon: ShieldAlert, color: 'text-red-500', isLoading: false }, // Placeholder
  ]

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Admin Dashboard
        </h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {stats.map(stat => (
                <StatCard key={stat.title} {...stat} />
            ))}
        </div>
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
                <CardHeader>
                    <CardTitle>Sales Graph</CardTitle>
                </CardHeader>
                <CardContent className="h-96 flex items-center justify-center bg-muted/50 rounded-md">
                    <p className="text-muted-foreground">Sales graph will be displayed here.</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Server Status</CardTitle>
                </CardHeader>
                <CardContent className="h-96 flex items-center justify-center bg-muted/50 rounded-md">
                    <p className="text-muted-foreground">Server status will be displayed here.</p>
                </CardContent>
            </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
