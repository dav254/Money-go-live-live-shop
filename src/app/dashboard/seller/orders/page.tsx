
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { InCartsTable } from '@/components/seller/in-carts-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, ShoppingCart, CheckCircle, Truck, CircleDot } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
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
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface ManagedOrder extends Order {
    productName?: string;
    productImage?: string;
    buyerName?: string;
}

const OrderStatusBadge = ({ status }: { status: Order['orderStatus'] }) => {
  const statusConfig = {
    pending: { label: 'Pending', className: 'bg-yellow-500/80' },
    processing: { label: 'Processing', className: 'bg-blue-500/80' },
    shipped: { label: 'Shipped', className: 'bg-indigo-500/80' },
    delivered: { label: 'Delivered', className: 'bg-green-600/80' },
    cancelled: { label: 'Cancelled', className: 'bg-red-500/80' },
    'in-cart': { label: 'In Cart', className: 'bg-gray-500/80' },
  };
  const config = statusConfig[status] || { label: 'Unknown', className: 'bg-gray-400' };
  return <Badge className={`capitalize ${config.className}`}>{config.label}</Badge>;
};


const AllOrdersTable = () => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const ordersQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'orders'), where('sellerId', '==', user.uid));
    }, [firestore, user]);

    const { data: orders, isLoading } = useCollection<ManagedOrder>(ordersQuery);

    const handleStatusUpdate = async (orderId: string, newStatus: Order['orderStatus']) => {
        const orderRef = doc(firestore, 'orders', orderId);
        try {
            await updateDoc(orderRef, { orderStatus: newStatus });
            toast({ title: 'Success', description: `Order marked as ${newStatus}.` });
        } catch (error) {
            console.error('Failed to update order status:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update order status.' });
        }
    };

    if (isLoading) {
        return <div className="flex h-64 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
            <p className="text-muted-foreground">Loading all orders...</p>
        </div>
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
                        <TableHead>Buyer ID</TableHead>
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
                            <TableCell className="font-bold text-primary">{order.totalAmount.toLocaleString()}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{order.buyerId}</TableCell>
                            <TableCell>
                                <OrderStatusBadge status={order.orderStatus} />
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm">Manage</Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {order.orderStatus === 'pending' && <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, 'processing')}>Mark as Processing</DropdownMenuItem>}
                                        {order.orderStatus === 'processing' && <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, 'shipped')}>Mark as Shipped</DropdownMenuItem>}
                                        {order.orderStatus === 'shipped' && <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, 'delivered')}>Mark as Delivered</DropdownMenuItem>}
                                        {order.orderStatus !== 'cancelled' && <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, 'cancelled')} className="text-destructive">Cancel Order</DropdownMenuItem>}
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
          Orders & Potential Sales
        </h1>
        <Tabs defaultValue="all-orders" className="space-y-4">
          <TabsList>
             <TabsTrigger value="all-orders">
              <CircleDot className="mr-2 h-4 w-4" />
              All Orders
            </TabsTrigger>
            <TabsTrigger value="in-carts">
              <ShoppingCart className="mr-2 h-4 w-4" />
              In Carts
            </TabsTrigger>
          </TabsList>
           <TabsContent value="all-orders" className="space-y-4">
             <AllOrdersTable />
          </TabsContent>
          <TabsContent value="in-carts" className="space-y-4">
            <InCartsTable />
          </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}
