
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck } from 'lucide-react';
import Image from 'next/image';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import type { Order, SellerShop } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const OrderCard = ({ order }: { order: Order }) => {
    const firestore = useFirestore();

    const sellerShopRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'sellerShops', order.sellerId);
    }, [firestore, order.sellerId]);

    const { data: seller, isLoading } = useDoc<SellerShop>(sellerShopRef);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between p-4">
                <div className="flex items-center gap-3">
                    {isLoading ? (
                        <Skeleton className="h-6 w-24" />
                    ) : (
                        <>
                        <Avatar className="h-6 w-6">
                            <AvatarImage src={seller?.logoUrl} />
                            <AvatarFallback>{seller?.shopName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold">{seller?.shopName}</span>
                        </>
                    )}
                </div>
                 <Badge variant={
                    order.orderStatus === 'delivered' ? 'default' :
                    order.orderStatus === 'shipped' ? 'secondary' : 'destructive'
                    } className={
                    order.orderStatus === 'delivered' ? 'bg-green-600/80' :
                    order.orderStatus === 'shipped' ? 'bg-yellow-500/80' : ''
                    }>
                    {order.orderStatus}
                </Badge>
            </CardHeader>
            <Separator />
            <CardContent className="p-4">
                <div className="flex gap-4">
                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md">
                         <Image src={order.productImage || ''} alt={order.productName || 'product image'} fill className="object-cover" />
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold">{order.productName}</p>
                        <p className="text-sm text-muted-foreground">Qty: {order.quantity}</p>
                        <p className="text-lg font-bold text-primary">{order.totalAmount.toLocaleString()}</p>
                    </div>
                </div>
            </CardContent>
            <Separator />
            <div className="flex items-center justify-end p-3 gap-2">
                <Button variant="ghost">View Details</Button>
                {order.orderStatus === 'shipped' && <Button><Truck className="mr-2 h-4 w-4" /> Track Order</Button>}
                {order.orderStatus === 'delivered' && <Button variant="secondary">Request Return</Button>}
            </div>
        </Card>
    );
};

const OrdersSkeleton = () => (
    <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
             <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                </CardHeader>
                <Separator />
                <CardContent className="p-4">
                    <div className="flex gap-4">
                        <Skeleton className="h-20 w-20 rounded-md" />
                        <div className="flex-1 space-y-2">
                             <Skeleton className="h-4 w-4/5" />
                             <Skeleton className="h-3 w-1/5" />
                             <Skeleton className="h-6 w-2/5" />
                        </div>
                    </div>
                </CardContent>
                 <Separator />
                <div className="flex items-center justify-end p-3 gap-2">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                </div>
            </Card>
        ))}
    </div>
);


export default function MyOrdersPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();

    const ordersQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'orders'), where('buyerId', '==', user.uid));
    }, [firestore, user]);

    const { data: orders, isLoading: isOrdersLoading } = useCollection<Order>(ordersQuery);

    const isLoading = isUserLoading || isOrdersLoading;

    const filteredOrders = (status: Order['orderStatus']) => {
        return orders?.filter(o => o.orderStatus === status) || [];
    }

  return (
    <BuyerLayout>
      <div className="container mx-auto max-w-7xl py-8">
        <h1 className="font-headline text-3xl font-bold mb-8">My Orders</h1>
        {isLoading ? <OrdersSkeleton /> : (
        <Tabs defaultValue="all">
          <TabsList className="mb-6">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="shipped">Shipped</TabsTrigger>
            <TabsTrigger value="delivered">Delivered</TabsTrigger>
            <TabsTrigger value="returns">Returns</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="space-y-4">
            {orders && orders.length > 0 ? orders.map(order => <OrderCard key={order.id} order={order} />) : <p className="text-muted-foreground text-center py-12">You have no orders.</p>}
          </TabsContent>
          <TabsContent value="pending" className="space-y-4">
             {filteredOrders('pending').length > 0 ? filteredOrders('pending').map(order => <OrderCard key={order.id} order={order} />) : <p className="text-muted-foreground text-center py-12">No pending orders.</p>}
          </TabsContent>
          <TabsContent value="shipped" className="space-y-4">
             {filteredOrders('shipped').length > 0 ? filteredOrders('shipped').map(order => <OrderCard key={order.id} order={order} />) : <p className="text-muted-foreground text-center py-12">No shipped orders.</p>}
          </TabsContent>
          <TabsContent value="delivered" className="space-y-4">
             {filteredOrders('delivered').length > 0 ? filteredOrders('delivered').map(order => <OrderCard key={order.id} order={order} />) : <p className="text-muted-foreground text-center py-12">No delivered orders.</p>}
          </TabsContent>
          <TabsContent value="returns">
            <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground">No return requests found.</p>
            </div>
          </TabsContent>

        </Tabs>
        )}
      </div>
    </BuyerLayout>
  );
}
