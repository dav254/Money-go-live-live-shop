'use client';

import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { getDoc, collection, query, where, limit, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useParams } from 'next/navigation';
import type { Order, Product } from '@/lib/types';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { getPlaceholderImage } from '@/lib/placeholder-images';

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

    useEffect(() => {
        const fetchSellerShipping = async () => {
            if (order?.sellerId && firestore) {
                setIsLoadingShipping(true);
                // Use a single product from the items array to get the seller's info
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

    // This ensures backward compatibility. If `items` array doesn't exist, create it from legacy fields.
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
                imageUrl: order.productImage || '',
            }];
        }
        return [];
    }, [order]);


    const handlePayment = async (gateway: 'paystack' | 'paypal') => {
        if (!order || !user?.email) {
            toast({
                variant: 'destructive',
                title: 'Cannot initiate payment',
                description: 'Order details or user email is missing.',
            });
            return;
        }
        setIsLoadingPayment(gateway);

        try {
            const response = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: order.id,
                    amount: liveTotalAmount, // Use the live total amount
                    email: user.email,
                    gateway: gateway,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || 'Failed to create payment intent.');
            }

            const data = await response.json();
            
            if (data.checkoutUrl) {
                router.push(data.checkoutUrl);
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
                    <p className="text-muted-foreground">The order you are trying to pay for does not exist or you do not have permission to view it.</p>
                </div>
            </BuyerLayout>
        )
    }
    
    if (order.orderStatus !== 'pending') {
         return (
            <BuyerLayout>
                <div className="container py-12 text-center">
                    <h1 className="text-2xl font-bold">Order Not Payable</h1>
                    <p className="text-muted-foreground">This order has already been processed or is no longer pending payment.</p>
                     <Button asChild className="mt-4">
                        <a href="/buyer/my-orders">View My Orders</a>
                    </Button>
                </div>
            </BuyerLayout>
        )
    }

    return (
        <BuyerLayout>
            <div className="container py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    <Card>
                        <CardHeader>
                            <CardTitle>Order Summary</CardTitle>
                            <CardDescription>Review your order before payment.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {orderItems.map((item) => (
                                <div key={item.productId} className="flex items-center gap-4">
                                    <div className="relative h-16 w-16 rounded-md overflow-hidden border">
                                        <Image 
                                            src={item.imageUrl || getPlaceholderImage()} 
                                            alt={item.name || 'Product'} 
                                            fill 
                                            className="object-cover" 
                                        />
                                    </div>
                                    <div>
                                        <p className="font-semibold">{item.name}</p>
                                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                                    </div>
                                    <p className="ml-auto font-bold">${(item.price * item.quantity).toLocaleString()}</p>
                                </div>
                            ))}

                            <Separator />
                            <div className="flex justify-between text-sm">
                                <p>Subtotal</p>
                                <p>${subtotal.toLocaleString()}</p>
                            </div>
                             <div className="flex justify-between text-sm">
                                <p>Shipping</p>
                                <p>${liveShippingCost.toLocaleString()}</p>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <div className="flex justify-between w-full font-bold text-lg">
                                <p>Total</p>
                                <p>USD ${liveTotalAmount.toLocaleString()}</p>
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
        </BuyerLayout>
    )
}
