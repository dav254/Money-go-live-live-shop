import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { products, sellers } from '@/lib/placeholder-data';
import { ChevronRight, Package, Truck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

const orders = [
  {
    id: 'ORD-001',
    status: 'shipped',
    seller: sellers[0],
    product: products[0],
    quantity: 1,
    total: 850,
    date: '2024-08-25',
  },
  {
    id: 'ORD-002',
    status: 'pending',
    seller: sellers[1],
    product: products[1],
    quantity: 1,
    total: 1200,
    date: '2024-08-24',
  },
  {
    id: 'ORD-003',
    status: 'delivered',
    seller: sellers[0],
    product: products[3],
    quantity: 2,
    total: 240,
    date: '2024-08-20',
  },
];

const OrderCard = ({ order }: { order: typeof orders[0] }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between p-4">
            <div className="flex items-center gap-3">
                <Avatar className="h-6 w-6">
                    <AvatarImage src={order.seller.avatar.imageUrl} />
                    <AvatarFallback>{order.seller.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="font-semibold">{order.seller.name}</span>
            </div>
             <Badge variant={
                order.status === 'delivered' ? 'default' :
                order.status === 'shipped' ? 'secondary' : 'destructive'
                } className={
                order.status === 'delivered' ? 'bg-green-600/80' :
                order.status === 'shipped' ? 'bg-yellow-500/80' : 'bg-red-500/80'
                }>
                {order.status}
            </Badge>
        </CardHeader>
        <Separator />
        <CardContent className="p-4">
            <div className="flex gap-4">
                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md">
                     <Image src={order.product.image.imageUrl} alt={order.product.name} fill className="object-cover" />
                </div>
                <div className="flex-1">
                    <p className="font-semibold">{order.product.name}</p>
                    <p className="text-sm text-muted-foreground">Qty: {order.quantity}</p>
                    <p className="text-lg font-bold text-primary">KES {order.total.toLocaleString()}</p>
                </div>
            </div>
        </CardContent>
        <Separator />
        <div className="flex items-center justify-end p-3 gap-2">
            <Button variant="ghost">View Details</Button>
            {order.status === 'shipped' && <Button><Truck className="mr-2 h-4 w-4" /> Track Order</Button>}
            {order.status === 'delivered' && <Button variant="secondary">Request Return</Button>}
        </div>
    </Card>
);

export default function MyOrdersPage() {
  return (
    <BuyerLayout>
      <div className="container mx-auto max-w-7xl py-8">
        <h1 className="font-headline text-3xl font-bold mb-8">My Orders</h1>
        <Tabs defaultValue="all">
          <TabsList className="mb-6">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="shipped">Shipped</TabsTrigger>
            <TabsTrigger value="delivered">Delivered</TabsTrigger>
            <TabsTrigger value="returns">Returns</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="space-y-4">
            {orders.map(order => <OrderCard key={order.id} order={order} />)}
          </TabsContent>
          <TabsContent value="pending" className="space-y-4">
            {orders.filter(o => o.status === 'pending').map(order => <OrderCard key={order.id} order={order} />)}
          </TabsContent>
          <TabsContent value="shipped" className="space-y-4">
             {orders.filter(o => o.status === 'shipped').map(order => <OrderCard key={order.id} order={order} />)}
          </TabsContent>
          <TabsContent value="delivered" className="space-y-4">
             {orders.filter(o => o.status === 'delivered').map(order => <OrderCard key={order.id} order={order} />)}
          </TabsContent>
          <TabsContent value="returns">
            <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground">No return requests found.</p>
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </BuyerLayout>
  );
}
