

'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { InCartsTable } from '@/components/seller/in-carts-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, ShoppingCart } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Order } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Hypothetical Order type, adjust based on your actual data structure
interface PendingOrder extends Order {
    productName?: string;
    productImage?: string;
    buyerName?: string; // You would need to fetch this
}

const PendingOrdersTable = () => {
    const { user } = useUser();
    const firestore = useFirestore();

    const pendingOrdersQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
            collection(firestore, 'orders'),
            where('sellerId', '==', user.uid),
            where('orderStatus', '==', 'pending')
        );
    }, [firestore, user]);

    const { data: orders, isLoading } = useCollection<PendingOrder>(pendingOrdersQuery);
    
    if (isLoading) {
        return <div className="flex h-64 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
            <p className="text-muted-foreground">Loading pending orders...</p>
        </div>
    }

    if (!orders || orders.length === 0) {
       return <div className="flex h-64 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
            <h2 className="text-xl font-semibold">No Pending Orders</h2>
            <p className="text-muted-foreground">New orders from buyers will appear here.</p>
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
                         <TableHead>Action</TableHead>
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
                                <Badge>{order.orderStatus}</Badge>
                            </TableCell>
                            <TableCell>
                                <Button>Fulfill Order</Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}


export default function SellerOrdersPage() {
  return (
    <SellerLayout>
       <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Orders & Potential Sales
        </h1>
        <Tabs defaultValue="in-carts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="in-carts">
              <ShoppingCart className="mr-2 h-4 w-4" />
              In Carts
            </TabsTrigger>
            <TabsTrigger value="pending-orders">
              <Package className="mr-2 h-4 w-4" />
              Pending Orders
            </TabsTrigger>
             <TabsTrigger value="completed-orders">
              Completed Orders
            </TabsTrigger>
          </TabsList>
          <TabsContent value="in-carts" className="space-y-4">
            <InCartsTable />
          </TabsContent>
          <TabsContent value="pending-orders" className="space-y-4">
             <PendingOrdersTable />
          </TabsContent>
          <TabsContent value="completed-orders" className="space-y-4">
            <div className="flex h-64 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
                <h2 className="text-xl font-semibold">No Completed Orders Yet</h2>
                <p className="text-muted-foreground">Your fulfilled orders and history will show up here.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}
