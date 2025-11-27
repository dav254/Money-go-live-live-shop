
'use client';

import React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

// --- Static Placeholder Data ---

const isLoading = false; // Set to false since we are using static data

const stats = [
    { title: 'Total Buyers', value: '1,250', icon: Users, isLoading },
    { title: 'Total Sellers', value: '150', icon: Users, isLoading },
    { title: 'Total Resellers', value: '300', icon: Users, isLoading },
    { title: 'Total Products', value: '2,400', icon: ShoppingBag, isLoading },
    { title: 'Live Users Online', value: '1,890', icon: Video, color: 'text-red-500', isLoading: false },
    { title: 'Today\'s Revenue', value: '$1,420', icon: DollarSign, color: 'text-green-500', isLoading },
    { title: 'Commission Paid', value: '$22,500', icon: CircleDollarSign, color: 'text-green-500', isLoading: false },
    { title: 'Pending Payouts', value: '$4,200', icon: Clock, color: 'text-yellow-500', isLoading },
    { title: 'Daily Orders', value: '89', icon: Package, isLoading },
    { title: 'Flagged Issues', value: '12', icon: ShieldAlert, color: 'text-red-500', isLoading: false },
];

const recentSales = [
    { id: 'ORD-001', productName: 'Classic Handbag', buyerName: 'Alice', totalAmount: 850 },
    { id: 'ORD-002', productName: 'NextGen Smartphone', buyerName: 'Bob', totalAmount: 1200 },
    { id: 'ORD-003', productName: 'Gourmet Pasta Kit', buyerName: 'Charlie', totalAmount: 45 },
];


// --- Component Definitions ---

const StatCard = ({ title, value, icon: Icon, color, isLoading }: { title: string, value: string, icon: React.ElementType, color?: string, isLoading: boolean }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className={cn('h-4 w-4 text-muted-foreground', color)} />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

const BuyerCell = ({ name }: { name: string }) => {
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarFallback>{name.charAt(0)}</AvatarFallback>
      </Avatar>
      <span className="text-xs font-medium">{name}</span>
    </div>
  );
};


export default function AdminDashboardPage() {

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
                        {recentSales.map(order => (
                           <TableRow key={order.id}>
                               <TableCell className="font-medium">{order.productName}</TableCell>
                               <TableCell><BuyerCell name={order.buyerName} /></TableCell>
                               <TableCell className="text-right">${order.totalAmount.toLocaleString()}</TableCell>
                           </TableRow>
                       ))}
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
