
'use client';

import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useParams } from 'next/navigation';
import type { Order } from '@/lib/types';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

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


export default function CheckoutPage() {
    const params = useParams();
    const orderId = params.orderId as string;
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [isLoadingPayment, setIsLoadingPayment] = useState<string | null>(null);

    const orderRef = useMemoFirebase(() => {
        if (!orderId || !firestore) return null;
        return doc(firestore, 'orders', orderId);
    }, [firestore, orderId]);

    const { data: order, isLoading, error } = useDoc<Order>(orderRef);

    const handlePayment = async (gateway: 'paystack' | 'paypal') => {
        if (!order) return;
        setIsLoadingPayment(gateway);

        try {
            const response = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: order.id,
                    amount: order.totalAmount,
                    email: 'buyer@example.com', // In real app, get from user profile
                    gateway: gateway,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create payment intent.');
            }

            const data = await response.json();
            
            if (data.checkoutUrl) {
                // Redirect user to the payment page
                router.push(data.checkoutUrl);
            } else {
                throw new Error('No checkout URL received.');
            }

        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Payment Error',
                description: 'Could not initiate payment. Please try again or use another method.',
            });
            setIsLoadingPayment(null);
        }
    };


    if (isLoading) {
        return (
            <MainLayout>
                <div className="container py-12">
                   <CheckoutSkeleton />
                </div>
            </MainLayout>
        )
    }

    if (error || !order) {
        return (
            <MainLayout>
                <div className="container py-12 text-center">
                    <h1 className="text-2xl font-bold">Order Not Found</h1>
                    <p className="text-muted-foreground">The order you are trying to pay for does not exist or you do not have permission to view it.</p>
                </div>
            </MainLayout>
        )
    }
    
    if (order.orderStatus !== 'pending') {
         return (
            <MainLayout>
                <div className="container py-12 text-center">
                    <h1 className="text-2xl font-bold">Order Not Payable</h1>
                    <p className="text-muted-foreground">This order has already been processed or is no longer pending payment.</p>
                     <Button asChild className="mt-4">
                        <a href="/buyer/my-orders">View My Orders</a>
                    </Button>
                </div>
            </MainLayout>
        )
    }

    const shippingCost = 10; // Placeholder in USD
    const total = order.totalAmount + shippingCost;

    return (
        <MainLayout>
            <div className="container py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    <Card>
                        <CardHeader>
                            <CardTitle>Order Summary</CardTitle>
                            <CardDescription>Review your order before payment.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="relative h-20 w-20 rounded-md overflow-hidden border">
                                    <Image src={order.productImage || ''} alt={order.productName || 'Product'} fill className="object-cover" />
                                </div>
                                <div>
                                    <p className="font-semibold">{order.productName}</p>
                                    <p className="text-sm text-muted-foreground">Qty: {order.quantity}</p>
                                </div>
                                <p className="ml-auto font-bold">${order.totalAmount.toLocaleString()}</p>
                            </div>
                            <Separator />
                            <div className="flex justify-between text-sm">
                                <p>Subtotal</p>
                                <p>${order.totalAmount.toLocaleString()}</p>
                            </div>
                             <div className="flex justify-between text-sm">
                                <p>Shipping</p>
                                <p>${shippingCost.toLocaleString()}</p>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <div className="flex justify-between w-full font-bold text-lg">
                                <p>Total</p>
                                <p>USD ${total.toLocaleString()}</p>
                            </div>
                        </CardFooter>
                    </Card>

                    <div className="space-y-6">
                        <h2 className="text-xl font-bold">Choose Payment Method</h2>
                         <Button
                            size="lg"
                            className="w-full justify-start gap-4 h-16 text-lg"
                            onClick={() => handlePayment('paystack')}
                            disabled={!!isLoadingPayment}
                         >
                            {isLoadingPayment === 'paystack' ? <Loader2 className="animate-spin" /> : <div className="h-6 w-6 bg-white rounded" />} 
                            Pay with Paystack (Card, M-Pesa)
                        </Button>
                         <Button
                            size="lg"
                            className="w-full justify-start gap-4 h-16 text-lg bg-blue-600 hover:bg-blue-700"
                            onClick={() => handlePayment('paypal')}
                            disabled={!!isLoadingPayment}
                         >
                            {isLoadingPayment === 'paypal' ? <Loader2 className="animate-spin" /> : <div className="h-6 w-6 bg-white rounded" />} 
                            Pay with PayPal
                        </Button>
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
