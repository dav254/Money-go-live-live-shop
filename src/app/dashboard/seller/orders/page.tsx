
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Package, ShoppingCart, CheckCircle, Truck, XCircle, ListOrdered, MessageSquare, Users } from 'lucide-react';
import type { Order, UserProfile } from '@/lib/types';
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
import React, { useState, useEffect, useCallback } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';


// This is the new type for the orders we'll receive from our API
interface ManagedOrder extends Order {
    buyerName?: string;
    resellerName?: string;
}

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


const AllOrdersTable = () => {
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [orders, setOrders] = useState<ManagedOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchOrders = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/seller/orders', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                throw new Error('Failed to fetch orders');
            }
            const data = await response.json();
            setOrders(data);
        } catch (error) {
            console.error("Error fetching orders:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not fetch your orders. Please try again.'
            });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);
    
    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const handleStatusUpdate = async (orderId: string, newStatus: Order['orderStatus']) => {
        if (!firestore) return;
        const orderRef = doc(firestore, 'orders', orderId);
        try {
            await updateDoc(orderRef, { orderStatus: newStatus });
            toast({ title: 'Success', description: `Order marked as ${newStatus}.` });
            fetchOrders(); // Refetch orders to update the UI
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
                            <TableHead>Amount</TableHead>
                            <TableHead>Source / Commission</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[...Array(3)].map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-32" /></TableCell>
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
            <p className="text-muted-foreground">Your sales history will appear here.</p>
        </div>
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Source / Commission</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {orders.map(order => (
                        <TableRow key={order.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10 rounded-md">
                                        <AvatarImage src={order.productImage} />
                                        <AvatarFallback>{order.productName?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{order.productName}</span>
                                </div>
                            </TableCell>
                            <TableCell className="font-bold text-primary">${order.totalAmount.toLocaleString()}</TableCell>
                            <TableCell>
                                {order.resellerId ? (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <span className="font-medium">{order.resellerName || 'Unknown Reseller'}</span>
                                            <p className="text-xs text-green-500 font-semibold">${(order.resellerCommission || 0).toFixed(2)} commission</p>
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-sm text-muted-foreground">Direct Sale</span>
                                )}
                            </TableCell>
                            <TableCell>
                                <OrderStatusBadge status={order.orderStatus} />
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm">Manage</Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem><MessageSquare className="mr-2 h-4 w-4" />Contact Buyer</DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        {order.orderStatus === 'pending' && <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, 'processing')}><Package className="mr-2 h-4 w-4" />Mark as Processing</DropdownMenuItem>}
                                        {order.orderStatus === 'processing' && <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, 'shipped')}><Truck className="mr-2 h-4 w-4" />Mark as Shipped</DropdownMenuItem>}
                                        {order.orderStatus === 'shipped' && <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, 'delivered')}><CheckCircle className="mr-2 h-4 w-4" />Mark as Delivered</DropdownMenuItem>}
                                        <DropdownMenuSeparator />
                                        {order.orderStatus !== 'cancelled' && order.orderStatus !== 'delivered' && <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, 'cancelled')} className="text-destructive"><XCircle className="mr-2 h-4 w-4" />Cancel Order</DropdownMenuItem>}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};


export default function SellerOrdersPage() {
  return (
    <SellerLayout>
       <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          My Orders
        </h1>
        <AllOrdersTable />
      </div>
    </SellerLayout>
  );
}
