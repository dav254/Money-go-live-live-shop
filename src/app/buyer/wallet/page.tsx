'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Wallet,
  ArrowRight,
  PlusCircle,
  MoreVertical,
  Trash2,
  Loader2,
  Landmark,
  Mail,
  CreditCard,
  Trophy,
  Share2,
  Copy,
  Gift,
  BadgeCent,
  CheckCircle2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile } from '@/firebase';
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
import type { PaymentMethod, Payment } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

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
        defaultValues: { email: '' },
    });

    const cardForm = useForm<z.infer<typeof cardFormSchema>>({
        resolver: zodResolver(cardFormSchema),
        defaultValues: { cardNumber: '', expiry: '', cvc: '' },
    });
    
    const handleSaveMethod = async (type: 'paypal' | 'card', values: any) => {
        if (!user || !firestore) return;
        setIsSaving(true);
        
        const payoutMethodsRef = collection(firestore, 'userProfiles', user.uid, 'paymentMethods');

        let newMethodData;
        if (type === 'paypal') {
            newMethodData = { type: 'paypal', details: values.email, providerToken: `paypal_${values.email}` };
        } else {
            newMethodData = { type: 'card', details: `Visa **** ${values.cardNumber.slice(-4)}`, providerToken: `card_${Date.now()}` };
        }

        try {
            await addDoc(payoutMethodsRef, newMethodData);
            toast({ title: "Success", description: `Your ${type} method has been saved.` });
            onMethodAdded();
        } catch (error) {
            console.error(`Error saving ${type} method:`, error);
            toast({ variant: 'destructive', title: "Error", description: `Could not save your ${type} method.` });
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
                    <TabsTrigger value="card">Card</TabsTrigger>
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
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost">Cancel</Button>
                                </DialogClose>
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
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost">Cancel</Button>
                                </DialogClose>
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
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
    const firestore = useFirestore();

    const paymentMethodsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, 'userProfiles', user.uid, 'paymentMethods');
    }, [firestore, user]);

    const { data: paymentMethods, isLoading: areMethodsLoading } = useCollection<PaymentMethod>(paymentMethodsQuery);
    
    const isLoading = isUserLoading || areMethodsLoading || isProfileLoading;

    const handleCopyRef = () => {
        if (!user) return;
        const refLink = `${window.location.origin}/signup?ref=${user.uid}`;
        navigator.clipboard.writeText(refLink);
        toast({ title: "Link Copied!", description: "Share this link to earn rewards." });
    };

    const tiers = [
        { name: 'Bronze', points: 350, prize: 'Go Earn T-Shirt', color: 'text-orange-500' },
        { name: 'Silver', points: 700, prize: 'KES 1,000 Voucher', color: 'text-slate-400' },
        { name: 'Gold', points: 1000, prize: 'KES 2,500 Cash', color: 'text-yellow-500' },
    ];

    const currentPoints = userProfile?.aiPoints || 0;
    const nextTier = tiers.find(t => currentPoints < t.points) || tiers[tiers.length - 1];
    const progress = Math.min((currentPoints / nextTier.points) * 100, 100);

    const handleDeleteMethod = async (methodId: string) => {
        if (!user || !firestore) return;
        const methodRef = doc(firestore, 'userProfiles', user.uid, 'paymentMethods', methodId);
        try {
            await deleteDoc(methodRef);
            toast({ title: 'Success', description: 'Payment method has been removed.' });
        } catch(error) {
            console.error('Error deleting payment method:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not remove payment method.' });
        }
    };

  return (
    <BuyerLayout>
      <div className="container mx-auto max-w-4xl py-8 space-y-8 animate-in fade-in duration-500">
        <h1 className="font-headline text-3xl font-black uppercase tracking-tighter text-white">Wallet & Rewards</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-white/5 bg-neutral-900/50">
                <CardHeader>
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-primary" /> Rewards Program
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Refer friends to earn points and prizes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">My Points</p>
                            <p className="text-3xl font-black text-primary">{currentPoints.toLocaleString()}</p>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg">
                            <BadgeCent className="h-6 w-6 text-primary" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                            <span>{nextTier.name} Progress</span>
                            <span className="text-neutral-500">{currentPoints} / {nextTier.points}</span>
                        </div>
                        <Progress value={progress} className="h-2 bg-white/5" />
                        <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Next Prize: {nextTier.prize}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-3 shadow-inner">
                        <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">My Referral Link</p>
                        <div className="flex gap-2">
                            <Input readOnly value={user ? `${window.location.origin}/signup?ref=${user.uid.substring(0,6)}...` : ''} className="h-10 bg-black/40 border-white/10 text-[10px] font-bold font-mono text-white" />
                            <Button size="icon" variant="secondary" className="h-10 w-10 shrink-0" onClick={handleCopyRef}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-white/5 bg-neutral-900/50">
                <CardHeader>
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" /> Saved Methods
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Manage your payment cards and accounts.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-16 w-full rounded-2xl bg-white/5" />
                            <Skeleton className="h-16 w-full rounded-2xl bg-white/5" />
                        </div>
                    ) : paymentMethods && paymentMethods.length > 0 ? (
                        <div className="space-y-3">
                            {paymentMethods.map(pm => (
                                <div key={pm.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/40 p-4 transition-all hover:border-primary/20">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center">
                                            {pm.type === 'paypal' ? <Mail className="h-5 w-5 text-blue-400" /> : <CreditCard className="h-5 w-5 text-primary" />}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-white">{pm.type}</p>
                                            <p className="text-xs font-bold text-neutral-500">{pm.details}</p>
                                        </div>
                                    </div>
                                    <AlertDialog>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/5">
                                            <MoreVertical className="h-4 w-4 text-neutral-500" />
                                        </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-xl shadow-2xl border-white/10">
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem className="text-destructive font-black text-[10px] uppercase tracking-widest">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <AlertDialogContent className="rounded-3xl border-white/10 bg-neutral-950">
                                        <AlertDialogHeader>
                                        <AlertDialogTitle className="font-black uppercase tracking-tighter">Remove Method?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-xs font-bold text-neutral-500 uppercase tracking-widest leading-relaxed">
                                            This will permanently delete this payment method.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteMethod(pm.id)} className="bg-red-600 hover:bg-red-700 rounded-xl font-black uppercase text-[10px]">
                                            Confirm Delete
                                        </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-8 text-center space-y-2 border-2 border-dashed border-white/5 rounded-2xl bg-white/5">
                            <CreditCard className="h-8 w-8 text-neutral-800 mx-auto" />
                            <p className="text-[10px] font-black text-neutral-700 uppercase tracking-widest">No methods saved</p>
                        </div>
                    )}
                    
                    <Dialog open={isAddMethodOpen} onOpenChange={setIsAddMethodOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="w-full h-12 rounded-2xl border-white/10 hover:bg-white/5 font-black uppercase tracking-widest text-[10px]">
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Payment Method
                            </Button>
                        </DialogTrigger>
                        <AddPaymentMethodDialog onMethodAdded={() => setIsAddMethodOpen(false)} />
                    </Dialog>
                </CardContent>
            </Card>
        </div>

        <Card className="border-white/5 bg-neutral-900/50">
            <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <Gift className="h-4 w-4 text-primary" /> Active Coupons
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Discounts applied to your account or sessions.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-white/5 rounded-[2rem] bg-black/20">
                    <Gift className="h-10 w-10 text-neutral-800 mb-4" />
                    <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">No Active Coupons</p>
                    <p className="text-[9px] font-bold text-neutral-700 uppercase tracking-widest mt-1">Watch Live Shows to grab instant deal codes!</p>
                    <Button variant="outline" className="mt-6 font-black uppercase tracking-widest text-[10px] h-10 px-8 rounded-xl border-white/10" asChild>
                        {/* Assuming Link was meant to be imported from next/link */}
                        <span>EXPLORE LIVE NOW</span>
                    </Button>
                </div>
            </CardContent>
        </Card>

      </div>
    </BuyerLayout>
  );
}
