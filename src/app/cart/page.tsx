

'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, useUserProfile } from '@/firebase';
import { collection, deleteDoc, doc, updateDoc, setDoc, serverTimestamp, getDoc, getDocs, where, query } from 'firebase/firestore';
import type { CartItem, Order, Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { Trash2, Plus, Minus, ShoppingCart, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import React from 'react';
import { FirestorePermissionError } from '@/firebase/errors';

const CartItemRow = ({ item }: { item: CartItem }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleQuantityChange = async (newQuantity: number) => {
        if (!user || !firestore || newQuantity < 1) return;
        const cartItemRef = doc(firestore, 'userProfiles', user.uid, 'cart', item.productId);
        try {
            await updateDoc(cartItemRef, { quantity: newQuantity });
        } catch (error) {
            console.error("Error updating quantity:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update item quantity.' });
        }
    };

    const handleRemoveItem = async () => {
        if (!user || !firestore) return;
        const cartItemRef = doc(firestore, 'userProfiles', user.uid, 'cart', item.productId);
        try {
            await deleteDoc(cartItemRef);
            toast({ title: 'Item Removed', description: `${item.name} has been removed from your cart.` });
        } catch (error) {
             console.error("Error removing item:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not remove item from cart.' });
        }
    };


    return (
        <div className="flex items-center gap-4 py-4">
            <div className="relative h-20 w-20 rounded-md overflow-hidden">
                <Image src={item.imageUrl || 'https://picsum.photos/seed/placeholder/200'} alt={item.name} fill className="object-cover" />
            </div>
            <div className="flex-1">
                <p className="font-semibold">{item.name}</p>
                <p className="text-lg font-bold text-primary">${item.price.toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(item.quantity - 1)} disabled={item.quantity <= 1}>
                    <Minus className="h-4 w-4" />
                </Button>
                <span className="w-10 text-center font-bold">{item.quantity}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(item.quantity + 1)}>
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
             <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={handleRemoveItem}>
                <Trash2 className="h-5 w-5" />
            </Button>
        </div>
    );
};

const CartSkeleton = () => (
    <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-4">
                <Skeleton className="h-20 w-20 rounded-md" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-6 w-1/4" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-6 w-10" />
                    <Skeleton className="h-8 w-8" />
                </div>
                <Skeleton className="h-9 w-9" />
            </div>
        ))}
    </div>
);


export default function CartPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [isCheckingOut, setIsCheckingOut] = React.useState(false);

    const cartItemsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, 'userProfiles', user.uid, 'cart');
    }, [user, firestore]);

    const { data: cartItems, isLoading: areItemsLoading } = useCollection<CartItem>(cartItemsQuery);
    
    const isLoading = isUserLoading || areItemsLoading || isProfileLoading;

    const subtotal = React.useMemo(() => {
        return cartItems?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0;
    }, [cartItems]);

    // This is a simplified shipping cost calculation. A real app would be more complex.
    const shippingCost = subtotal > 0 ? 5 : 0; 
    const total = subtotal + shippingCost;
    
    const handleCheckout = async () => {
        if (!user || !firestore || !cartItems || cartItems.length === 0 || !userProfile) {
            toast({ variant: 'destructive', title: 'Your cart is empty or you are not logged in.' });
            return;
        }
        
        setIsCheckingOut(true);

        // Assume all items are from the same seller for simplicity
        const sellerId = cartItems[0].sellerId;
        
        let resellerId = localStorage.getItem('resellerRefId');
        if (!resellerId && userProfile.referredBy) {
            resellerId = userProfile.referredBy;
        }

        let totalCommission = 0;
        if (resellerId) {
            totalCommission = cartItems.reduce((acc, item) => {
                // Always calculate 10% if a reseller is involved.
                return acc + (item.price * item.quantity * 0.10);
            }, 0);
        }

        const newOrderRef = doc(collection(firestore, 'orders'));
        
        const newOrderData: Partial<Order> = {
            id: newOrderRef.id,
            buyerId: user.uid,
            sellerId: sellerId,
            items: cartItems.map(item => ({
                productId: item.productId,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                imageUrl: item.imageUrl
            })),
            subtotal: subtotal,
            shippingCost: shippingCost,
            totalAmount: total,
            orderDate: serverTimestamp() as any,
            shippingAddress: '123 Placeholder Lane, Nairobi', // Placeholder
            orderStatus: 'pending',
            paymentMethod: 'pending',
            resellerCommission: totalCommission,
            ...(resellerId && { resellerId: resellerId }),
        };

        try {
            await setDoc(newOrderRef, newOrderData);
            
            if (resellerId) {
                localStorage.removeItem('resellerRefId');
            }
            
            toast({ title: 'Order Created!', description: 'Redirecting to checkout...' });
            router.push(`/checkout/${newOrderRef.id}`);
        } catch (error) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: newOrderRef.path,
                operation: 'create',
                requestResourceData: newOrderData,
            }));
        } finally {
            setIsCheckingOut(false);
        }
    };


    return (
        <BuyerLayout>
            <div className="container mx-auto max-w-4xl py-8">
                <h1 className="font-headline text-3xl font-bold mb-8 flex items-center gap-3">
                    <ShoppingCart />
                    My Shopping Cart
                </h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Cart Items ({cartItems?.length || 0})</CardTitle>
                            </CardHeader>
                            <CardContent className="divide-y">
                                {isLoading ? (
                                    <CartSkeleton />
                                ) : cartItems && cartItems.length > 0 ? (
                                    cartItems.map(item => <CartItemRow key={item.id} item={item} />)
                                ) : (
                                    <div className="text-center py-16 text-muted-foreground">
                                        Your cart is empty.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="sticky top-24">
                        <Card>
                             <CardHeader>
                                <CardTitle>Order Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between">
                                    <span>Subtotal</span>
                                    <span>${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Shipping</span>
                                    <span>${shippingCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                 <Separator />
                                <div className="flex justify-between font-bold text-lg">
                                    <span>Total</span>
                                    <span>${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" size="lg" disabled={!cartItems || cartItems.length === 0 || isCheckingOut} onClick={handleCheckout}>
                                    {isCheckingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Proceed to Checkout
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </div>
        </BuyerLayout>
    );
}

