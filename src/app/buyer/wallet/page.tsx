'use client';

import { useState, useMemo, ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, Download, Gift, PlusCircle, Wallet, Bot, Loader2, History, ShoppingBag, MoreVertical, Trash2, ArrowDownUp, ArrowRight, Landmark, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile } from '@/firebase';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import type { Payment, PaymentMethod } from '@/lib/types';


// --- Mock Data ---
const mockTransactions: Payment[] = [
    { id: 'txn_1', paymentDate: new Date(), transactionType: 'product-purchase', orderId: 'ORD123', paymentStatus: 'completed', amount: 49.99, paymentMethod: 'paypal', transactionId: 'paypal_1' },
    { id: 'txn_2', paymentDate: new Date(Date.now() - 86400000), transactionType: 'points-purchase', userId: 'user_abc', paymentStatus: 'completed', amount: 10.00, paymentMethod: 'paystack', transactionId: 'ps_1' },
    { id: 'txn_3', paymentDate: new Date(Date.now() - 172800000), transactionType: 'product-purchase', orderId: 'ORD121', paymentStatus: 'pending', amount: 85.50, paymentMethod: 'paypal', transactionId: 'paypal_2' },
];
// --- End Mock Data ---


const paypalFormSchema = z.object({
  email: z.string().email("Please enter a valid PayPal email address."),
});

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

    const paypalForm = useForm<z.infer<typeof paypalFormSchema>>({
        resolver: zodResolver(paypalFormSchema),
        defaultValues: { email: user?.email || '' },
    });

    const cardForm = useForm<z.infer<typeof cardFormSchema>>({
        resolver: zodResolver(cardFormSchema),
        defaultValues: { cardNumber: '', expiry: '', cvc: '' },
    });

    const handleSaveMethod = async (type: 'paypal' | 'card', values: any) => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: "Not logged in" });
            return;
        };

        setIsSaving(true);
        try {
            const methodsRef = collection(firestore, 'userProfiles', user.uid, 'paymentMethods');
            let data: Omit<PaymentMethod, 'id'>;

            if (type === 'paypal') {
                data = { type: 'paypal', details: values.email };
            } else {
                data = { type: 'card', details: `Visa **** ${values.cardNumber.slice(-4)}` };
            }

            await addDoc(methodsRef, data);
            toast({ title: "Success", description: `Your ${type} method has been saved.` });
            onMethodAdded();
        } catch (error) {
            console.error("Error saving payment method:", error);
            toast({ variant: 'destructive', title: "Save Failed", description: "Could not save payment method." });
        } finally {
            setIsSaving(false);
        }
    };
    
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
                    <Form {...cardForm}>
                        <form onSubmit={cardForm.handleSubmit((v) => handleSaveMethod('card', v))} className="space-y-4 py-4">
                            <FormField control={cardForm.control} name="cardNumber" render={({ field }) => (
                                <FormItem><FormLabel>Card Number</FormLabel><FormControl><Input placeholder="**** **** **** 1234" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={cardForm.control} name="expiry" render={({ field }) => (
                                    <FormItem><FormLabel>Expiry</FormLabel><FormControl><Input placeholder="MM/YY" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={cardForm.control} name="cvc" render={({ field }) => (
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
                     <Form {...paypalForm}>
                        <form onSubmit={paypalForm.handleSubmit((v) => handleSaveMethod('paypal', v))} className="space-y-4 py-4">
                             <FormField control={paypalForm.control} name="email" render={({ field }) => (
                                <FormItem><FormLabel>PayPal Email</FormLabel><FormControl><Input placeholder="you@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <DialogFooter>
                                <Button type="submit" className="w-full bg-[#0070BA] hover:bg-[#005ea6]" disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                                    Save PayPal
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </TabsContent>
            </Tabs>
        </DialogContent>
    );
};

const getTransactionIcon = (type: string) => {
    switch (type) {
        case 'product-purchase': return <ShoppingBag className="h-4 w-4 text-blue-500" />;
        case 'points-purchase': return <ArrowRight className="h-4 w-4 text-red-500" />;
        default: return <Wallet className="h-4 w-4" />;
    }
}


export default function BuyerWalletPage() {
    const { toast } = useToast();
    const [isAddMethodOpen, setIsAddMethodOpen] = useState(false);
    const { user, isLoading: isUserLoading } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
    const firestore = useFirestore();

    const paymentMethodsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, 'userProfiles', user.uid, 'paymentMethods');
    }, [firestore, user]);

    const { data: paymentMethods, isLoading: isLoadingMethods } = useCollection<PaymentMethod>(paymentMethodsQuery);

    const paymentsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        // This will query for both product purchases (orderId) and points purchases (userId)
        return query(collection(firestore, 'payments'), where('userId', '==', user.uid));
    }, [firestore, user]);
    
    const { data: transactions, isLoading: areTransactionsLoading } = useCollection<Payment>(paymentsQuery);
    
    const isLoading = isUserLoading || isProfileLoading || isLoadingMethods || areTransactionsLoading;
    const currentBalance = userProfile?.walletBalance || 0;


    const handleDeleteMethod = async (methodId: string) => {
        if (!user || !firestore) return;
        const methodRef = doc(firestore, 'userProfiles', user.uid, 'paymentMethods', methodId);
        try {
            await deleteDoc(methodRef);
            toast({ title: 'Success', description: 'Payment method has been removed.' });
        } catch (error) {
            console.error("Error deleting payment method:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not remove payment method.' });
        }
    };

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
                                <Wallet />
                                Current Balance
                            </CardTitle>
                             <CardDescription>Your available GoFast wallet balance.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           {isLoading ? (
                               <Skeleton className="h-10 w-32" />
                           ) : (
                             <p className="text-4xl font-bold">${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
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
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2"><History /> Transaction History</CardTitle>
                        <CardDescription>A record of all your wallet activities.</CardDescription>
                      </div>
                      <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Amount (USD)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(3)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : transactions && transactions.length > 0 ? (
                                    transactions.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell>{t.paymentDate.toDate().toLocaleDateString()}</TableCell>
                                        <TableCell>
                                          <div className='flex items-center gap-2'>
                                            {getTransactionIcon(t.transactionType)}
                                            <span className='capitalize'>{t.transactionType?.replace('-', ' ')}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell>Order #{t.orderId?.substring(0, 6) || t.userId?.substring(0,6)}...</TableCell>
                                        <TableCell>
                                            <Badge variant={t.paymentStatus === 'completed' ? 'default' : 'secondary'} className={t.paymentStatus === 'completed' ? 'bg-green-600/80' : ''}>
                                                {t.paymentStatus}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={`text-right font-semibold text-red-500`}>
                                            -${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </TableCell>
                                    </TableRow>
                                ))
                                 ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">You have no transactions yet.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                         <Button variant="link" className="mt-4 px-0">View all transactions</Button>
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
                            <div className="space-y-4">
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                            </div>
                        ) : paymentMethods && paymentMethods.length > 0 ? (
                            paymentMethods.map(pm => (
                                <div key={pm.id} className="flex items-center justify-between rounded-lg border p-3">
                                    <div className="flex items-center gap-3">
                                        {pm.type === 'paypal' ? <Mail className="h-6 w-6 text-muted-foreground" /> : <CreditCard className="h-6 w-6 text-muted-foreground" />}
                                        <div>
                                            <p className="font-semibold uppercase">{pm.type}</p>
                                            <p className="text-sm text-muted-foreground">{pm.details}</p>
                                        </div>
                                    </div>
                                    <AlertDialog>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <AlertDialogTrigger asChild>
                                            <DropdownMenuItem className="text-destructive">
                                              <Trash2 className="mr-2 h-4 w-4" />
                                              Delete
                                            </DropdownMenuItem>
                                          </AlertDialogTrigger>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            This will permanently delete this payment method. This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDeleteMethod(pm.id)}>
                                            Continue
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
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
