'use client';

import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
<<<<<<< HEAD
import { getDoc, doc } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import type { Order, Product } from '@/lib/types';
=======
import { useParams } from 'next/navigation';
import type { Order } from '@/lib/types';
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
<<<<<<< HEAD
import { Separator } from '@/components/ui/separator';
import { useState, useEffect, useMemo, use } from 'react';
import { Loader2, ShieldCheck, CreditCard, ChevronRight, PackageCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import Link from 'next/link';

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
=======
import { useState, useEffect, useMemo } from 'react';
import { Loader2, ShieldCheck, PackageCheck, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getLocationFromStorage, type UserLocation } from '@/lib/location-detection';
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f

const PayPalIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20.071 6.842C20.071 10.34 17.587 11.905 13.923 11.905H11.531C11.084 11.905 10.713 12.247 10.648 12.69L9.431 18.91C9.408 19.027 9.498 19.133 9.617 19.133H12.355C12.802 19.133 13.173 18.791 13.238 18.348L14.159 13.62C14.224 13.177 14.595 12.835 15.042 12.835H15.938C19.011 12.835 21.096 11.365 21.096 8.356C21.096 7.643 20.978 6.993 20.761 6.425C20.375 6.681 19.824 6.842 19.141 6.842L20.071 6.842Z" fill="#003087"/>
        <path d="M19.141 6.842C19.824 6.842 20.375 6.681 20.761 6.425C20.174 4.887 18.528 4 16.038 4H10.153C9.706 4 9.335 4.342 9.27 4.785L7.02 16.321C6.997 16.438 7.087 16.544 7.206 16.544H10.14C10.587 16.544 10.958 16.202 11.023 15.759L11.531 12.69C11.596 12.247 11.967 11.905 12.414 11.905H14.806C18.47 11.905 20.954 10.34 20.954 6.842C20.954 6.842 20.954 6.842 20.954 6.842H19.141Z" fill="#009CDE"/>
        <path d="M11.023 15.759L11.531 12.69C11.596 12.247 11.967 11.905 12.414 11.905H14.806C18.47 11.905 20.954 10.34 20.954 6.842C20.954 6.842 20.954 6.842 20.954 6.842H20.375 6.681 19.824 6.842H19.141L20.071 6.842Z" fill="#012169"/>
    </svg>
);

const PaystackIcon = ({ isKenya }: { isKenya: boolean }) => (
    <div className="flex items-center gap-2">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM11 17L7 13L8.41 11.59L11 14.17L15.59 9.58L17 11L11 17Z" fill={isKenya ? "#00A3AD" : "#011b33"}/>
        </svg>
        {isKenya && <span className="bg-[#00A3AD] text-[8px] text-white px-1.5 py-0.5 rounded font-black uppercase tracking-tighter shadow-sm">M-PESA</span>}
    </div>
);

export default function CheckoutPage(props: { params: Promise<{ orderId: string }> }) {
    const params = use(props.params);
    const orderId = params.orderId;
    const firestore = useFirestore();
    const { user, isLoading: isUserLoading } = useUser();
    const { toast } = useToast();
    const [isLoadingPayment, setIsLoadingPayment] = useState<string | null>(null);
<<<<<<< HEAD
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);
=======
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f

    const orderRef = useMemoFirebase(() => {
        if (!orderId || !firestore) return null;
        return doc(firestore, 'orders', orderId);
    }, [firestore, orderId]);

    const { data: order, isLoading: isLoadingOrder } = useDoc<Order>(orderRef);
    
    useEffect(() => {
<<<<<<< HEAD
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
=======
        setUserLocation(getLocationFromStorage());
    }, []);

    const isKenya = useMemo(() => {
        return userLocation?.country?.toUpperCase() === 'KENYA' || userLocation?.city?.toUpperCase() === 'NAIROBI';
    }, [userLocation]);
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
    
    const subtotal = order?.subtotal ?? order?.productPrice ?? 0;
    const shippingCost = order?.shippingCost ?? 0;
    const totalAmount = subtotal + shippingCost;
    
<<<<<<< HEAD
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
=======
    const handlePayment = async (gateway: 'paystack' | 'paypal') => {
        if (!order || !user?.email) {
            toast({ variant: 'destructive', title: 'Payment setup error.' });
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
            return;
        }
        setIsLoadingPayment(gateway);
        try {
            const response = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id, amount: totalAmount, email: user.email, gateway }),
            });
            const data = await response.json();
<<<<<<< HEAD
            if (!response.ok) throw new Error(data.details || 'Payment setup failed');
            if (data.checkoutUrl) window.location.href = data.checkoutUrl;
=======
            if (data.checkoutUrl) window.location.href = data.checkoutUrl;
            else throw new Error(data.error || 'Failed');
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Payment Error', description: err.message });
            setIsLoadingPayment(null);
        }
    };

<<<<<<< HEAD
    if (isLoading) return <BuyerLayout><div className="container py-12"><CheckoutSkeleton /></div></BuyerLayout>;
    if (orderError || !order) return <BuyerLayout><div className="container py-12 text-center">Order not found.</div></BuyerLayout>;
