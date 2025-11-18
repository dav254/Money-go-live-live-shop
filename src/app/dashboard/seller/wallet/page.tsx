
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SellerLayout } from '@/components/layout/seller-layout';
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
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
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

interface PayoutMethod {
    id: string;
    type: 'mpesa';
    details: string; // e.g., 'John Doe - 0712345678'
    accountName: string;
    accountNumber: string;
}

const payoutFormSchema = z.object({
  accountName: z.string().min(2, "Account name is required."),
  accountNumber: z.string().regex(/^0\d{9}$/, "Please enter a valid phone number (e.g., 0712345678)."),
});


const AddPayoutMethodDialog = ({ onMethodAdded }: { onMethodAdded: () => void }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<z.infer<typeof payoutFormSchema>>({
        resolver: zodResolver(payoutFormSchema),
        defaultValues: { accountName: '', accountNumber: '' },
    });

    const handleSaveMethod = async (values: z.infer<typeof payoutFormSchema>) => {
        if (!user || !firestore) return;
        setIsSaving(true);
        try {
            const payoutMethodsRef = collection(firestore, 'userProfiles', user.uid, 'payoutMethods');
            await addDoc(payoutMethodsRef, {
                type: 'mpesa',
                details: `${values.accountName} - ${values.accountNumber}`,
                accountName: values.accountName,
                accountNumber: values.accountNumber,
            });
            toast({ title: "Success", description: "M-Pesa payout method saved." });
            onMethodAdded();
        } catch (error) {
            console.error("Error saving payout method:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not save payout method." });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Add M-Pesa Payout Method</DialogTitle>
                <DialogDescription>Enter the M-Pesa account details where you want to receive your funds.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSaveMethod)} className="space-y-4 py-4">
                    <FormField control={form.control} name="accountName" render={({ field }) => (
                        <FormItem><FormLabel>Account Name (Full Name)</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="accountNumber" render={({ field }) => (
                        <FormItem><FormLabel>M-Pesa Phone Number</FormLabel><FormControl><Input placeholder="0712345678" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <DialogFooter>
                        <Button type="submit" className="w-full" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save M-Pesa Account
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    );
};


export default function SellerWalletPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAddMethodOpen, setIsAddMethodOpen] = useState(false);

  const walletData = {
    totalRevenue: 52600.0,
    payouts: 48400.0,
    platformFees: 4200.00,
  };

  const transactions = [
    { type: 'payout', amount: -15000.00, date: '2024-08-25 18:00', balance: 3400.50, description: 'Withdrawal to M-Pesa' },
    { type: 'sale', amount: 950.00, date: '2024-08-26 14:30', balance: 4200.50, description: 'Order #ORD-001' },
    { type: 'sale', amount: 1200.00, date: '2024-08-24 11:45', balance: 8100.50, description: 'Order #ORD-002' },
  ];
  
  const payoutMethodsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'userProfiles', user.uid, 'payoutMethods');
  }, [firestore, user]);

  const { data: payoutMethods, isLoading: isLoadingMethods } = useCollection<PayoutMethod>(payoutMethodsQuery);

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
    <SellerLayout>
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Seller Wallet
          </h1>
          <Button variant="destructive" className="font-bold text-lg px-6">
            Withdraw Funds <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        {/* Wallet Balance Overview */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available for Payout</CardTitle>
              <Wallet className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{walletData.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">This is your total earned revenue.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Paid Out</CardTitle>
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{walletData.payouts.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Funds successfully sent to you.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Platform Fees</CardTitle>
              <CircleDollarSign className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{walletData.platformFees.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Commission paid to MoneyGo.</p>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                {/* Transaction History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><History /> Payout History</CardTitle>
                    <CardDescription>A record of all your wallet activities.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date &amp; Time</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">New Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((tx, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-muted-foreground">{tx.date}</TableCell>
                            <TableCell>
                              <Badge variant={ tx.type === 'payout' ? 'destructive' : 'secondary'}>
                                {tx.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{tx.description}</TableCell>
                            <TableCell className={`text-right font-semibold ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                             <TableCell className="text-right">{tx.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                     <Button variant="link" className="mt-4">View all transactions</Button>
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
                                        <Phone className="h-6 w-6 text-muted-foreground" />
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
    </SellerLayout>
  );
}
