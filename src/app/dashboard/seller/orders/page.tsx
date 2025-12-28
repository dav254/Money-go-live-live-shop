
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, ShoppingCart, CheckCircle, Truck, XCircle, ListOrdered, MessageSquare, Users } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, orderBy, deleteDoc } from 'firebase/firestore';
import type { Order } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';

const OrderStatusBadge = ({ status }: { status: Order['orderStatus'] }) => {
  const statusConfig = {
    pending: { label: 'Pending', className: 'bg-yellow-500/80 hover:bg-yellow-500/70' },
    processing: { label: 'Processing', className: 'bg-blue-500/80 hover:bg-blue-500/70' },
    shipped: { label: 'Shipped', className: 'bg-indigo-500/80 hover:bg-indigo-500/70' },
    delivered: { label: 'Delivered', className: 'bg-green-600/80 hover:bg-green-600/70' },
    cancelled: { label: 'Cancelled', className: 'bg-red-500/80 hover:bg-red-500/70' },
    disputed: { label: 'Disputed', className: 'bg-orange-500/80 hover:bg-orange-500/70' },
    delivery: { label: 'In Delivery', className: 'bg-cyan-500/80 hover:bg-cyan-500/70' },
  };
  const config = statusConfig[status as keyof typeof statusConfig] || { label: 'Unknown', className: 'bg-gray-400' };
  return <Badge className={`capitalize ${config.className}`}>{config.label}</Badge>;
};


const AllOrdersTable = ({ orders, isLoading, refetch }: { orders: Order[], isLoading: boolean, refetch: () => void }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const handleStatusUpdate = async (orderId: string, newStatus: Order['orderStatus']) => {
        if (!firestore) return;
        const orderRef = doc(firestore, 'orders', orderId);
        try {
            await updateDoc(orderRef, { orderStatus: newStatus });
            toast({ title: 'Success', description: `Order marked as ${newStatus}.` });
            refetch(); // Trigger a re-fetch of the main data
        } catch (error) {
            console.error('Failed to update order status:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update order status.' });
        }
    };

    if (isLoading) {
       return (
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Total Amount</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[...Array(3)].map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    }

    if (!orders || orders.length === 0) {
       return <div className="flex h-64 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
            <h2 className="text-xl font-semibold">No Orders in this Category</h2>
            <p className="text-muted-foreground">This section is empty. New orders will appear here as their status changes.</p>
        </div>
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Total Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {orders.map(order => {
                        const productName = order.items?.[0]?.name || order.productName;
                        const productImage = order.items?.[0]?.imageUrl || order.productImage;
                        
                        return (
                            <TableRow key={order.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 rounded-md">
                                            <AvatarImage src={productImage} />
                                            <AvatarFallback>{(productName || 'P').charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium">{productName}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="font-bold text-primary">${order.totalAmount.toLocaleString()}</TableCell>
                                <TableCell>
                                    {order.orderDate?.toDate ? format(order.orderDate.toDate(), 'MMM d, yyyy') : 'N/A'}
                                </TableCell>
                                <TableCell>
                                    <OrderStatusBadge status={order.orderStatus} />
                                </TableCell>
                                <TableCell className="text-right">
                                    {order.orderStatus === 'shipped' || order.orderStatus === 'delivery' ? (
                                        <Badge variant="outline">Awaiting Buyer Confirmation</Badge>
                                    ) : order.orderStatus === 'delivered' ? (
                                         <Badge variant="default" className="bg-green-600/80">Completed</Badge>
                                    ) : order.orderStatus === 'pending' || order.orderStatus === 'processing' ? (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm">Manage</Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem><MessageSquare className="mr-2 h-4 w-4" />Contact Buyer</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                {order.orderStatus === 'pending' && <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, 'processing')}><Package className="mr-2 h-4 w-4" />Mark as Processing</DropdownMenuItem>}
                                                {order.orderStatus === 'processing' && <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, 'shipped')}><Truck className="mr-2 h-4 w-4" />Mark as Shipped</DropdownMenuItem>}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    ) : null}
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    );
};

const OrderSection = ({ orders, isLoading, refetch }: { orders: Order[], isLoading: boolean, refetch: () => void }) => {
    return (
         <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
                <TabsTrigger value="all"><ListOrdered className="mr-2 h-4 w-4"/>All</TabsTrigger>
                <TabsTrigger value="pending"><ShoppingCart className="mr-2 h-4 w-4" />New</TabsTrigger>
                <TabsTrigger value="processing"><Package className="mr-2 h-4 w-4"/>Processing</TabsTrigger>
                <TabsTrigger value="shipped"><Truck className="mr-2 h-4 w-4"/>Shipped</TabsTrigger>
                <TabsTrigger value="delivered"><CheckCircle className="mr-2 h-4 w-4"/>Delivered</TabsTrigger>
            </TabsList>
            <TabsContent value="all">
                <AllOrdersTable orders={orders} isLoading={isLoading} refetch={refetch} />
            </TabsContent>
             <TabsContent value="pending">
                <AllOrdersTable orders={orders.filter(o => o.orderStatus === 'pending')} isLoading={isLoading} refetch={refetch} />
            </TabsContent>
            <TabsContent value="processing">
                <AllOrdersTable orders={orders.filter(o => o.orderStatus === 'processing')} isLoading={isLoading} refetch={refetch} />
            </TabsContent>
            <TabsContent value="shipped">
                <AllOrdersTable orders={orders.filter(o => o.orderStatus === 'shipped')} isLoading={isLoading} refetch={refetch} />
            </TabsContent>
            <TabsContent value="delivered">
                 <AllOrdersTable orders={orders.filter(o => o.orderStatus === 'delivered')} isLoading={isLoading} refetch={refetch} />
            </TabsContent>
        </Tabs>
    )
}

export default function SellerOrdersPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();

    const ordersQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'orders'),
            where('sellerId', '==', user.uid)
        );
    }, [firestore, user]);

    const { data, isLoading: areOrdersLoading, refetch } = useCollection<Order>(ordersQuery);

    const sortedData = useMemo(() => {
        return data ? [...data].sort((a, b) => b.orderDate.toDate().getTime() - a.orderDate.toDate().getTime()) : [];
    }, [data]);

    const isLoading = isUserLoading || areOrdersLoading;

  return (
    <SellerLayout>
       <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          My Orders
        </h1>
        <OrderSection orders={sortedData} isLoading={isLoading} refetch={refetch || (() => {})} />
      </div>
    </SellerLayout>
  );
}