=======
    if (isLoadingOrder || isUserLoading) return <BuyerLayout><div className="container py-12"><Skeleton className="h-96 w-full" /></div></BuyerLayout>;
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
    
    if (order?.orderStatus !== 'pending') {
         return (
            <BuyerLayout>
                <div className="container py-12 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="p-6 rounded-full bg-green-500/10 border border-green-500/20">
                        <PackageCheck className="h-20 w-20 text-green-500" />
                    </div>
                    <h1 className="font-headline text-4xl font-black uppercase tracking-tighter text-white">Payment Received!</h1>
<<<<<<< HEAD
                    <Button asChild className="h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs"><Link href="/buyer/my-orders">VIEW MY ORDERS</Link></Button>
=======
                    <Button asChild className="h-14 px-12 rounded-2xl font-black uppercase tracking-widest text-xs"><Link href="/buyer/my-orders">VIEW MY ORDERS</Link></Button>
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
                </div>
            </BuyerLayout>
        )
    }

    return (
        <BuyerLayout>
            <div className="container py-12 px-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    <Card className="border-white/5 bg-card/50">
                        <CardHeader>
<<<<<<< HEAD
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
=======
                            <CardTitle className="font-headline text-xl uppercase tracking-tight text-white">Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-primary">Total Amount</p>
                                    <p className="text-2xl font-black tracking-tighter text-white">USD ${totalAmount.toLocaleString()}</p>
                                </div>
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
                                <ShieldCheck className="h-8 w-8 text-primary/40" />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
<<<<<<< HEAD
                        <h2 className="text-sm font-black uppercase tracking-widest text-white/50">Payment Method</h2>
                        <div className="grid gap-3">
                            <Button size="lg" className="w-full justify-start gap-4 h-20 rounded-2xl bg-white text-black hover:bg-neutral-200 border-none group" onClick={() => handlePayment('paystack')} disabled={!!isLoadingPayment}>
                                <div className="h-12 w-12 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 border"><PaystackIcon /></div>
                                <div className="text-left"><p className="font-black text-sm uppercase tracking-widest">Paystack</p><p className="text-[10px] font-bold text-neutral-500">M-PESA / CARD</p></div>
                            </Button>

                            <Button size="lg" className="w-full justify-start gap-4 h-20 rounded-2xl bg-[#0070BA] hover:bg-[#005ea6] text-white border-none group" onClick={() => handlePayment('paypal')} disabled={!!isLoadingPayment}>
                                <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center shrink-0 border"><PayPalIcon /></div>
                                <div className="text-left"><p className="font-black text-sm uppercase tracking-widest">PayPal</p><p className="text-[10px] font-bold text-white/60 uppercase">CREDIT & WALLET</p></div>
=======
                        <h2 className="text-sm font-black uppercase tracking-widest text-white/50 ml-1">Secure Payment Options</h2>
                        <div className="grid gap-3">
                            <Button 
                                size="lg" 
                                className="w-full justify-start gap-4 h-24 rounded-2xl bg-white text-black hover:bg-neutral-200 transition-all border-none group shadow-xl" 
                                onClick={() => handlePayment('paystack')} 
                                disabled={!!isLoadingPayment}
                            >
                                <div className="h-14 w-14 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 border border-neutral-200 group-hover:scale-105 transition-transform">
                                    {isLoadingPayment === 'paystack' ? <Loader2 className="animate-spin text-black" /> : <PaystackIcon isKenya={isKenya} />}
                                </div>
                                <div className="text-left min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <p className="font-black text-sm uppercase tracking-widest">{isKenya ? 'Pay with M-Pesa' : 'Card / Bank'}</p>
                                    </div>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter leading-tight">
                                        {isKenya ? 'Instant Mobile Money Checkout' : 'Secure Global Payments'}
                                    </p>
                                </div>
                            </Button>

                            <Button 
                                size="lg" 
                                className="w-full justify-start gap-4 h-24 rounded-2xl bg-[#0070BA] hover:bg-[#005ea6] text-white transition-all border-none group shadow-xl" 
                                onClick={() => handlePayment('paypal')} 
                                disabled={!!isLoadingPayment}
                            >
                                <div className="h-14 w-14 rounded-xl bg-white flex items-center justify-center shrink-0 border border-white/20 group-hover:scale-105 transition-transform">
                                    {isLoadingPayment === 'paypal' ? <Loader2 className="animate-spin text-black" /> : <PayPalIcon />}
                                </div>
                                <div className="text-left min-w-0">
                                    <p className="font-black text-sm uppercase tracking-widest">PayPal</p>
                                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-tighter leading-tight">Global Credit & Wallet</p>
                                </div>
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
                            </Button>
                        </div>
                        
                        <div className="p-4 rounded-2xl bg-neutral-900/50 border border-white/5 flex items-center gap-3">
                            <ShieldCheck className="h-5 w-5 text-green-500" />
                            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 leading-tight">
                                Your payment is protected. Funds are held in escrow until delivery is confirmed.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </BuyerLayout>
    )
}
