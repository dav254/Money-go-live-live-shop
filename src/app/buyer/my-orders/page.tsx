
'use client';

import { useState } from 'react';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, MessageSquare, CheckCircle, Star } from 'lucide-react';
import Image from 'next/image';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, query, where, updateDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Order, SellerShop } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';


const ReviewDialog = ({ order }: { order: Order }) => {
    const { toast } = useToast();
    const [rating, setRating] = useState(0);

    const handleSubmitReview = () => {
        // In a real app, this would save the review to Firestore
        toast({
            title: 'Review Submitted!',
            description: 'Thank you for your feedback.',
        });
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Leave a Review for {order.productName}</DialogTitle>
                <DialogDescription>
                    Share your experience with this product to help other buyers.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                 <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                            key={star}
                            className={`h-8 w-8 cursor-pointer ${rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'}`}
                            onClick={() => setRating(star)}
                        />
                    ))}
                </div>
                <Textarea placeholder="Write your review here..." rows={5} />
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                    <Button onClick={handleSubmitReview}>Submit Review</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    )
}

const OrderCard = ({ order }: { order: Order }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const router = useRouter();

    const sellerShopRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'sellerShops', order.sellerId);
    }, [firestore, order.sellerId]);

    const { data: seller, isLoading } = useDoc<SellerShop>(sellerShopRef);

    const getStatusClass = (status: Order['orderStatus']) => {
        switch (status) {
            case 'delivered': return 'bg-green-600/80';
            case 'shipped': return 'bg-indigo-500/80';
            case 'processing': return 'bg-blue-500/80';
            case 'pending': return 'bg-yellow-500/80';
            case 'cancelled': return 'bg-red-500/80';
            default: return 'bg-gray-400/80';
        }
    };

    const handleConfirmDelivery = async () => {
        if (!firestore) return;
        const orderRef = doc(firestore, 'orders', order.id);
        try {
            await updateDoc(orderRef, { orderStatus: 'delivered' });
            toast({
                title: 'Order Complete!',
                description: 'You have confirmed delivery. Thank you for your purchase!',
            });
        } catch (error) {
            console.error('Failed to confirm delivery:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not update order status.',
            });
        }
    };
    
    const handleMessageSeller = async () => {
        if (!user || !firestore || order.sellerId === user.uid) {
            toast({ title: 'Cannot start chat', description: 'You cannot message yourself.' });
            return;
        }

        const chatsRef = collection(firestore, 'chats');
        const q = query(chatsRef, where('participantIds', 'array-contains', user.uid));
        
        try {
            const querySnapshot = await getDocs(q);
            let existingChatId: string | null = null;
            querySnapshot.forEach(doc => {
                if (doc.data().participantIds.includes(order.sellerId)) {
                    existingChatId = doc.id;
                }
            });

            if (existingChatId) {
                router.push(`/messages?chatWith=${order.sellerId}`);
            } else {
                const newChatRef = doc(chatsRef);
                await setDoc(newChatRef, {
                    id: newChatRef.id,
                    participantIds: [user.uid, order.sellerId],
                    lastMessage: 'Conversation started.',
                    lastMessageTimestamp: serverTimestamp(),
                });
                router.push(`/messages?chatWith=${order.sellerId}`);
            }
        } catch (error) {
            console.error("Error handling message seller: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not start chat.' });
        }
    };

    return (
        <Dialog>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between p-4">
                <div className="flex items-center gap-3">
                    {isLoading ? (
                        <>
                            <Skeleton className="h-6 w-6 rounded-full" />
                            <Skeleton className="h-4 w-24" />
                        </>
                    ) : (
                        <Link href={`/sellers/${order.sellerId}`} className="flex items-center gap-3 hover:underline">
                            <Avatar className="h-6 w-6">
                                <AvatarImage src={seller?.logoUrl} />
                                <AvatarFallback>{seller?.shopName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-semibold">{seller?.shopName}</span>
                        </Link>
                    )}
                </div>
                 <Badge variant="default" className={getStatusClass(order.orderStatus)}>
                    {order.orderStatus}
                </Badge>
            </CardHeader>
            <Separator />
            <CardContent className="p-4">
                <div className="flex gap-4">
                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md">
                         <Image src={order.productImage || 'https://picsum.photos/seed/product/200'} alt={order.productName || 'product image'} fill className="object-cover" />
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold">{order.productName}</p>
                        <p className="text-sm text-muted-foreground">Qty: {order.quantity}</p>
                        <p className="text-lg font-bold text-primary">${order.totalAmount.toLocaleString()}</p>
                    </div>
                </div>
            </CardContent>
            <Separator />
            <div className="flex items-center justify-end p-3 gap-2">
                <Button variant="ghost" onClick={handleMessageSeller}><MessageSquare className="mr-2 h-4 w-4" /> Chat with Seller</Button>
                {order.orderStatus === 'shipped' && <Button onClick={handleConfirmDelivery} variant="secondary"><CheckCircle className="mr-2 h-4 w-4" /> Confirm Delivery</Button>}
                {order.orderStatus === 'delivered' && 
                    <DialogTrigger asChild>
                        <Button variant="secondary">Leave a Review</Button>
                    </DialogTrigger>
                }
                {order.orderStatus === 'pending' && <Button variant="destructive" disabled>Cancel Order</Button>}
            </div>
        </Card>
        <ReviewDialog order={order} />
        </Dialog>
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
        if (!user || !firestore) return null;
        return query(collection(firestore, 'orders'), where('buyerId', '==', user.uid));
    }, [firestore, user]);

    const { data: orders, isLoading: isOrdersLoading } = useCollection<Order>(ordersQuery);

    const isLoading = isUserLoading || isOrdersLoading;

    const filteredOrders = (status: Order['orderStatus'] | Order['orderStatus'][]) => {
        const statuses = Array.isArray(status) ? status : [status];
        return orders?.filter(o => statuses.includes(o.orderStatus)) || [];
    }

  return (
    <BuyerLayout>
      <div className="container mx-auto max-w-7xl py-8">
        <h1 className="font-headline text-3xl font-bold mb-8">My Orders</h1>
        {isLoading ? <OrdersSkeleton /> : (
        <Tabs defaultValue="active">
          <TabsList className="mb-6 grid w-full grid-cols-3 md:grid-cols-5">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="processing">Processing</TabsTrigger>
            <TabsTrigger value="shipped">Shipped</TabsTrigger>
            <TabsTrigger value="delivered">Delivered</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="space-y-4">
             {filteredOrders(['pending']).length > 0 ? filteredOrders(['pending']).map(order => <OrderCard key={order.id} order={order} />) : <p className="text-muted-foreground text-center py-12">No active orders.</p>}
          </TabsContent>
          <TabsContent value="processing" className="space-y-4">
             {filteredOrders('processing').length > 0 ? filteredOrders('processing').map(order => <OrderCard key={order.id} order={order} />) : <p className="text-muted-foreground text-center py-12">No orders are currently processing.</p>}
          </TabsContent>
          <TabsContent value="shipped" className="space-y-4">
             {filteredOrders('shipped').length > 0 ? filteredOrders('shipped').map(order => <OrderCard key={order.id} order={order} />) : <p className="text-muted-foreground text-center py-12">No orders have been shipped yet.</p>}
          </TabsContent>
          <TabsContent value="delivered" className="space-y-4">
             {filteredOrders('delivered').length > 0 ? filteredOrders('delivered').map(order => <OrderCard key={order.id} order={order} />) : <p className="text-muted-foreground text-center py-12">No delivered orders.</p>}
          </TabsContent>
          <TabsContent value="cancelled" className="space-y-4">
             {filteredOrders('cancelled').length > 0 ? filteredOrders('cancelled').map(order => <OrderCard key={order.id} order={order} />) : <p className="text-muted-foreground text-center py-12">You have no cancelled orders.</p>}
          </TabsContent>
        </Tabs>
        )}
      </div>
    </BuyerLayout>
  );
}
