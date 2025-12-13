
'use client';

import { useState, useMemo, ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, PlusCircle, MoreVertical, Trash2, Loader2, Landmark, Mail } from 'lucide-react';
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
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import type { PaymentMethod } from '@/lib/types';

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


export default function BuyerPaymentsPage() {
    const { toast } = useToast();
    const [isAddMethodOpen, setIsAddMethodOpen] = useState(false);
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();

    const paymentMethodsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, 'userProfiles', user.uid, 'paymentMethods');
    }, [firestore, user]);

    const { data: paymentMethods, isLoading: isLoadingMethods } = useCollection<PaymentMethod>(paymentMethodsQuery);
    
    const isLoading = isUserLoading || isLoadingMethods;


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
      <div className="container mx-auto max-w-2xl py-8">
        <h1 className="font-headline text-3xl font-bold mb-8">Payment Methods</h1>
        <Card>
            <CardHeader>
                <CardTitle>My Payment Methods</CardTitle>
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
    </BuyerLayout>
  );
}
