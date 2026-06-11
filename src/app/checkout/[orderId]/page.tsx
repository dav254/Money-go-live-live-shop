'use client';

import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { getDoc, doc } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import type { Order, Product } from '@/lib/types';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect, useMemo, use } from 'react';
import { Loader2, ShieldCheck, CreditCard, ChevronRight, PackageCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

function CheckoutSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Separator />
                     <div className="flex justify-between">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-16" />
                    </div>
                </CardContent>
            </Card>
            <div className="space-y-6">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        </div>
    );
}

const PayPalIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20.071 6.842C20.071 10.34 17.587 11.905 13.923 11.905H11.531C11.084 11.905 10.713 12.247 10.648 12.69L9.431 18.91C9.408 19.027 9.498 19.133 9.617 19.133H12.355C12.802 19.133 13.173 18.791 13.238 18.348L14.159 13.62C14.224 13.177 14.595 12.835 15.042 12.835H15.938C19.011 12.835 21.096 11.365 21.096 8.356C21.096 7.643 20.978 6.993 20.761 6.425C20.375 6.681 19.824 6.842 19.141 6.842L20.071 6.842Z" fill="#003087"/>
        <path d="M19.141 6.842C19.824 6.842 20.375 6.681 20.761 6.425C20.174 4.887 18.528 4 16.038 4H10.153C9.706 4 9.335 4.342 9.27 4.785L7.02 16.321C6.997 16.438 7.087 16.544 7.206 16.544H10.14C10.587 16.544 10.958 16.202 11.023 15.759L11.531 12.69C11.596 12.247 11.967 11.905 12.414 11.905H14.806C18.47 11.905 20.954 10.34 20.954 6.842C20.954 6.842 20.954 6.842 20.954 6.842H19.141Z" fill="#009CDE"/>
        <path d="M11.023 15.759L11.531 12.69C11.596 12.247 11.967 11.905 12.414 11.905H14.806C18.47 11.905 20.954 10.34 20.954 6.842C20.954 6.842 20.954 6.842 20.954 6.842H20.375 6.681 19.824 6.842 19.141 6.842H20.071L19.141 6.842Z" fill="#012169"/>
    </svg>
);

const PaystackIcon = () => (
    <div className="flex items-center gap-1">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM11 17L7 13L8.41 11.59L11 14.17L15.59 9.58L17 11L11 17Z" fill="#011b33"/>
        </svg>
        <span className="bg-[#011b33] text-[8px] text-white px-1 rounded font-black uppercase tracking-tighter">M-PESA</span>
    </div>
);

