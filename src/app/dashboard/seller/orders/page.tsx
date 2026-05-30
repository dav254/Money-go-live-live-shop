'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, 
  ShoppingCart, 
  CheckCircle, 
  Truck, 
  XCircle, 
  ListOrdered, 
  MessageSquare, 
  Trash2, 
  Loader2, 
  DollarSign, 
  AlertCircle,
  MoreVertical,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, orderBy, deleteDoc, serverTimestamp } from 'firebase/firestore';
import type { Order } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import React, { useMemo, useCallback, useState } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const OrderStatusBadge = ({ status }: { status: Order['orderStatus'] }) => {
  const statusConfig = {
    pending: { label: 'Awaiting Payment', className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' },
    processing: { label: 'Payment Verified', className: 'bg-green-600 text-white border-none' },
    shipped: { label: 'In Transit', className: 'bg-indigo-500/80' },
    delivery: { label: 'In Delivery', className: 'bg-cyan-500/80' },
    delivered: { label: 'Delivered', className: 'bg-green-600/80' },
    cancelled: { label: 'Cancelled', className: 'bg-red-500/80' },
    disputed: { label: 'Disputed', className: 'bg-orange-600/80' },
    refunded: { label: 'Refunded', className: 'bg-gray-500/80' },
  };
  const config = statusConfig[status as keyof typeof statusConfig] || { label: 'Unknown', className: 'bg-gray-400' };
  return <Badge className={cn("capitalize px-3 py-1 font-black text-[10px] tracking-widest", config.className)}>{config.label}</Badge>;
};

const AllOrdersTable = ({ orders, isLoading }: { orders: Order[], isLoading: boolean }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();

    const handleCancelOrder = async (orderId: string) => {
        if (!firestore || !user) return;
        try {
            const token = await user.getIdToken();
            const response = await fetch(`/api/admin/orders/${orderId}/status`, { 
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'cancelled' })
            });
            if (!response.ok) throw new Error('Failed to cancel order.');
            toast({ title: 'Order Cancelled' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    };

    if (isLoading && orders.length === 0) {
       return (
            <div className="rounded-3xl border border-white/5 overflow-hidden">
                <Table>
                    <TableHeader className="bg-neutral-900/50">
                        <TableRow className="border-white/5 hover:bg-transparent">
                            <TableHead className="text-[10px] font-black uppercase text-neutral-500 px-6 h-14">Product</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-neutral-500 h-14">Amount</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-neutral-500 h-14">Date</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-neutral-500 h-14">Status</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase text-neutral-500 px-6 h-14">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[...Array(3)].map((_, i) => (
                            <TableRow key={i} className="border-white/5 h-20">
                                <TableCell className="px-6"><Skeleton className="h-10 w-48 rounded-xl" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-16 rounded-xl" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-24 rounded-xl" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-20 rounded-xl" /></TableCell>
                                <TableCell className="text-right px-6"><Skeleton className="h-8 w-24 ml-auto rounded-xl" /></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    }

    if (orders.length === 0) {
       return (
        <div className="flex h-64 flex-col items-center justify-center gap-4 text-center rounded-[2rem] border border-dashed border-white/10 bg-neutral-900/20">
            <ListOrdered className="h-12 w-12 text-neutral-700" />
            <div className="space-y-1">
                <h2 className="text-lg font-black uppercase tracking-tighter text-white/50">Pipeline Clear</h2>
                <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest max-w-xs mx-auto">No orders currently match this filter.</p>
            </div>
        </div>
       )
    }

    return (
        <div className="rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl bg-neutral-900/50">
            <Table>
                <TableHeader className="bg-white/5">
                    <TableRow className="border-white/5 hover:bg-transparent">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14 px-6">Product</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14">Amount</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14">Date</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14">Status</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14 px-6">Manage</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {orders.map(order => {
                        const productName = order.items?.[0]?.name || order.productName || 'Unnamed Product';
                        const productImage = order.items?.[0]?.imageUrl || order.productImage;
                        
                        return (
                            <TableRow key={order.id} className="border-white/5 hover:bg-white/5 transition-colors h-20">
                                <TableCell className="px-6">
                                    <div className="flex items-center gap-3">
                                        <div className="relative h-10 w-10 rounded-xl overflow-hidden border border-white/10 shrink-0 shadow-lg bg-black">
                                            <Image src={productImage || 'https://placehold.co/100x100/111111/FFFFFF?text=P'} fill alt="product" className="object-cover" />
                                        </div>
                                        <span className="font-bold text-xs uppercase tracking-tight truncate max-w-[200px] text-white">{productName}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="font-black text-primary text-sm">${order.totalAmount.toLocaleString()}</TableCell>
                                <TableCell className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter">
                                    {order.orderDate?.toDate ? format(order.orderDate.toDate(), 'MMM d, yyyy') : 'N/A'}
                                </TableCell>
                                <TableCell>
                                    <OrderStatusBadge status={order.orderStatus} />
                                </TableCell>
                                <TableCell className="text-right px-6">
                                    <div className="flex items-center justify-end gap-2">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/10 text-neutral-400">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56 rounded-2xl shadow-2xl border-white/10 bg-neutral-950">
                                                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Order Support</DropdownMenuLabel>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/messages?chatWith=${order.buyerId}`} className="cursor-pointer font-bold text-xs uppercase">
                                                        <MessageSquare className="mr-2 h-4 w-4" />Chat with Buyer
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-white/5" />
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive font-bold text-xs uppercase tracking-widest focus:text-destructive focus:bg-destructive/10">
                                                            <Trash2 className="mr-2 h-4 w-4" /> CANCEL ORDER
                                                        </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="rounded-3xl border-white/10 bg-neutral-950 border-2">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="font-black uppercase tracking-tighter text-white">Cancel Transaction?</AlertDialogTitle>
                                                            <AlertDialogDescription className="text-xs font-bold text-neutral-500 uppercase tracking-widest leading-relaxed">
                                                                This will mark order #{order.id.substring(0, 8)}... as cancelled. This action is tracked for safety.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Close</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleCancelOrder(order.id)} className="bg-red-600 rounded-xl font-black uppercase text-[10px] border-none">
                                                                CONFIRM CANCEL
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
};

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

    const { data, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);

    const sortedData = useMemo(() => {
        return data ? [...data].sort((a, b) => (b.orderDate?.toDate?.()?.getTime() || 0) - (a.orderDate?.toDate?.()?.getTime() || 0)) : [];
    }, [data]);

    const isLoading = isUserLoading || areOrdersLoading;
    
    const filterOrders = useCallback((status: Order['orderStatus'] | Order['orderStatus'][]) => {
        const statuses = Array.isArray(status) ? status : [status];
        return sortedData.filter(o => statuses.includes(o.orderStatus));
    }, [sortedData]);

    const paidOrdersCount = filterOrders('processing').length;

  return (
    <SellerLayout>
       <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
                <h1 className="font-headline text-4xl font-black uppercase tracking-tighter text-white leading-none">
                    Merchant Pipeline
                </h1>
                <p className="text-muted-foreground font-medium text-[10px] uppercase tracking-widest mt-2 flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-primary" /> 
                    Fulfillment and escrow management
                </p>
            </div>
            
            {paidOrdersCount > 0 && (
                <Alert className="max-w-sm bg-primary/10 border-primary/20 text-primary rounded-2xl animate-in slide-in-from-top-4 duration-500">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <AlertTitle className="text-[10px] font-black uppercase tracking-widest">Payment Escrowed</AlertTitle>
                    <AlertDescription className="text-xs font-bold uppercase tracking-tight">You have {paidOrdersCount} order(s) with verified payment. Admin will chat with you soon to release delivery funds.</AlertDescription>
                </Alert>
            )}
        </div>

         <Tabs defaultValue="processing" className="space-y-6">
            <TabsList className="bg-neutral-900/50 p-1 border border-white/5 rounded-2xl h-14 overflow-hidden shadow-inner">
                <TabsTrigger value="processing" className="rounded-xl px-6 h-full data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest transition-all">
                    Paid ({paidOrdersCount})
                </TabsTrigger>
                <TabsTrigger value="pending" className="rounded-xl px-6 h-full data-[state=active]:bg-neutral-800 font-black uppercase text-[10px] tracking-widest transition-all">
                    Unpaid
                </TabsTrigger>
                <TabsTrigger value="shipped" className="rounded-xl px-6 h-full data-[state=active]:bg-neutral-800 font-black uppercase text-[10px] tracking-widest transition-all">
                    Transit
                </TabsTrigger>
                <TabsTrigger value="all" className="rounded-xl px-6 h-full data-[state=active]:bg-neutral-800 font-black uppercase text-[10px] tracking-widest transition-all">
                    History
                </TabsTrigger>
            </TabsList>

            <TabsContent value="processing" className="animate-in fade-in slide-in-from-left-2 duration-300">
                <AllOrdersTable orders={filterOrders('processing')} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="pending" className="animate-in fade-in slide-in-from-left-2 duration-300">
                <AllOrdersTable orders={filterOrders('pending')} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="shipped" className="animate-in fade-in slide-in-from-left-2 duration-300">
                <AllOrdersTable orders={filterOrders(['shipped', 'delivery'])} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="all" className="animate-in fade-in slide-in-from-left-2 duration-300">
                <AllOrdersTable orders={filterOrders(['delivered', 'cancelled', 'disputed', 'refunded'])} isLoading={isLoading} />
            </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}
