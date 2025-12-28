

'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, ShoppingCart, CheckCircle, Truck, XCircle, ListOrdered, MessageSquare, Users } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, updateDoc, orderBy, deleteDoc } from 'firebase/firestore';
import type { Order, UserProfile, Product } from '@/lib/types';
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

const ResellerInfo = ({ order }: { order: Order }) => {
    const productPrice = order.productPrice || 0;
    const platformFee = productPrice * 0.10;
    
    if (!order.resellerId) {
        const sellerNet = productPrice - platformFee;
        return (
            <div className="text-sm">
                <p className="font-medium">Direct Sale</p>
                <div className="text-xs text-muted-foreground space-y-1 mt-1">
                   <p>Platform Fee: <span className="font-semibold text-red-400">-${platformFee.toFixed(2)}</span></p>
                   <p>Your Net: <span className="font-semibold text-green-400">${sellerNet.toFixed(2)}</span></p>
                </div>
            </div>
        );
    }
    
    const resellerCommission = order.resellerCommission || 0;
    const sellerNet = productPrice - platformFee - resellerCommission;

    return (
        <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div>
                <p className="font-medium text-xs">Reseller ID: #{order.resellerId.substring(0,6)}...</p>
                <div className="text-xs text-muted-foreground space-y-1 mt-1">
                   <p>Reseller Share: <span className="font-semibold text-orange-400">-${resellerCommission.toFixed(2)}</span></p>
                   <p>Platform Fee: <span className="font-semibold text-red-400">-${platformFee.toFixed(2)}</span></p>
                   <p>Your Net: <span className="font-semibold text-green-400">${sellerNet.toFixed(2)}</span></p>
                </div>
            </div>
        </div>
    );
};

const OrderStatusBadge = ({ status }: { status: Order['orderStatus'] }) => {
  const statusConfig = {
    pending: { label: 'Pending', className: 'bg-yellow-500/80 hover:bg-yellow-500/70' },
    processing: { label: 'Processing', className: 'bg-blue-500/80 hover:bg-blue-500/70' },
    shipped: { label: 'Shipped', className: 'bg-indigo-500/80 hover:bg-indigo-500/70' },
    delivered: { label: 'Delivered', className: 'bg-green-600/80 hover:bg-green-600/70' },
    cancelled: { label: 'Cancelled', className: 'bg-red-500/80 hover:bg-red-500/70' },
    disputed: { label: 'Disputed', className: 'bg-orange-500/80 hover:bg-orange-500/70' },
  };
  const config = statusConfig[status as keyof typeof statusConfig] || { label: 'Unknown', className: 'bg-gray-400' };
  return <Badge className={`capitalize ${config.className}`}>{config.label}</Badge>;
};


const AllOrdersTable = ({ orders: initialOrders, isLoading, refetch }: { orders: Order[], isLoading: boolean, refetch: () => void }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [orders, setOrders] = useState(initialOrders);

    useEffect(() => {
        setOrders(initialOrders);
    }, [initialOrders]);

    const handleStatusUpdate = async (orderId: string, newStatus: Order['orderStatus']) => {
        if (!firestore) return;
        const orderRef = doc(firestore, 'orders', orderId);
        try {
            // Correctly pass only the fields to be updated
            await updateDoc(orderRef, { orderStatus: newStatus });
            toast({ title: 'Success', description: `Order marked as ${newStatus}.` });
            // Manually update local state for immediate UI feedback
            setOrders(prevOrders => prevOrders.map(o => o.id === orderId ? { ...o, orderStatus: newStatus } : o));
            refetch(); // Trigger a re-fetch of the main data
        } catch (error) {
            console.error('Failed to update order status:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update order status.' });
        }
    };
    
    const handleDelete = useCallback(async (orderId: string) => {
        if (!firestore) return;
        const orderRef = doc(firestore, 'orders', orderId);
        try {
            await deleteDoc(orderRef);
            toast({ title: 'Order Deleted', description: 'The order has been removed from your list.' });
            refetch();
        } catch (error) {
            console.error('Failed to delete order:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the order.' });
        }
    }, [firestore, toast, refetch]);

    if (isLoading) {
       return (
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Amount</TableHead>
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
            <h2 className="text-xl font-semibold">No Orders Found</h2>
            <p className="text-muted-foreground">This section is empty. New orders will appear here.</p>
        </div>
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {orders.map(order => {
                        const firstItem = order.items?.[0];
                        const productName = firstItem?.name || order.productName;
                        const productImage = firstItem?.imageUrl || order.productImage;
                        
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
                                    <AlertDialog>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm">Manage</Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem><MessageSquare className="mr-2 h-4 w-4" />Contact Buyer</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                {order.orderStatus === 'pending' && <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, 'processing')}><Package className="mr-2 h-4 w-4" />Mark as Processing</DropdownMenuItem>}
                                                {order.orderStatus === 'processing' && <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, 'shipped')}><Truck className="mr-2 h-4 w-4" />Mark as Shipped</DropdownMenuItem>}
                                                <DropdownMenuSeparator />
                                                {order.orderStatus !== 'cancelled' && order.orderStatus !== 'delivered' && <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, 'cancelled')} className="text-destructive"><XCircle className="mr-2 h-4 w-4" />Cancel Order</DropdownMenuItem>}
                                                <AlertDialogTrigger asChild>
                                                    <DropdownMenuItem className="text-destructive">Delete Order</DropdownMenuItem>
                                                </AlertDialogTrigger>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>This will permanently delete this order. This action cannot be undone.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(order.id)}>Delete Order</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
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

    const { directSales, resellerSales } = useMemo(() => {
        const direct: Order[] = [];
        const reseller: Order[] = [];
        
        const sortedData = data ? [...data].sort((a, b) => b.orderDate.toDate().getTime() - a.orderDate.toDate().getTime()) : [];

        if (sortedData) {
            sortedData.forEach(order => {
                if (order.resellerId) {
                    reseller.push(order);
                } else {
                    direct.push(order);
                }
            });
        }
        return { directSales: direct, resellerSales: reseller };
    }, [data]);

    const isLoading = isUserLoading || areOrdersLoading;

  return (
    <SellerLayout>
       <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          My Orders
        </h1>
        <OrderSection orders={data || []} isLoading={isLoading} refetch={refetch || (() => {})} />
      </div>
    </SellerLayout>
  );
}

    