export default function CheckoutPage(props: { params: Promise<{ orderId: string }> }) {
    const params = use(props.params);
    const orderId = params.orderId;
    const firestore = useFirestore();
    const { user, isLoading: isUserLoading } = useUser();
    const { toast } = useToast();
    const [isLoadingPayment, setIsLoadingPayment] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const orderRef = useMemoFirebase(() => {
        if (!orderId || !firestore) return null;
        return doc(firestore, 'orders', orderId);
    }, [firestore, orderId]);

    const { data: order, isLoading: isLoadingOrder, error: orderError } = useDoc<Order>(orderRef);
    
    const [liveShippingCost, setLiveShippingCost] = useState<number>(0);
    const [isLoadingShipping, setIsLoadingShipping] = useState(true);

    useEffect(() => {
        const fetchSellerShipping = async () => {
            if (order?.sellerId && firestore) {
                setIsLoadingShipping(true);
                const firstItemProductId = order.items?.[0]?.productId || order.productId;
                if (!firstItemProductId) {
                    setIsLoadingShipping(false);
                    return;
                }
                const productRef = doc(firestore, 'products', firstItemProductId);
                const productSnap = await getDoc(productRef);
                if (productSnap.exists()) {
                    const productData = productSnap.data() as Product;
                    setLiveShippingCost(productData.shippingCost || 0);
                }
                setIsLoadingShipping(false);
            }
        };
        if (isMounted) fetchSellerShipping();
    }, [order, firestore, isMounted]);
    
    const subtotal = order?.subtotal ?? order?.productPrice ?? 0;
    const liveTotalAmount = subtotal + liveShippingCost;
    
    const isLoading = !isMounted || isLoadingOrder || isUserLoading || isLoadingShipping;

    const orderItems = useMemo(() => {
        if (!order) return [];
        if (order.items && order.items.length > 0) return order.items;
        if (order.productId && order.productName && order.productPrice) {
            return [{
                productId: order.productId,
                name: order.productName,
                price: order.productPrice,
                quantity: order.quantity || 1,
                imageUrl: order.productImage || getPlaceholderImage(),
            }];
        }
        return [];
    }, [order]);

    const handlePayment = async (gateway: 'paystack' | 'paypal') => {
        if (!order || !user?.email) {
            toast({ variant: 'destructive', title: 'Details missing' });
            return;
        }

        setIsLoadingPayment(gateway);
        try {
            const response = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: order.id,
                    amount: liveTotalAmount,
                    email: user.email,
                    gateway: gateway,
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.details || 'Payment setup failed');
            if (data.checkoutUrl) window.location.href = data.checkoutUrl;
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Payment Error', description: err.message });
            setIsLoadingPayment(null);
        }
    };

    if (isLoading) return <BuyerLayout><div className="container py-12"><CheckoutSkeleton /></div></BuyerLayout>;
    if (orderError || !order) return <BuyerLayout><div className="container py-12 text-center">Order not found.</div></BuyerLayout>;
    
    if (order.orderStatus !== 'pending') {
         return (
            <BuyerLayout>
                <div className="container py-12 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="p-6 rounded-full bg-green-500/10 border border-green-500/20">
                        <PackageCheck className="h-20 w-20 text-green-500" />
                    </div>
                    <h1 className="font-headline text-4xl font-black uppercase tracking-tighter text-white">Payment Received!</h1>
                    <Button asChild className="h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs"><Link href="/buyer/my-orders">VIEW MY ORDERS</Link></Button>
                </div>
            </BuyerLayout>
        )
    }

    return (
        <BuyerLayout>
            <div className="container py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    <Card className="border-white/5 bg-card/50">
                        <CardHeader>
                            <CardTitle className="font-headline text-xl uppercase tracking-tight">Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {orderItems.map((item) => (
                                <div key={item.productId} className="flex items-center gap-4">
                                    <div className="relative h-16 w-16 rounded-xl overflow-hidden border">
                                        <Image src={item.imageUrl || getPlaceholderImage()} alt={item.name || 'Product'} fill className="object-cover" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm truncate uppercase tracking-tight">{item.name}</p>
                                        <p className="text-[10px] font-black uppercase text-muted-foreground">Qty: {item.quantity}</p>
                                    </div>
                                    <p className="ml-auto font-black text-sm text-primary">${(item.price * item.quantity).toLocaleString()}</p>
                                </div>
                            ))}
                            <Separator className="bg-white/5" />
                            <div className="space-y-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                <div className="flex justify-between"><p>Subtotal</p><p>${subtotal.toLocaleString()}</p></div>
                                <div className="flex justify-between"><p>Shipping</p><p>${liveShippingCost.toLocaleString()}</p></div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-white/5 p-6 rounded-b-lg border-t border-white/5">
                            <div className="flex justify-between w-full items-center">
                                <p className="text-2xl font-black tracking-tighter text-white">USD ${liveTotalAmount.toLocaleString()}</p>
                                <ShieldCheck className="h-8 w-8 text-primary/40" />
                            </div>
                        </CardFooter>
                    </Card>

                    <div className="space-y-6">
                        <h2 className="text-sm font-black uppercase tracking-widest text-white/50">Payment Method</h2>
                        <div className="grid gap-3">
                            <Button size="lg" className="w-full justify-start gap-4 h-20 rounded-2xl bg-white text-black hover:bg-neutral-200 border-none group" onClick={() => handlePayment('paystack')} disabled={!!isLoadingPayment}>
                                <div className="h-12 w-12 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 border"><PaystackIcon /></div>
                                <div className="text-left"><p className="font-black text-sm uppercase tracking-widest">Paystack</p><p className="text-[10px] font-bold text-neutral-500">M-PESA / CARD</p></div>
                            </Button>

                            <Button size="lg" className="w-full justify-start gap-4 h-20 rounded-2xl bg-[#0070BA] hover:bg-[#005ea6] text-white border-none group" onClick={() => handlePayment('paypal')} disabled={!!isLoadingPayment}>
                                <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center shrink-0 border"><PayPalIcon /></div>
                                <div className="text-left"><p className="font-black text-sm uppercase tracking-widest">PayPal</p><p className="text-[10px] font-bold text-white/60 uppercase">CREDIT & WALLET</p></div>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </BuyerLayout>
    )
}
