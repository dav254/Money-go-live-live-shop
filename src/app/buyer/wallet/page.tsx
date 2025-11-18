
'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, Download, Gift, PlusCircle, Wallet, Bot, Loader2, History, ShoppingBag } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { PaymentMethod, Order } from '@/lib/types';
import { collection, addDoc, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const cardFormSchema = z.object({
  cardNumber: z.string().min(16, "Card number must be 16 digits.").max(16, "Card number must be 16 digits."),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/, "Invalid expiry date. Use MM/YY format."),
  cvc: z.string().min(3, "CVC must be 3 digits.").max(3, "CVC must be 3 digits."),
});

const AddPaymentMethodDialog = ({ onMethodAdded }: { onMethodAdded: () => void }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<z.infer<typeof cardFormSchema>>({
        resolver: zodResolver(cardFormSchema),
        defaultValues: { cardNumber: '', expiry: '', cvc: '' },
    });

    const handleSaveCard = async (values: z.infer<typeof cardFormSchema>) => {
        if (!user || !firestore) return;
        setIsSaving(true);
        try {
            const paymentMethodsRef = collection(firestore, 'userProfiles', user.uid, 'paymentMethods');
            await addDoc(paymentMethodsRef, {
                type: 'card',
                details: `Visa **** ${values.cardNumber.slice(-4)}`,
                isDefault: false,
                providerToken: `tok_${Math.random().toString(36).substring(2)}` // Dummy token
            });
            toast({ title: "Success", description: "Payment method saved." });
            onMethodAdded();
        } catch (error) {
            console.error("Error saving payment method:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not save payment method." });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleLinkPayPal = async () => {
        if (!user || !firestore) return;
        setIsSaving(true);
         try {
            const paymentMethodsRef = collection(firestore, 'userProfiles', user.uid, 'paymentMethods');
            await addDoc(paymentMethodsRef, {
                type: 'paypal',
                details: user.email, // Use user's email as placeholder
                isDefault: false,
            });
            toast({ title: "Success", description: "PayPal linked successfully." });
            onMethodAdded();
        } catch (error) {
            console.error("Error linking PayPal:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not link PayPal account." });
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Add a Payment Method</DialogTitle>
                <DialogDescription>Securely add a new way to pay.</DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="card" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="card">Card (Paystack)</TabsTrigger>
                    <TabsTrigger value="paypal">PayPal</TabsTrigger>
                </TabsList>
                <TabsContent value="card">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSaveCard)} className="space-y-4 py-4">
                            <FormField control={form.control} name="cardNumber" render={({ field }) => (
                                <FormItem><FormLabel>Card Number</FormLabel><FormControl><Input placeholder="**** **** **** 1234" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="expiry" render={({ field }) => (
                                    <FormItem><FormLabel>Expiry</FormLabel><FormControl><Input placeholder="MM/YY" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="cvc" render={({ field }) => (
                                    <FormItem><FormLabel>CVC</FormLabel><FormControl><Input placeholder="123" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                             <DialogFooter>
                                <Button type="submit" className="w-full" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Card
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </TabsContent>
                <TabsContent value="paypal">
                    <div className="py-4 text-center">
                        <p className="text-sm text-muted-foreground mb-4">You will be redirected to PayPal to securely link your account.</p>
                        <Button type="button" className="w-full bg-[#0070BA] hover:bg-[#005ea6]" onClick={handleLinkPayPal} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                            Continue with PayPal
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>
        </DialogContent>
    );
};

const TransactionTableSkeleton = () => (
    <Table>
        <TableHeader>
            <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount (USD)</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
);


export default function BuyerWalletPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();
    const [isAddMethodOpen, setIsAddMethodOpen] = useState(false);

    const paymentMethodsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, 'userProfiles', user.uid, 'paymentMethods');
    }, [firestore, user]);

    const { data: paymentMethods, isLoading: isLoadingMethods } = useCollection<PaymentMethod>(paymentMethodsQuery);

    const ordersQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'orders'), where('buyerId', '==', user.uid));
    }, [firestore, user]);

    const { data: orders, isLoading: isLoadingOrders } = useCollection<Order>(ordersQuery);

    const isLoading = isUserLoading || isLoadingMethods || isLoadingOrders;

    const totalSpent = useMemo(() => {
        if (!orders) return 0;
        return orders
            .filter(order => order.orderStatus === 'delivered')
            .reduce((sum, order) => sum + order.totalAmount, 0);
    }, [orders]);

  return (
    <BuyerLayout>
      <div className="container mx-auto max-w-7xl py-8">
        <h1 className="font-headline text-3xl font-bold mb-8">Wallet & Payments</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                {/* Balance & Coupons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-primary">
                                <ShoppingBag />
                                Lifetime Purchase Value
                            </CardTitle>
                             <CardDescription>The total value of all your completed purchases.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <Skeleton className="h-10 w-3/4" />
                            ) : (
                                <p className="text-4xl font-bold">${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Gift />
                                Coupons & Rewards
                            </CardTitle>
                             <CardDescription>This feature is coming soon!</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-4xl font-bold">0</p>
                            <Button variant="outline" className="mt-4 w-full" disabled>View Coupons</Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Transaction History */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><History /> Purchase History</CardTitle>
                        <CardDescription>A record of your recent purchases.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <TransactionTableSkeleton /> : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Amount (USD)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orders && orders.length > 0 ? orders.slice(0, 5).map(order => (
                                        <TableRow key={order.id}>
                                            <TableCell>{order.orderDate.toDate().toLocaleDateString()}</TableCell>
                                            <TableCell>{order.productName}</TableCell>
                                            <TableCell>
                                                <Badge variant={order.orderStatus === 'delivered' ? 'default' : 'secondary'} className={order.orderStatus === 'delivered' ? 'bg-green-600/80' : ''}>
                                                    {order.orderStatus}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                ${order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">You have no purchase history yet.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
                         <Button variant="link" className="mt-4 px-0">View all purchases</Button>
                    </CardContent>
                </Card>
            </div>
            
            <div className="space-y-8">
                 {/* Payment Methods */}
                <Card>
                    <CardHeader>
                        <CardTitle>Payment Methods</CardTitle>
                        <CardDescription>Manage your saved payment options for faster checkout.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isLoadingMethods ? (
                            <>
                                <Skeleton className="h-16 w-full rounded-lg" />
                                <Skeleton className="h-16 w-full rounded-lg" />
                            </>
                        ) : paymentMethods && paymentMethods.length > 0 ? (
                            paymentMethods.map(pm => (
                                <div key={pm.id} className="flex items-center justify-between rounded-lg border p-3">
                                    <div className="flex items-center gap-3">
                                        <CreditCard className="h-6 w-6 text-muted-foreground" />
                                        <div>
                                            <p className="font-semibold uppercase">{pm.type}</p>
                                            <p className="text-sm text-muted-foreground">{pm.details}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm">Edit</Button>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center pt-4">No payment methods saved.</p>
                        )}
                        <Dialog open={isAddMethodOpen} onOpenChange={setIsAddMethodOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full">
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Add New Method
                                </Button>
                            </DialogTrigger>
                           <AddPaymentMethodDialog onMethodAdded={() => setIsAddMethodOpen(false)} />
                        </Dialog>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    </BuyerLayout>
  );
}

    