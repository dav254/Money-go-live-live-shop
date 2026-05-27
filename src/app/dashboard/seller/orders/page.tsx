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
  Users, 
  Trash2, 
  Loader2, 
  DollarSign, 
  AlertCircle,
  MoreVertical
} from 'lucide-react';
import Link from 'next/link';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import React, { useMemo, useCallback, useState } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const OrderStatusBadge = ({ status }: { status: Order['orderStatus'] }) => {
  const statusConfig = {
    pending: { label: 'Awaiting Payment', className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' },
    processing: { label: 'Paid - Ready to Ship', className: 'bg-green-600 text-white border-none animate-pulse' },
    shipped: { label: 'In Transit', className: 'bg-indigo-500/80 hover:bg-indigo-500/70' },
    delivery: { label: 'In Delivery', className: 'bg-cyan-500/80 hover:bg-cyan-500/70' },
    delivered: { label: 'Delivered', className: 'bg-green-600/80 hover:bg-green-600/70' },
    cancelled: { label: 'Cancelled', className: 'bg-red-500/80 hover:bg-red-500/70' },
    disputed: { label: 'Disputed', className: 'bg-orange-500/80 hover:bg-orange-500/70' },
  };
  const config = statusConfig[status as keyof typeof statusConfig] || { label: 'Unknown', className: 'bg-gray-400' };
  return <Badge className={cn("capitalize px-3 py-1 font-black text-[10px] tracking-widest", config.className)}>{config.label}</Badge>;
};

const DispatchDialogContent = ({ order, onDispatch, onCancel }: { order: Order, onDispatch: (shippingProvider: string, dispatchNote: string) => Promise<void>, onCancel: () => void }) => {
    const [courierName, setCourierName] = useState('');
    const [dispatchNote, setDispatchNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleDispatch = async () => {
        setIsSaving(true);
        await onDispatch(courierName, dispatchNote);
        setIsSaving(false);
    };
    
    return (
        <>
            <DialogHeader>
                <DialogTitle>Dispatch Order #{order.id.substring(0,6)}</DialogTitle>
                <DialogDescription>Enter the shipping details for this order.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="courierName">Courier/Shipping Provider</Label>
                    <Input id="courierName" placeholder="e.g., G4S, Wells Fargo, DHL" value={courierName} onChange={e => setCourierName(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="dispatchNote">Dispatch Note (Tracking #, etc.)</Label>
                    <Textarea id="dispatchNote" placeholder="Add tracking number or any other relevant delivery info here." value={dispatchNote} onChange={e => setDispatchNote(e.target.value)} />
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button onClick={handleDispatch} disabled={isSaving || !courierName}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Mark as Shipped
                </Button>
            </DialogFooter>
        </>
    )
}

const AllOrdersTable = ({ orders, isLoading }: { orders: Order[], isLoading: boolean }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isDispatching, setIsDispatching] = useState(false);

    const handleStatusUpdate = async (orderId: string, newStatus: Order['orderStatus']) => {
        if (!firestore) return;
        const orderRef = doc(firestore, 'orders', orderId);
        try {
            await updateDoc(orderRef, { orderStatus: newStatus });
            toast({ title: 'Success', description: `Order marked as ${newStatus}.` });
        } catch (error) {
            console.error('Failed to update order status:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update order status.' });
        }
    };
    
    const handleDispatch = async (orderId: string, shippingProvider: string, dispatchNote: string) => {
        if (!firestore) return;
        const orderRef = doc(firestore, 'orders', orderId);
        try {
            await updateDoc(orderRef, { 
                orderStatus: 'shipped',
                shippingProvider: shippingProvider,
                courierName: shippingProvider,
                dispatchNote: dispatchNote,
             });
            toast({ title: 'Success', description: `Order marked as shipped.` });
        } catch (error) {
            console.error('Failed to update order status:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update order status.' });
        }
    };

    const handleDeleteOrder = async (orderId: string) => {
        if (!firestore || !user) return;
        
        try {
            const token = await user.getIdToken();
            const response = await fetch(`/api/orders/${orderId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete the order.');
            }

            toast({ title: 'Order Deleted', description: 'The order has been removed.' });
        } catch (error: any) {
            console.error('Failed to delete order:', error);
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not delete the order.' });
        }
    };

    if (isLoading && orders.length === 0) {
       return (
            <div className="rounded-md border border-white/5">
                <Table>
                    <TableHeader className="bg-neutral-900/50">
                        <TableRow className="border-white/5">
                            <TableHead>Product</TableHead>
                            <TableHead>Total Amount</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[...Array(3)].map((_, i) => (
                            <TableRow key={i} className="border-white/5">
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

    if (orders.length === 0) {
       return <div className="flex h-64 flex-col items-center justify-center gap-4 text-center rounded-3xl border border-dashed border-white/10 bg-neutral-900/20">
            <ListOrdered className="h-12 w-12 text-neutral-700" />
            <div className="space-y-1">
                <h2 className="text-lg font-black uppercase tracking-tighter text-white/50">No Orders Found</h2>
                <p className="text-neutral-500 text-xs font-medium max-w-xs mx-auto">This category is currently empty. New orders will appear here as buyers shop.</p>
            </div>
        </div>
    }

    return (
        <>
            <div className="rounded-md border border-white/5 overflow-hidden shadow-2xl">
                <Table>
                    <TableHeader className="bg-neutral-900/50">
                        <TableRow className="border-white/5 hover:bg-transparent">
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Product</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Total Amount</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Date</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Status</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-neutral-500">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map(order => {
                            const productName = order.items?.[0]?.name || order.productName || 'Unnamed Product';
                            const productImage = order.items?.[0]?.imageUrl || order.productImage;
                            
                            return (
                                <TableRow key={order.id} className="border-white/5 hover:bg-white/5 group h-16">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 rounded-xl overflow-hidden border border-white/10 shrink-0">
                                                <AvatarImage src={productImage} />
                                                <AvatarFallback>{productName?.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-bold text-xs uppercase tracking-tight truncate max-w-[200px]">{productName}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-black text-primary text-sm">${order.totalAmount.toLocaleString()}</TableCell>
                                    <TableCell className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter">
                                        {order.orderDate?.toDate ? format(order.orderDate.toDate(), 'MMM d, yyyy') : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                        <OrderStatusBadge status={order.orderStatus} />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white/10">
                                                    <MoreVertical className="h-4 w-4 text-neutral-400" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-2xl border-white/10">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/messages?chatWith=${order.buyerId}`} className="cursor-pointer font-bold text-xs uppercase">
                                                        <MessageSquare className="mr-2 h-4 w-4" />Contact Buyer
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-white/5" />
                                                
                                                {order.orderStatus === 'pending' && (
                                                    <DropdownMenuItem disabled className="text-muted-foreground italic text-xs">Waiting for buyer payment...</DropdownMenuItem>
                                                )}

                                                {order.orderStatus === 'processing' && (
                                                    <DropdownMenuItem 
                                                        onSelect={() => {
                                                            setSelectedOrder(order);
                                                            setIsDispatching(true);
                                                        }} 
                                                        className="font-black text-xs uppercase text-primary"
                                                    >
                                                        <Truck className="mr-2 h-4 w-4" />MARK AS SHIPPED
                                                    </DropdownMenuItem>
                                                )}

                                                {order.orderStatus === 'shipped' && (
                                                    <DropdownMenuItem disabled className="text-green-500/70 text-xs font-bold uppercase tracking-widest">Awaiting Confirmation</DropdownMenuItem>
                                                )}

                                                {(order.orderStatus === 'delivered' || order.orderStatus === 'cancelled' || order.orderStatus === 'disputed') && (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive font-bold text-xs uppercase tracking-widest">
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                DELETE ORDER
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="rounded-3xl border-white/10 bg-neutral-950">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle className="font-black uppercase tracking-tighter text-white">Permanent Deletion?</AlertDialogTitle>
                                                                <AlertDialogDescription className="text-xs font-bold text-neutral-500 uppercase tracking-widest leading-relaxed">
                                                                    This will remove the record of order #{order.id.substring(0, 8)}... permanently from your dashboard.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteOrder(order.id)} className="bg-red-600 rounded-xl font-black uppercase text-[10px]">
                                                                    CONFIRM DELETE
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDispatching} onOpenChange={setIsDispatching}>
                {selectedOrder && (
                    <DialogContent className="rounded-3xl border-white/10 bg-neutral-950">
                        <DispatchDialogContent 
                            order={selectedOrder} 
                            onDispatch={async (provider, note) => {
                                await handleDispatch(selectedOrder.id, provider, note);
                                setIsDispatching(false);
                            }}
                            onCancel={() => setIsDispatching(false)}
                        />
                    </DialogContent>
                )}
            </Dialog>
        </>
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
        return data ? [...data].sort((a, b) => b.orderDate.toDate().getTime() - a.orderDate.toDate().getTime()) : [];
    }, [data]);

    const isLoading = isUserLoading || areOrdersLoading;
    
    const filterOrders = useCallback((status: Order['orderStatus'] | Order['orderStatus'][]) => {
        const statuses = Array.isArray(status) ? status : [status];
        return sortedData.filter(o => statuses.includes(o.orderStatus));
    }, [sortedData]);

    const readyToShipCount = filterOrders('processing').length;

  return (
    <SellerLayout>
       <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="font-headline text-3xl font-black uppercase tracking-tighter text-white">
                    Merchant Orders
                </h1>
                <p className="text-muted-foreground font-medium text-[10px] uppercase tracking-widest mt-1">Manage fulfillment and track your sales history</p>
            </div>
            
            {readyToShipCount > 0 && (
                <Alert className="max-w-sm bg-primary/10 border-primary/20 text-primary rounded-2xl">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <AlertTitle className="text-[10px] font-black uppercase tracking-widest">Fulfillment Alert</AlertTitle>
                    <AlertDescription className="text-xs font-bold uppercase tracking-tight">You have {readyToShipCount} paid order(s) waiting to be shipped!</AlertDescription>
                </Alert>
            )}
        </div>

         <Tabs defaultValue="processing" className="space-y-6">
            <TabsList className="bg-neutral-900/50 p-1 border border-white/5 rounded-2xl">
                <TabsTrigger value="processing" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest">
                    Ready to Ship ({readyToShipCount})
                </TabsTrigger>
                <TabsTrigger value="pending" className="rounded-xl px-6 data-[state=active]:bg-neutral-800 font-black uppercase text-[10px] tracking-widest">
                    Awaiting Payment
                </TabsTrigger>
                <TabsTrigger value="shipped" className="rounded-xl px-6 data-[state=active]:bg-neutral-800 font-black uppercase text-[10px] tracking-widest">
                    In Transit
                </TabsTrigger>
                <TabsTrigger value="all" className="rounded-xl px-6 data-[state=active]:bg-neutral-800 font-black uppercase text-[10px] tracking-widest">
                    All History
                </TabsTrigger>
            </TabsList>

            <TabsContent value="processing">
                <AllOrdersTable orders={filterOrders('processing')} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="pending">
                <AllOrdersTable orders={filterOrders('pending')} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="shipped">
                <AllOrdersTable orders={filterOrders(['shipped', 'delivery', 'delivered'])} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="all">
                <AllOrdersTable orders={sortedData} isLoading={isLoading} />
            </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}