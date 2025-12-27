
'use client';

import { useState, useMemo, ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ResellerLayout } from '@/components/layout/reseller-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Wallet,
  ArrowRight,
  Download,
  Settings,
  ShieldCheck,
  CreditCard,
  History,
  CircleDollarSign,
  PlusCircle,
  MoreVertical,
  Trash2,
  Phone,
  Loader2,
  Landmark,
  Mail,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PayoutMethod, Payout, Order } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FirestorePermissionError } from '@/firebase/errors';


const paypalFormSchema = z.object({
  email: z.string().email("Please enter a valid PayPal email address."),
});

const bankFormSchema = z.object({
  accountName: z.string().min(2, "Account holder's name is required."),
  accountNumber: z.string().min(5, "Account number is required."),
  bankName: z.string().min(2, "Bank name is required."),
  country: z.string().min(2, "Country is required."),
});

const withdrawSchema = (maxAmount: number) => z.object({
  amount: z.coerce.number().min(1, 'Amount must be greater than 0.').max(maxAmount, `Amount cannot exceed available balance of $${maxAmount.toFixed(2)}.`),
  payoutMethodId: z.string().min(1, 'You must select a payout method.'),
});


const AddPayoutMethodDialog = ({ onMethodAdded }: { onMethodAdded: () => void }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const paypalForm = useForm<z.infer<typeof paypalFormSchema>>({
        resolver: zodResolver(paypalFormSchema),
        defaultValues: { email: user?.email || '' },
    });

    const bankForm = useForm<z.infer<typeof bankFormSchema>>({
        resolver: zodResolver(bankFormSchema),
        defaultValues: { accountName: '', accountNumber: '', bankName: '', country: '' },
    });

    const handleSavePayPal = async (values: z.infer<typeof paypalFormSchema>) => {
        if (!user || !firestore) return;
        setIsSaving(true);
        try {
            const payoutMethodsRef = collection(firestore, 'userProfiles', user.uid, 'payoutMethods');
            await addDoc(payoutMethodsRef, {
                type: 'paypal',
                details: values.email,
                paypalEmail: values.email,
            });
            toast({ title: "Success", description: "PayPal payout method saved." });
            onMethodAdded();
        } catch (error) {
            console.error("Error saving PayPal method:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not save payout method." });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleSaveBank = async (values: z.infer<typeof bankFormSchema>) => {
        if (!user || !firestore) return;
        setIsSaving(true);
        try {
            const payoutMethodsRef = collection(firestore, 'userProfiles', user.uid, 'payoutMethods');
            await addDoc(payoutMethodsRef, {
                type: 'bank',
                details: `${values.bankName} - *...${values.accountNumber.slice(-4)}`,
                ...values
            });
            toast({ title: "Success", description: "Bank account saved for Paystack payouts." });
            onMethodAdded();
        } catch (error) {
            console.error("Error saving bank method:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not save payout method." });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Add Payout Method</DialogTitle>
                <DialogDescription>Add a PayPal or Bank Account to receive your earnings.</DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="paypal" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="paypal">PayPal</TabsTrigger>
                    <TabsTrigger value="bank">Bank (Paystack)</TabsTrigger>
                </TabsList>
                <TabsContent value="paypal">
                     <Form {...paypalForm}>
                        <form onSubmit={paypalForm.handleSubmit(handleSavePayPal)} className="space-y-4 py-4">
                             <FormField control={paypalForm.control} name="email" render={({ field }) => (
                                <FormItem><FormLabel>PayPal Email</FormLabel><FormControl><Input placeholder="you@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <DialogFooter>
                                <Button type="submit" className="w-full" disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save PayPal Account'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </TabsContent>
                <TabsContent value="bank">
                     <Form {...bankForm}>
                        <form onSubmit={bankForm.handleSubmit(handleSaveBank)} className="space-y-4 py-4">
                             <FormField control={bankForm.control} name="accountName" render={({ field }) => (
                                <FormItem><FormLabel>Account Holder Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={bankForm.control} name="accountNumber" render={({ field }) => (
                                <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input placeholder="1234567890" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={bankForm.control} name="bankName" render={({ field }) => (
                                <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input placeholder="Equity Bank" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={bankForm.control} name="country" render={({ field }) => (
                                <FormItem><FormLabel>Country</FormLabel><FormControl><Input placeholder="Kenya" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <DialogFooter>
                                <Button type="submit" className="w-full" disabled={isSaving}>
                                     {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Bank Account'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </TabsContent>
            </Tabs>
        </DialogContent>
    );
};

const WithdrawFundsDialog = ({ balance, payoutMethods, onWithdrawal }: { balance: number, payoutMethods: PayoutMethod[], onWithdrawal: () => void }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isRequesting, setIsRequesting] = useState(false);

    const form = useForm<z.infer<ReturnType<typeof withdrawSchema>>>({
        resolver: zodResolver(withdrawSchema(balance)),
        defaultValues: { amount: balance, payoutMethodId: '' },
    });
    
    const handleWithdraw = async (values: z.infer<ReturnType<typeof withdrawSchema>>) => {
        if (!user || !firestore) return;
        setIsRequesting(true);

        const selectedMethod = payoutMethods.find(pm => pm.id === values.payoutMethodId);
        if (!selectedMethod) {
            toast({ variant: 'destructive', title: 'Error', description: 'Invalid payout method selected.' });
            setIsRequesting(false);
            return;
        }
        
        try {
            const payoutsRef = collection(firestore, 'payouts');
            const newPayoutData: Omit<Payout, 'id'> = {
                sellerId: user.uid,
                amount: values.amount,
                payoutMethodId: selectedMethod.id,
                payoutMethodInfo: `${selectedMethod.type}: ${selectedMethod.details}`,
                status: 'pending',
                requestedAt: serverTimestamp() as any,
            };

            await addDoc(payoutsRef, newPayoutData).catch(error => {
                const permissionError = new FirestorePermissionError({
                    path: payoutsRef.path,
                    operation: 'create',
                    requestResourceData: newPayoutData,
                });
                errorEmitter.emit('permission-error', permissionError);
            });

            toast({ title: 'Success', description: 'Your withdrawal request has been submitted for processing.' });
            onWithdrawal();
        } catch (error) {
             console.error("Error submitting payout request:", error);
             toast({ variant: 'destructive', title: 'Error', description: 'Could not submit your withdrawal request.' });
        } finally {
            setIsRequesting(false);
        }
    };

    return (
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Request a Withdrawal</DialogTitle>
                <DialogDescription>
                    Your available balance is <span className="font-bold text-primary">${balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>. 
                    Requests are processed within 2-3 business days.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleWithdraw)} className="space-y-6">
                    <FormField control={form.control} name="amount" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Amount to Withdraw (USD)</FormLabel>
                            <FormControl>
                                <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="payoutMethodId" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Send to</FormLabel>
                            <FormControl>
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col gap-3">
                                    {payoutMethods.map(pm => (
                                        <FormItem key={pm.id} className="flex items-center space-x-3 space-y-0 rounded-lg border p-3 has-[:checked]:border-primary">
                                            <FormControl>
                                                <RadioGroupItem value={pm.id} />
                                            </FormControl>
                                            <FormLabel className="font-normal flex items-center gap-3 w-full">
                                                {pm.type === 'paypal' ? <Mail className="h-5 w-5 text-muted-foreground" /> : <Landmark className="h-5 w-5 text-muted-foreground" />}
                                                <div>
                                                    <p className="font-semibold uppercase">{pm.type}</p>
                                                    <p className="text-sm text-muted-foreground">{pm.details}</p>
                                                </div>
                                            </FormLabel>
                                        </FormItem>
                                    ))}
                                </RadioGroup>
                            </FormControl>
                             <FormMessage />
                        </FormItem>
                    )} />
                    
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isRequesting}>
                             {isRequesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirm Withdrawal'}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    );
};

const StatCard = ({ title, value, icon: Icon, description, isLoading }: { title: string, value: string | ReactNode, icon: React.ElementType, description?: string, isLoading?: boolean }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <>
                <Skeleton className="h-8 w-3/4 mb-2" />
                <Skeleton className="h-3 w-full" />
            </>
        ) : (
            <>
                <div className="text-3xl font-bold">{value}</div>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </>
        )}
      </CardContent>
    </Card>
);

export default function ResellerWalletPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAddMethodOpen, setIsAddMethodOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  // Fetch Payout Methods
  const payoutMethodsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'userProfiles', user.uid, 'payoutMethods');
  }, [firestore, user]);
  const { data: payoutMethods, isLoading: isLoadingMethods } = useCollection<PayoutMethod>(payoutMethodsQuery);

  // Fetch Orders to calculate commissions
  const resellerOrdersQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'orders'), where('resellerId', '==', user.uid));
  }, [firestore, user]);
  
  const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(resellerOrdersQuery);

  // Fetch Payouts to calculate what has been paid
  const payoutsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'payouts'), where('sellerId', '==', user.uid));
  }, [firestore, user]);
  
  const { data: payouts, isLoading: arePayoutsLoading } = useCollection<Payout>(payoutsQuery);
  
  const isLoading = isUserLoading || isLoadingMethods || arePayoutsLoading || areOrdersLoading;

  // Calculate wallet balances
  const { availableBalance, pendingBalance, totalEarned } = useMemo(() => {
    let clearedCommission = 0;
    let pendingCommission = 0;
    
    (orders || []).forEach(order => {
        const commission = order.resellerCommission || 0;
        if (commission > 0) {
            if (order.orderStatus === 'delivered') {
                clearedCommission += commission;
            } else if (order.orderStatus === 'processing' || order.orderStatus === 'shipped') {
                pendingCommission += commission;
            }
        }
    });

    const totalPaidOut = payouts?.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0) || 0;
    
    return {
      availableBalance: clearedCommission - totalPaidOut,
      pendingBalance: pendingCommission,
      totalEarned: clearedCommission,
    };
  }, [orders, payouts]);
  
  const getCommissionStatus = (orderStatus: Order['orderStatus']): {text: string, variant: 'secondary' | 'default' | 'destructive'} => {
    switch(orderStatus) {
        case 'delivered':
            return { text: 'Cleared', variant: 'default' };
        case 'shipped':
        case 'processing':
        case 'pending':
            return { text: 'Pending', variant: 'secondary' };
        case 'cancelled':
        case 'disputed':
            return { text: 'Cancelled', variant: 'destructive' };
        default:
            return { text: 'Pending', variant: 'secondary' };
    }
  }
  
  // Combine and sort transactions for history
  const transactions = useMemo(() => {
    const commissionTxs = (orders || [])
        .filter(order => order.resellerCommission && order.resellerCommission > 0)
        .map(order => ({
            id: order.id,
            type: 'commission' as const,
            amount: order.resellerCommission || 0,
            date: order.orderDate.toDate(),
            description: `Commission: ${order.productName}`,
            status: getCommissionStatus(order.orderStatus),
    }));

    const payoutTxs = (payouts || []).map(payout => ({
      id: payout.id,
      type: 'payout' as const,
      amount: -payout.amount,
      date: payout.requestedAt.toDate(),
      description: `Withdrawal to ${payout.payoutMethodInfo}`,
      status: { text: payout.status, variant: payout.status === 'completed' ? 'default' : 'secondary' } as {text: string, variant: 'secondary' | 'default' | 'destructive'},
    }));

    return [...commissionTxs, ...payoutTxs].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [orders, payouts]);


  const handleDeleteMethod = async (methodId: string) => {
    if (!user || !firestore) return;
    const methodRef = doc(firestore, 'userProfiles', user.uid, 'payoutMethods', methodId);
    try {
        await deleteDoc(methodRef);
        toast({
            title: 'Success',
            description: 'Payout method has been removed.',
        });
    } catch (error) {
        console.error('Error deleting payout method:', error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not remove payout method. Please try again.',
        });
    }
  };


  return (
    <ResellerLayout>
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            My Wallet
          </h1>
           <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="font-bold text-lg px-6" disabled={!payoutMethods || payoutMethods.length === 0 || availableBalance <= 0}>
                    Withdraw Funds <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </DialogTrigger>
              {payoutMethods && <WithdrawFundsDialog balance={availableBalance} payoutMethods={payoutMethods} onWithdrawal={() => setIsWithdrawOpen(false)} />}
            </Dialog>
        </div>

        {/* Wallet Balance Overview */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Available for Payout"
            value={`$${availableBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}`}
            icon={Wallet}
            description="This is your current withdrawable balance."
            isLoading={isLoading}
          />
          <StatCard
            title="Pending Clearance"
            value={`$${pendingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}`}
            icon={CircleDollarSign}
            description="From orders awaiting delivery."
            isLoading={isLoading}
          />
          <StatCard
            title="Total Cleared Earnings"
            value={`$${totalEarned.toLocaleString(undefined, {minimumFractionDigits: 2})}`}
            icon={History}
            description="All commissions from completed sales."
            isLoading={isLoading}
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                {/* Transaction History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><History /> Commission & Payout History</CardTitle>
                    <CardDescription>A record of all your wallet activities.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                           <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                            [...Array(3)].map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6" /></TableCell></TableRow>
                            ))
                        ) : transactions.length > 0 ? (
                          transactions.slice(0, 10).map((tx, i) => (
                          <TableRow key={`${tx.id}-${i}`}>
                            <TableCell className="text-muted-foreground text-xs">{tx.date.toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Badge variant={ tx.type === 'payout' ? 'destructive' : 'secondary'}>
                                {tx.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{tx.description}</TableCell>
                            <TableCell><Badge variant={tx.status.variant} className={tx.status.variant === 'default' ? 'bg-green-600/80' : tx.status.variant === 'secondary' ? 'bg-yellow-500/80' : ''}>{tx.status.text}</Badge></TableCell>
                            <TableCell className={`text-right font-semibold ${tx.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {tx.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                            </TableCell>
                          </TableRow>
                        ))) : (
                             <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">No transactions yet.</TableCell>
                            </TableRow>
                        )}
                      </TableBody>
                    </Table>
                     <Button variant="link" className="mt-4 px-0">View all transactions</Button>
                  </CardContent>
                </Card>
            </div>
            <div className="space-y-8">
                {/* Payout Methods */}
                 <Card>
                    <CardHeader>
                        <CardTitle>Payout Settings</CardTitle>
                         <CardDescription>Manage where your funds will be sent.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isLoadingMethods ? (
                            <Skeleton className="h-16 w-full rounded-lg" />
                        ) : payoutMethods && payoutMethods.length > 0 ? (
                             payoutMethods.map(pm => (
                                <div key={pm.id} className="flex items-center justify-between rounded-lg border p-3">
                                    <div className="flex items-center gap-3">
                                        {pm.type === 'paypal' ? <Mail className="h-6 w-6 text-muted-foreground" /> : <Landmark className="h-6 w-6 text-muted-foreground" />}
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
                                            This will permanently delete this payout method. This action cannot be undone.
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
                            <p className="text-sm text-muted-foreground text-center pt-4">No payout methods saved.</p>
                        )}
                        <Dialog open={isAddMethodOpen} onOpenChange={setIsAddMethodOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full">
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Add Payout Method
                                </Button>
                            </DialogTrigger>
                           <AddPayoutMethodDialog onMethodAdded={() => setIsAddMethodOpen(false)} />
                        </Dialog>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    </ResellerLayout>
  );
}

