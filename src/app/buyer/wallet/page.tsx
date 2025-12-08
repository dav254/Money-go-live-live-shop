
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, Download, Gift, PlusCircle, Wallet, Bot, Loader2, History, ShoppingBag, MoreVertical, Trash2, ArrowDownUp, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/firebase';
import type { PaymentMethod, Transaction } from '@/lib/types';
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

// Dummy data for transactions - in a real app, this would be fetched from an API
const dummyTransactions: Transaction[] = [
    { id: '1', date: new Date(), type: 'purchase', description: 'Vintage Leather Jacket', status: 'Completed', amount: -120.00 },
    { id: '2', date: new Date(), type: 'withdrawal', description: 'Withdrawal to Bank', status: 'Completed', amount: -500.00 },
    { id: '3', date: new Date(), type: 'refund', description: 'Refund for damaged item', status: 'Completed', amount: 45.50 },
    { id: '4', date: new Date(), type: 'purchase', description: 'Handmade Ceramic Mug', status: 'Pending', amount: -25.50 },
];

const cardFormSchema = z.object({
  cardNumber: z.string().min(16, "Card number must be 16 digits.").max(16, "Card number must be 16 digits."),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/, "Invalid expiry date. Use MM/YY format."),
  cvc: z.string().min(3, "CVC must be 3 digits.").max(3, "CVC must be 3 digits."),
});

const AddPaymentMethodDialog = ({ onMethodAdded }: { onMethodAdded: () => void }) => {
    const { user } = useUser();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<z.infer<typeof cardFormSchema>>({
        resolver: zodResolver(cardFormSchema),
        defaultValues: { cardNumber: '', expiry: '', cvc: '' },
    });

    const handleSaveCard = async (values: z.infer<typeof cardFormSchema>) => {
        if (!user) return;
        setIsSaving(true);
        try {
            // In a real app, you would call your backend API to save the payment method
            console.log("Saving card:", values);
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
        if (!user) return;
        setIsSaving(true);
         try {
            // In a real app, you would handle the PayPal linking flow
            console.log("Linking PayPal");
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
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount (USD)</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
);

const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
        case 'purchase': return <ShoppingBag className="h-4 w-4 text-blue-500" />;
        case 'withdrawal': return <ArrowRight className="h-4 w-4 text-red-500" />;
        case 'refund': return <ArrowDownUp className="h-4 w-4 text-green-500" />;
        default: return <Wallet className="h-4 w-4" />;
    }
}


export default function BuyerWalletPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const { toast } = useToast();
    const [isAddMethodOpen, setIsAddMethodOpen] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [isLoadingMethods, setIsLoadingMethods] = useState(true);

    useEffect(() => {
      const fetchTransactions = async () => {
        try {
          const response = await fetch('/api/transactions');
          if (!response.ok) throw new Error('Failed to fetch transactions');
          const data = await response.json();
          setTransactions(data);
        } catch (error) {
          console.error(error);
          toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch transaction history.' });
        }
      };

      const fetchPaymentMethods = async () => {
        setIsLoadingMethods(true);
        try {
          // In a real app, you would fetch payment methods from your API
          // For now, we'll use dummy data
          const dummyMethods: PaymentMethod[] = [
            { id: '1', type: 'card', details: 'Visa **** 4242', isDefault: true },
            { id: '2', type: 'paypal', details: 'user@example.com', isDefault: false },
          ];
          setPaymentMethods(dummyMethods);
        } catch (error) {
          console.error("Error fetching payment methods:", error);
          toast({ variant: 'destructive', title: 'Error', description: 'Could not load payment methods.' });
        } finally {
          setIsLoadingMethods(false);
        }
      };

      const loadData = async () => {
        setIsLoading(true);
        await Promise.all([fetchTransactions(), fetchPaymentMethods()]);
        setIsLoading(false);
      }

      if(user) {
        loadData();
      }
    }, [user, toast]);


    const currentBalance = useMemo(() => {
        return transactions.reduce((sum, t) => sum + t.amount, 0) + 2500; // Starting balance
    }, [transactions]);

    const handleDeleteMethod = async (methodId: string) => {
        if (!user) return;
        try {
            // In a real app, call your backend to delete the method
            console.log(`Deleting method ${methodId}`)
            setPaymentMethods(prev => prev.filter(pm => pm.id !== methodId));
            toast({ title: 'Success', description: 'Payment method has been removed.' });
        } catch (error) {
            console.error('Error deleting payment method:', error);
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
                                <Skeleton className="h-10 w-3/4" />
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
                        {isLoading ? <TransactionTableSkeleton /> : (
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
                                    {transactions && transactions.length > 0 ? transactions.map(t => (
                                        <TableRow key={t.id}>
                                            <TableCell>{t.date.toLocaleDateString()}</TableCell>
                                            <TableCell>
                                              <div className='flex items-center gap-2'>
                                                {getTransactionIcon(t.type)}
                                                <span className='capitalize'>{t.type}</span>
                                              </div>
                                            </TableCell>
                                            <TableCell>{t.description}</TableCell>
                                            <TableCell>
                                                <Badge variant={t.status === 'Completed' ? 'default' : 'secondary'} className={t.status === 'Completed' ? 'bg-green-600/80' : ''}>
                                                    {t.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className={`text-right font-semibold ${t.amount > 0 ? 'text-green-600' : 'text-slate-800'}`}>
                                                {t.amount > 0 ? '+' : ''}${Math.abs(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">You have no transactions yet.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
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
