
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BadgePercent, Users, Trophy, BarChart2, Share2, Target, Percent, PlusCircle, Trash2, AlertTriangle, TrendingUp, Lightbulb, Loader2 } from 'lucide-react';
import { CommissionSettingsTable } from '@/components/seller/commission-settings-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import React, { useMemo, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { formatDistanceToNow } from 'date-fns';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';
import type { Product, UserProfile, ResellActivity, CommissionTier } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';

const mockAlerts = [
    {
        type: 'boost',
        title: "Top Performer: 'Classic Handbag'",
        description: "This item is being shared a lot but has a low commission rate (5%). Consider increasing it to 10-15% to motivate resellers even more.",
        icon: TrendingUp,
        color: 'text-green-400'
    },
    {
        type: 'stale',
        title: "Stale Product: 'Winter Scarf'",
        description: "This product hasn't been shared by any resellers in over 30 days. Consider pausing it or creating new video content to promote it.",
        icon: AlertTriangle,
        color: 'text-yellow-400'
    }
]

const TopSharedProductsTable = () => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Total Shares</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow>
                    <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                        Data is being connected.
                    </TableCell>
                </TableRow>
            </TableBody>
        </Table>
    )
}

const tierFormSchema = z.object({
    salesTarget: z.coerce.number().min(1, 'Sales target must be at least 1.'),
    commissionBoost: z.coerce.number().min(1, 'Boost must be at least 1%.').max(100),
    description: z.string().min(10, 'Please provide a short description.'),
});

const CommissionTiers = ({ sellerId }: { sellerId: string }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const tiersQuery = useMemoFirebase(() => {
        return query(collection(firestore, 'sellerShops', sellerId, 'commissionTiers'));
    }, [firestore, sellerId]);
    const { data: tiers, isLoading } = useCollection<CommissionTier>(tiersQuery);

    const form = useForm<z.infer<typeof tierFormSchema>>({
        resolver: zodResolver(tierFormSchema),
        defaultValues: { salesTarget: 20, commissionBoost: 5, description: '' },
    });

    async function onSubmit(values: z.infer<typeof tierFormSchema>) {
        setIsSaving(true);
        const tiersRef = collection(firestore, 'sellerShops', sellerId, 'commissionTiers');
        try {
            await addDoc(tiersRef, {
                sellerId,
                ...values,
                createdAt: serverTimestamp(),
            });
            toast({ title: 'Success!', description: 'New commission tier created.' });
            setIsDialogOpen(false);
            form.reset();
        } catch (error) {
            console.error("Failed to create tier", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not create the tier.' });
        } finally {
            setIsSaving(false);
        }
    }
    
    const handleDelete = async (tierId: string) => {
        const tierRef = doc(firestore, 'sellerShops', sellerId, 'commissionTiers', tierId);
        try {
            await deleteDoc(tierRef);
            toast({ title: 'Tier Deleted' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the tier.' });
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Trophy />
                            Commission Tiers
                        </CardTitle>
                        <CardDescription>
                            Create performance-based tiers to incentivize your top resellers.
                        </CardDescription>
                    </div>
                     <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button><PlusCircle className="mr-2 h-4 w-4" /> Create Tier</Button>
                        </DialogTrigger>
                        <DialogContent>
                             <DialogHeader>
                                <DialogTitle>Create New Commission Tier</DialogTitle>
                                <DialogDescription>Set a sales goal to unlock a higher commission rate.</DialogDescription>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                                     <FormField control={form.control} name="salesTarget" render={({ field }) => (
                                        <FormItem><Label>Sales Target (monthly)</Label><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                     )} />
                                     <FormField control={form.control} name="commissionBoost" render={({ field }) => (
                                        <FormItem><Label>Commission Boost (%)</Label><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                     )} />
                                     <FormField control={form.control} name="description" render={({ field }) => (
                                        <FormItem><Label>Description</Label><FormControl><Input placeholder="e.g., Unlocks a 'Top Reseller' badge" {...field} /></FormControl><FormMessage /></FormItem>
                                     )} />
                                     <DialogFooter>
                                        <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                                        <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Tier</Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Sales Target (monthly)</TableHead>
                            <TableHead>Commission Boost</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                             <TableRow><TableCell colSpan={3} className="h-24 text-center">Loading tiers...</TableCell></TableRow>
                        ) : tiers && tiers.length > 0 ? (
                            tiers.map(tier => (
                            <TableRow key={tier.id}>
                                <TableCell>
                                    <p className="font-medium">{tier.salesTarget} items</p>
                                    <p className="text-xs text-muted-foreground">{tier.description}</p>
                                </TableCell>
                                <TableCell className="font-semibold text-green-500">+{tier.commissionBoost}%</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(tier.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))) : (
                             <TableRow>
                                <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                                    No commission tiers created yet.
                                </TableCell>
                            </TableRow>
                         )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};


export default function ResellerCenterPage() {
    const { user } = useUser();

    return (
        <SellerLayout>
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h1 className="font-headline text-3xl font-bold tracking-tight">
            Reseller Center
            </h1>
            
            <Tabs defaultValue="commissions" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="analytics"><BarChart2 className="mr-2 h-4 w-4"/>Analytics</TabsTrigger>
                    <TabsTrigger value="commissions"><BadgePercent className="mr-2 h-4 w-4"/>Commission Rules</TabsTrigger>
                    <TabsTrigger value="tiers"><Trophy className="mr-2 h-4 w-4" />Commission Tiers</TabsTrigger>
                </TabsList>

                <TabsContent value="analytics" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Lightbulb /> Performance Alerts</CardTitle>
                            <CardDescription>AI-powered suggestions to optimize your reseller program.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {mockAlerts.map(alert => (
                                <Alert key={alert.title} variant={alert.type === 'stale' ? 'destructive' : 'default'} className="bg-primary/5">
                                    <alert.icon className={`h-4 w-4 ${alert.color}`} />
                                    <AlertTitle className="font-semibold">{alert.title}</AlertTitle>
                                    <AlertDescription>
                                        {alert.description}
                                        <Button variant="link" className="p-0 h-auto ml-2">Take Action</Button>
                                    </AlertDescription>
                                </Alert>
                            ))}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Share2 /> Top Shared Products</CardTitle>
                            <CardDescription>Products most frequently shared by your reseller network.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TopSharedProductsTable />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="commissions" className="space-y-4">
                    <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                        <BadgePercent />
                        Set Product Commission Rates
                        </CardTitle>
                        <CardDescription>Set the percentage a reseller will earn for selling each product. A rate of 0% means the product is not available for reselling.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CommissionSettingsTable />
                    </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="tiers">
                    {user && <CommissionTiers sellerId={user.uid} />}
                </TabsContent>

            </Tabs>
        </div>
        </SellerLayout>
    );
}
