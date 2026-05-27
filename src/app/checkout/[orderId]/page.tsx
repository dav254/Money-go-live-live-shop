
'use client';

import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { getDoc, collection, query, where, limit, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useParams, useSearchParams } from 'next/navigation';
import type { Order, Product } from '@/lib/types';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect, useMemo } from 'react';
import { Loader2, ShieldCheck, Smartphone, CreditCard, CheckCircle, SmartphoneNfc, ArrowRight, PackageCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
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
                     <div className="flex justify-between">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-5 w-16" />
                    </div>
                </CardContent>
                <CardFooter>
                     <div className="flex justify-between w-full font-bold">
                        <Skeleton className="h-6 w-20" />
                        <Skeleton className="h-6 w-24" />
                    </div>
                </CardFooter>
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

const PesapalIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="12" fill="#F05A28"/>
        <path d="M11 7H14C15.6569 7 17 8.34315 17 10C17 11.6569 15.6569 13 14 13H11V17H9V7H11ZM11 11H14C14.5523 11 15 10.5523 15 10C15 9.44772 14.5523 9 14 9H11V11Z" fill="white"/>
        <path d="M6 12C6 8.68629 8.68629 6 12 6M18 12C18 15.3137 15.3137 18 12 18" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
);

export default function CheckoutPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const orderId = params.orderId as string;
    const firestore = useFirestore();
    const { user, isLoading: isUserLoading } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const [isLoadingPayment, setIsLoadingPayment] = useState<string | null>(null);

    const orderRef = useMemoFirebase(() => {
        if (!orderId || !firestore) return null;
        return doc(firestore, 'orders', orderId);
    }, [firestore, orderId]);

    const { data: order, isLoading: isLoadingOrder, error: orderError } = useDoc<Order>(orderRef);
    
    const [liveShippingCost, setLiveShippingCost] = useState<number>(0);
    const [isLoadingShipping, setIsLoadingShipping] = useState(true);

    // If returning from a gateway, show success message
    useEffect(() => {
        if (searchParams.get('gateway') === 'pesapal' && searchParams.get('OrderTrackingId')) {
            toast({
                title: 'Transaction Initialized',
                description: 'We are verifying your PesaPal payment. Please check your orders in a few minutes.',
            });
            router.push('/buyer/my-orders');
        }
    }, [searchParams, toast, router]);

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
        fetchSellerShipping();
    }, [order, firestore]);
    
    const subtotal = order?.subtotal ?? order?.productPrice ?? 0;
    const liveTotalAmount = subtotal + liveShippingCost;
    
    const isLoading = isLoadingOrder || isUserLoading || isLoadingShipping;
    const error = orderError;

    const orderItems = useMemo(() => {
        if (!order) return [];
        if (order.items && order.items.length > 0) {
            return order.items;
        }
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


    const handlePayment = async (gateway: 'paystack' | 'paypal' | 'pesapal' | 'simulate') => {
        if (!order || !user?.email) {
            toast({
                variant: 'destructive',
                title: 'Cannot initiate payment',
                description: 'Order details or user email is missing.',
            });
            return;
        }

        if (gateway === 'simulate') {
            setIsLoadingPayment('simulate');
            try {
                const response = await fetch('/api/checkout/simulate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: order.id }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                toast({ title: 'Payment Simulated!', description: 'Your order is now processing.' });
                // The onSnapshot in useDoc will handle the UI update automatically
            } catch (err: any) {
                toast({ variant: 'destructive', title: 'Simulation Error', description: err.message });
            } finally {
                setIsLoadingPayment(null);
            }
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

            if (!response.ok) {
                throw new Error(data.details || data.error || 'Failed to create payment intent.');
            }
            
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                throw new Error('No checkout URL received.');
            }

        } catch (err: any) {
            toast({
                variant: 'destructive',
                title: 'Payment Error',
                description: err.message || 'Could not initiate payment. Please try again.',
            });
            setIsLoadingPayment(null);
        }
    };

    if (isLoading) {
        return (
            <BuyerLayout>
                <div className="container py-12">
                   <CheckoutSkeleton />
                </div>
            </BuyerLayout>
        )
    }

    if (error || !order) {
        return (
            <BuyerLayout>
                <div className="container py-12 text-center">
                    <h1 className="text-2xl font-bold">Order Not Found</h1>
                    <p className="text-muted-foreground">The order you are trying to pay for does not exist.</p>
                </div>
            </BuyerLayout>
        )
    }
    
    // IF ALREADY PAID
    if (order.orderStatus !== 'pending') {
         return (
            <BuyerLayout>
                <div className="container py-12 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
                    <div className="p-6 rounded-full bg-green-500/10 border border-green-500/20 shadow-2xl shadow-green-500/10 animate-in zoom-in duration-500">
                        <PackageCheck className="h-20 w-20 text-green-500" />
                    </div>
                    <div>
                        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter text-white">Payment Received!</h1>
                        <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] mt-2">Order #{order.id.substring(0, 8)} is now being prepared.</p>
                    </div>
                    
                    <Card className="max-w-md w-full border-white/5 bg-neutral-900/50">
                        <CardContent className="p-6 space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-neutral-500 font-bold uppercase tracking-widest text-[10px]">Current Status</span>
                                <Badge className="bg-green-600 font-black uppercase text-[10px]">{order.orderStatus}</Badge>
                            </div>
                            <Separator className="bg-white/5" />
                            <p className="text-xs text-neutral-400 leading-relaxed">The seller has been notified and will start processing your delivery shortly. You can track this order in your dashboard.</p>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                        <Button asChild className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-xs">
                            <Link href="/buyer/my-orders">VIEW MY ORDERS</Link>
                        </Button>
                        <Button variant="outline" asChild className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-xs border-white/10">
                            <Link href="/buyer/dashboard">CONTINUE SHOPPING</Link>
                        </Button>
                    </div>
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
                            <CardDescription className="text-xs uppercase tracking-widest font-bold">Review your order before payment.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {orderItems.map((item) => (
                                <div key={item.productId} className="flex items-center gap-4">
                                    <div className="relative h-16 w-16 rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black">
                                        <Image 
                                            src={item.imageUrl || getPlaceholderImage()} 
                                            alt={item.name || 'Product'} 
                                            fill 
                                            className="object-cover" 
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm truncate uppercase tracking-tight">{item.name}</p>
                                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Qty: {item.quantity}</p>
                                    </div>
                                    <p className="ml-auto font-black text-sm text-primary">${(item.price * item.quantity).toLocaleString()}</p>
                                </div>
                            ))}

                            <Separator className="bg-white/5" />
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    <p>Subtotal</p>
                                    <p>${subtotal.toLocaleString()}</p>
                                </div>
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    <p>Shipping</p>
                                    <p>${liveShippingCost.toLocaleString()}</p>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-white/5 p-6 rounded-b-lg border-t border-white/5">
                            <div className="flex justify-between w-full">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Total Amount</p>
                                    <p className="text-2xl font-black tracking-tighter text-white">USD ${liveTotalAmount.toLocaleString()}</p>
                                </div>
                                <ShieldCheck className="h-8 w-8 text-primary/40" />
                            </div>
                        </CardFooter>
                    </Card>

                    <div className="space-y-6">
                        <h2 className="text-sm font-black uppercase tracking-widest text-white/50 ml-1">Payment Options</h2>
                        
                        <div className="grid gap-3">
                            <Button
                                size="lg"
                                className="w-full justify-start gap-4 h-20 rounded-2xl bg-neutral-900 text-white hover:bg-neutral-800 transition-all shadow-xl group border border-white/5"
                                onClick={() => handlePayment('pesapal')}
                                disabled={!!isLoadingPayment}
                            >
                                <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 transition-transform group-hover:scale-105">
                                    {isLoadingPayment === 'pesapal' ? <Loader2 className="animate-spin text-primary" /> : <PesapalIcon />}
                                </div>
                                <div className="text-left min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-black text-xs uppercase tracking-widest">PesaPal</p>
                                        <Badge className="bg-[#F05A28] text-[8px] h-4 px-1 font-black border-none text-white">M-PESA / VISA</Badge>
                                    </div>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter truncate">Kenya & Global Payments</p>
                                </div>
                            </Button>

                            <Button
                                size="lg"
                                className="w-full justify-start gap-4 h-20 rounded-2xl bg-white text-black hover:bg-neutral-200 transition-all shadow-xl group border-none"
                                onClick={() => handlePayment('paystack')}
                                disabled={!!isLoadingPayment}
                            >
                                <div className="h-12 w-12 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 border border-neutral-200 transition-transform group-hover:scale-105">
                                    {isLoadingPayment === 'paystack' ? <Loader2 className="animate-spin text-black" /> : <PaystackIcon />}
                                </div>
                                <div className="text-left min-w-0">
                                    <p className="font-black text-xs uppercase tracking-widest">Paystack</p>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter truncate">Card & Bank Transfers</p>
                                </div>
                            </Button>

                            <Button
                                size="lg"
                                className="w-full justify-start gap-4 h-20 rounded-2xl bg-[#0070BA] hover:bg-[#005ea6] text-white transition-all shadow-xl group border-none"
                                onClick={() => handlePayment('paypal')}
                                disabled={!!isLoadingPayment}
                            >
                                <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center shrink-0 border border-white/20 transition-transform group-hover:scale-105">
                                    {isLoadingPayment === 'paypal' ? <Loader2 className="animate-spin text-black" /> : <PayPalIcon />}
                                </div>
                                <div className="text-left min-w-0">
                                    <p className="font-black text-xs uppercase tracking-widest">PayPal</p>
                                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-tighter truncate">Global Card & PayPal Credit</p>
                                </div>
                            </Button>
                            
                            <Separator className="my-2 bg-white/5" />
                            
                            <Button
                                size="lg"
                                variant="outline"
                                className="w-full h-12 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/5 font-black uppercase text-[10px] tracking-widest"
                                onClick={() => handlePayment('simulate')}
                                disabled={!!isLoadingPayment}
                            >
                                {isLoadingPayment === 'simulate' ? <Loader2 className="animate-spin mr-2" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                                TEST PAYMENT (DEMO ONLY)
                            </Button>
                        </div>

                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/20">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                            <p className="text-[10px] font-bold text-primary/80 uppercase tracking-widest leading-relaxed">
                                Your payment is encrypted and handled by world-class secure gateways. Go Earn never stores your card details.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </BuyerLayout>
    )
}
