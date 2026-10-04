
'use client';

import { useState, useEffect, useMemo } from 'react';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, CheckCircle, Star, ShieldAlert, CreditCard, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, query, where, getDocs, setDoc, serverTimestamp, addDoc, updateDoc } from 'firebase/firestore';
import type { Order, SellerShop } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const ReviewDialog = ({ order }: { order: Order }) => {
    const { toast } = useToast();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [saving, setSaving] = useState(false);
    const { user } = useUser();

    /**
     * Goes through `/api/reviews`, NOT a direct client write.
     *
     * This used to `addDoc` into `products/{id}/reviews`. That was a second,
     * parallel review system: the shop page read a different collection, so
     * every review a buyer left from here was invisible to the business score —
     * which is why the platform had reviews and still showed nobody a rating.
     *
     * The API also decides who may review by reading the order document and
     * comparing it to the caller's token, which a client cannot be trusted to
     * check for itself.
     */
    const handleSubmitReview = async () => {
        if (rating === 0) {
            toast({ variant: 'destructive', title: 'Please select a rating.' });
            return;
        }
        if (!user) {
            toast({ variant: 'destructive', title: 'Please log in to review.' });
            return;
        }
        if (comment.trim().length < 3) {
            toast({ variant: 'destructive', title: 'Please add a few words.' });
            return;
        }

        setSaving(true);
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/reviews', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ orderId: order.id, rating, text: comment.trim() }),
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                toast({
                    variant: 'destructive',
                    title: 'Could not save your review',
                    description: result?.error || 'Please try again.',
                });
                return;
            }

            toast({
                title: 'Review submitted',
                description: 'It now counts towards this business rating.',
            });
        } catch (error) {
            console.error("Error submitting review:", error);
            toast({ variant: 'destructive', title: 'No connection', description: 'Your review was not saved.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Review your transaction</DialogTitle>
                <DialogDescription>
                    Your review counts towards the rating for {order.productName ? 'this order' : 'this service'}.
                    Only buyers who actually paid can leave one.
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
                <Textarea
                    placeholder="How did it go? What should the next buyer know?"
                    rows={5}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                />
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSubmitReview} disabled={saving}>
                    {saving ? 'Saving…' : 'Submit review'}
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}

const DisputeDialog = ({ order }: { order: Order }) => {
    const { toast } = useToast();
    const [reason, setReason] = useState('');
    const { user } = useUser();
    const firestore = useFirestore();

    const handleSubmitDispute = async () => {
        if (!reason.trim()) {
            toast({ variant: 'destructive', title: 'Please provide a reason for the dispute.' });
            return;
        }
        if (!user || !firestore) return;

        const orderRef = doc(firestore, 'orders', order.id);
        
        try {
            await updateDoc(orderRef, {
                orderStatus: 'disputed',
                disputeReason: reason,
            });
            toast({
                title: 'Dispute Submitted',
                description: 'Our team will review your case and get back to you.',
            });
        } catch (error) {
            console.error("Error submitting dispute:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not submit your dispute.' });
        }
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Report a Problem with Order #{order.id.substring(0,6)}</DialogTitle>
                <DialogDescription>
                    Please describe the issue you are having with this order. Our team will review the case.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <Textarea 
                    placeholder="Describe the issue... (e.g., item not as described, item not delivered, etc.)"
                    rows={6}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                />
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                    <Button variant="destructive" onClick={handleSubmitDispute}>Submit Dispute</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    )
}

const OrderCard = ({ order, setOptimisticOrders }: { order: Order, setOptimisticOrders: React.Dispatch<React.SetStateAction<Order[] | null | undefined>> }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const router = useRouter();
    const [proofFile, setProofFile] = useState<File | null>(null);

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
            case 'disputed': return 'bg-orange-600/80';
            default: return 'bg-gray-400/80';
        }
    };

    const handleConfirmDelivery = async () => {
        setOptimisticOrders(prevOrders =>
            prevOrders?.map(o =>
                o.id === order.id ? { ...o, orderStatus: 'delivered' } : o
            )
        );

        const formData = new FormData();
        formData.append("orderId", order.id);
        if (proofFile) {
            formData.append("proof", proofFile);
        }

        try {
            const response = await fetch("/api/orders/confirm-delivery", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Backend Error:", errorText);
                throw new Error('Server returned an error. See console for details.');
            }

            const result = await response.json();
            if (result.success) {
                toast({
                    title: "Delivery confirmed ✅",
                    description: "Your order has been marked as delivered.",
                });
            } else {
                throw new Error(result.error || "The server reported a failure.");
            }

        } catch (error) {
            console.error("Error confirming delivery:", error);
            let errorMessage = 'An unknown error occurred.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            toast({
                variant: "destructive",
                title: "Confirmation Failed",
                description: `Your order was moved locally, but the backend sync failed: ${errorMessage}`,
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
                // Same guard as the live and request flows: a chat document is
                // not guaranteed to carry `participantIds`, and reading it
                // unguarded throws on any legacy record that omits it.
                const ids: string[] = doc.data().participantIds ?? [];
                if (ids.includes(order.sellerId)) {
                    existingChatId = doc.id;
                }
            });

            if (existingChatId) {
                router.push(`/messages?chatWith=${order.sellerId}`);
            } else {
                const newChatRef = doc(collection(firestore, 'chats'));
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
            <Card className="overflow-hidden border-white/5 bg-neutral-900/50">
                <CardHeader className="flex flex-row items-center justify-between p-4 bg-white/5">
                    <div className="flex items-center gap-3">
                        {isLoading ? (
                            <>
                                <Skeleton className="h-6 w-6 rounded-full" />
                                <Skeleton className="h-4 w-24" />
                            </>
                        ) : (
                            <Link href={`/sellers/${order.sellerId}`} className="flex items-center gap-3 hover:underline">
                                <Avatar className="h-6 w-6 border border-white/10">
                                    <AvatarImage src={seller?.logoUrl} />
                                    <AvatarFallback>{seller?.shopName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="font-bold text-xs uppercase tracking-tighter">{seller?.shopName}</span>
                            </Link>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{order.orderDate?.toDate ? format(order.orderDate.toDate(), 'MMM d, yyyy') : ''}</span>
                        <Badge variant="default" className={cn("text-[8px] font-black uppercase tracking-[0.2em] border-none", getStatusClass(order.orderStatus))}>
                            {order.orderStatus}
                        </Badge>
                    </div>
                </CardHeader>
                <Separator className="bg-white/5" />
                <CardContent className="p-4">
                    <div className="flex gap-4">
                        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-lg">
                            <Image src={order.productImage || 'https://picsum.photos/seed/product/200'} alt={order.productName || 'product image'} fill className="object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-sm uppercase tracking-tight text-white truncate">{order.productName}</p>
                            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">Qty: {order.quantity}</p>
                            <p className="text-lg font-black text-primary tracking-tighter mt-2">${(order.totalAmount ?? order.productPrice ?? 0).toLocaleString()}</p>
                        </div>
                    </div>
                    {order.orderStatus === 'shipped' && (
                        <div className="mt-4 space-y-2 p-3 bg-white/5 rounded-xl border border-white/5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Upload Delivery Proof (Optional)</label>
                            <Input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files ? e.target.files[0] : null)} className="h-10 bg-black/40 border-white/10 text-xs" />
                        </div>
                    )}
                    {order.orderStatus === 'delivered' && order.deliveryProof && (
                        <div className="mt-4 space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Delivery Confirmation</p>
                            <a href={order.deliveryProof} target="_blank" rel="noopener noreferrer" className="block w-fit">
                                <Image
                                src={order.deliveryProof}
                                alt="Your delivery proof"
                                width={120}
                                height={80}
                                className="rounded-xl border border-white/10 object-cover hover:opacity-90 transition-opacity"
                                />
                            </a>
                        </div>
                    )}
                </CardContent>
                <Separator className="bg-white/5" />
                <div className="flex flex-wrap items-center justify-end p-3 gap-2 bg-black/20">
                    <Button variant="ghost" className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5" onClick={handleMessageSeller}>
                        <MessageSquare className="mr-2 h-3.5 w-3.5" /> Message Seller
                    </Button>
                    
                    {order.orderStatus === 'pending' && (
                        <>
                            <Button variant="ghost" size="sm" className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest text-neutral-500" disabled>
                                Cancel Order
                            </Button>
                            <Button asChild className="h-9 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 border-none">
                                <Link href={`/checkout/${order.id}`}>
                                    <CreditCard className="mr-2 h-3.5 w-3.5" /> PAY NOW <ArrowRight className="ml-1 h-3 w-3" />
                                </Link>
                            </Button>
                        </>
                    )}

                    {order.orderStatus === 'delivered' &&
                        <DialogTrigger asChild>
                            {/* Not "Rate Product" — an order can be a service, a
                                booking or a custom job, and this dialog reviews
                                the transaction rather than an item. */}
                            <Button variant="secondary" className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest">Rate this order</Button>
                        </DialogTrigger>
                    }
                    {order.orderStatus === 'shipped' && 
                        <>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest border-white/10">
                                    <ShieldAlert className="mr-2 h-3.5 w-3.5" /> Report Issue
                                </Button>
                            </DialogTrigger>
                            <Button className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest" onClick={handleConfirmDelivery}>
                                <CheckCircle className="mr-2 h-3.5 w-3.5" /> Item Received
                            </Button>
                        </>
                    }
                    {order.orderStatus === 'processing' && 
                        <DialogTrigger asChild>
                             <Button variant="outline" size="sm" className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest border-white/10">
                                <ShieldAlert className="mr-2 h-3.5 w-3.5" /> Dispute Order
                            </Button>
                        </DialogTrigger>
                    }
                </div>
            </Card>
            {order.orderStatus === 'delivered' ? <ReviewDialog order={order} /> : <DisputeDialog order={order} />}
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

const MyOrdersContent = () => {
    const { user } = useUser();
    const firestore = useFirestore();
    const [activeTab, setActiveTab] = useState('active');

    const ordersQuery = useMemo(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'orders'), where('buyerId', '==', user.uid));
    }, [firestore, user]);

    const { data: orders, isLoading: isOrdersLoading } = useCollection<Order>(ordersQuery);
    // `useCollection` hands back `null` before there is anything to hand back,
    // so this state is null-capable too. Declaring it `Order[] | undefined`
    // claimed a guarantee the hook does not make, and every `filteredOrders`
    // below already used `?.` — so the types were stricter than the runtime,
    // which is backwards.
    const [optimisticOrders, setOptimisticOrders] = useState<Order[] | null | undefined>(orders);

    useEffect(() => {
        setOptimisticOrders(orders);
    }, [orders]);

    const filteredOrders = (status: Order['orderStatus'] | Order['orderStatus'][]) => {
        const statuses = Array.isArray(status) ? status : [status];
        return optimisticOrders?.filter(o => statuses.includes(o.orderStatus)) || [];
    }

    if (isOrdersLoading) {
        return <OrdersSkeleton />;
    }

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-in fade-in duration-500">
          <TabsList className="mb-8 grid w-full grid-cols-5 h-14 bg-neutral-900/50 p-1 border border-white/5 rounded-2xl">
            <TabsTrigger value="active" className="rounded-xl data-[state=active]:bg-primary font-black uppercase text-[10px] tracking-widest">Active</TabsTrigger>
            <TabsTrigger value="pending" className="rounded-xl data-[state=active]:bg-neutral-800 font-black uppercase text-[10px] tracking-widest">Unpaid</TabsTrigger>
            <TabsTrigger value="shipped" className="rounded-xl data-[state=active]:bg-neutral-800 font-black uppercase text-[10px] tracking-widest">Transit</TabsTrigger>
            <TabsTrigger value="delivered" className="rounded-xl data-[state=active]:bg-neutral-800 font-black uppercase text-[10px] tracking-widest">History</TabsTrigger>
            <TabsTrigger value="cancelled" className="rounded-xl data-[state=active]:bg-neutral-800 font-black uppercase text-[10px] tracking-widest">Issues</TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="space-y-4">
             {filteredOrders(['pending', 'processing', 'shipped']).length > 0 ? filteredOrders(['pending', 'processing', 'shipped']).map(order => <OrderCard key={order.id} order={order} setOptimisticOrders={setOptimisticOrders} />) : <div className="text-center py-20 opacity-30 uppercase font-black tracking-widest text-xs">No active orders.</div>}
          </TabsContent>
          <TabsContent value="pending" className="space-y-4">
             {filteredOrders('pending').length > 0 ? filteredOrders('pending').map(order => <OrderCard key={order.id} order={order} setOptimisticOrders={setOptimisticOrders} />) : <div className="text-center py-20 opacity-30 uppercase font-black tracking-widest text-xs">No unpaid orders found.</div>}
          </TabsContent>
           <TabsContent value="shipped" className="space-y-4">
             {filteredOrders('shipped').length > 0 ? filteredOrders('shipped').map(order => <OrderCard key={order.id} order={order} setOptimisticOrders={setOptimisticOrders} />) : <div className="text-center py-20 opacity-30 uppercase font-black tracking-widest text-xs">No orders currently in transit.</div>}
          </TabsContent>
           <TabsContent value="delivered" className="space-y-4">
             {filteredOrders('delivered').length > 0 ? filteredOrders('delivered').map(order => <OrderCard key={order.id} order={order} setOptimisticOrders={setOptimisticOrders} />) : <div className="text-center py-20 opacity-30 uppercase font-black tracking-widest text-xs">You have no order history yet.</div>}
          </TabsContent>
          <TabsContent value="cancelled" className="space-y-4">
             {filteredOrders(['cancelled', 'disputed']).length > 0 ? filteredOrders(['cancelled', 'disputed']).map(order => <OrderCard key={order.id} order={order} setOptimisticOrders={setOptimisticOrders} />) : <div className="text-center py-20 uppercase font-black tracking-widest text-xs">Everything looks clear.</div>}
          </TabsContent>
        </Tabs>
    );
}

export default function MyOrdersPage() {
    const { isLoading: isUserLoading } = useUser();

    return (
        <BuyerLayout>
            <div className="container mx-auto max-w-4xl py-8">
                <div className="mb-10">
                    <h1 className="font-headline text-4xl font-black uppercase tracking-tighter text-white">Purchase History</h1>
                    <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] mt-2">Manage your active orders and track fulfillment progress.</p>
                </div>
                {isUserLoading ? <OrdersSkeleton /> : <MyOrdersContent />}
            </div>
        </BuyerLayout>
    );
}
