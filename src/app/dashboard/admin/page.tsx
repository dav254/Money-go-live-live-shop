
'use client';

import React, { useMemo } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
    DollarSign, 
    Users, 
    ShoppingBag, 
    Video, 
    CircleDollarSign,
    Clock,
    Package,
    ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, orderBy, limit } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import type { Order, UserProfile } from '@/lib/types';


// --- Component Definitions ---

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

const BuyerCell = ({ userId }: { userId: string }) => {
  const firestore = useFirestore();
  const userProfileRef = useMemoFirebase(() => doc(firestore, 'userProfiles', userId), [firestore, userId]);
  const { data: userProfile, isLoading } = useDoc<UserProfile>(userProfileRef);

  if (isLoading) {
    return (
        <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-20" />
        </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarImage src={userProfile?.profilePictureUrl} />
        <AvatarFallback>{userProfile?.fullName?.charAt(0)}</AvatarFallback>
      </Avatar>
      <span className="text-xs font-medium">{userProfile?.fullName || 'Unknown User'}</span>
    </div>
  );
};


export default function AdminDashboardPage() {
  const firestore = useFirestore();

  const buyersQuery = useMemoFirebase(() => query(collection(firestore, 'userProfiles'), where('userRole', '==', 'buyer')), [firestore]);
  const sellersQuery = useMemoFirebase(() => query(collection(firestore, 'userProfiles'), where('userRole', '==', 'seller')), [firestore]);
  const resellersQuery = useMemoFirebase(() => query(collection(firestore, 'userProfiles'), where('userRole', '==', 'reseller')), [firestore]);
  const productsQuery = useMemoFirebase(() => query(collection(firestore, 'products')), [firestore]);
  const recentOrdersQuery = useMemoFirebase(() => query(collection(firestore, 'orders'), where('orderStatus', '==', 'processing'), orderBy('orderDate', 'desc'), limit(5)), [firestore]);


  const { data: buyers, isLoading: isLoadingBuyers } = useCollection(buyersQuery);
  const { data: sellers, isLoading: isLoadingSellers } = useCollection(sellersQuery);
  const { data: resellers, isLoading: isLoadingResellers } = useCollection(resellersQuery);
  const { data: products, isLoading: isLoadingProducts } = useCollection(productsQuery);
  const { data: recentOrders, isLoading: isLoadingOrders } = useCollection<Order>(recentOrdersQuery);
  
  const isLoading = isLoadingBuyers || isLoadingSellers || isLoadingResellers || isLoadingProducts || isLoadingOrders;

  const stats = [
    { title: 'Total Buyers', value: (buyers?.length || 0).toLocaleString(), icon: Users, isLoading },
    { title: 'Total Sellers', value: (sellers?.length || 0).toLocaleString(), icon: Users, isLoading },
    { title: 'Total Resellers', value: (resellers?.length || 0).toLocaleString(), icon: Users, isLoading },
    { title: 'Total Products', value: (products?.length || 0).toLocaleString(), icon: ShoppingBag, isLoading },
    { title: 'Live Users Online', value: '1,890', icon: Video, color: 'text-red-500', isLoading: false }, // Placeholder
    { title: 'Today\'s Revenue', value: '$1,420', icon: DollarSign, color: 'text-green-500', isLoading: false }, // Placeholder
    { title: 'Commission Paid', value: '$22,500', icon: CircleDollarSign, color: 'text-green-500', isLoading: false }, // Placeholder
    { title: 'Pending Payouts', value: '$4,200', icon: Clock, color: 'text-yellow-500', isLoading: false }, // Placeholder
    { title: 'Daily Orders', value: '89', icon: Package, isLoading: false }, // Placeholder
    { title: 'Flagged Issues', value: '12', icon: ShieldAlert, color: 'text-red-500', isLoading: false }, // Placeholder
  ];

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
                    <CardTitle>Recent Sales</CardTitle>
                    <CardDescription>New orders that have been paid and are ready for processing.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Buyer</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                            [...Array(3)].map((_, i) => (
                                 <TableRow key={i}>
                                   <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                   <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                   <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                               </TableRow>
                            ))
                        ) : recentOrders && recentOrders.length > 0 ? (
                           recentOrders.map(order => (
                           <TableRow key={order.id}>
                               <TableCell className="font-medium">{order.productName}</TableCell>
                               <TableCell><BuyerCell userId={order.buyerId} /></TableCell>
                               <TableCell className="text-right">${order.totalAmount.toLocaleString()}</TableCell>
                           </TableRow>
                       ))
                       ) : (
                         <TableRow>
                            <TableCell colSpan={3} className="h-24 text-center">No recent orders to process.</TableCell>
                         </TableRow>
                       )}
                      </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Sales Graph</CardTitle>
                </CardHeader>
                <CardContent className="h-96 flex items-center justify-center bg-muted/50 rounded-md">
                    <p className="text-muted-foreground">Sales graph will be displayed here.</p>
                </CardContent>
            </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
