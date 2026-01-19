
'use client';

import React, { useState, useMemo } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Handshake, Zap, Box, Tag, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { generateDealSuggestion, GenerateDealSuggestionOutput } from '@/ai/flows/generate-deal-suggestion';

const DealCard = ({ title, icon: Icon, children }: { title: string, icon: React.ElementType, children: React.ReactNode }) => (
    <Card className="bg-card/50">
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary"><Icon />{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
            {children}
        </CardContent>
    </Card>
);

const DealSkeleton = () => (
    <div className="grid md:grid-cols-3 gap-6">
        <Card><CardHeader><Skeleton className="h-5 w-24" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-5 w-24" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-5 w-24" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>
    </div>
)

export default function AIDealMakerPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [deal, setDeal] = useState<GenerateDealSuggestionOutput | null>(null);

    const productsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
    }, [firestore, user]);

    const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

    const handleGenerateDeals = async () => {
        if (!selectedProductId) {
            toast({ variant: 'destructive', title: 'Please select a product first.' });
            return;
        }

        const product = products?.find(p => p.id === selectedProductId);
        if (!product || !user) return;

        setIsLoading(true);
        setDeal(null);
        
        try {
            const result = await generateDealSuggestion({
                productName: product.name,
                productCategory: product.category || 'General',
                currentPrice: product.price,
                productDescription: product.description || '',
                userId: user.uid,
            });
            setDeal(result);
            toast({ title: 'Deals Generated!', description: 'Your new deal suggestions are ready.' });
        } catch (error: any) {
            console.error('Error generating deal suggestion:', error);
            toast({ variant: 'destructive', title: 'AI Error', description: error.message || 'Could not generate deal suggestions. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl flex items-center gap-2">
                           <Handshake className="text-primary" /> AI Deal Maker
                        </CardTitle>
                        <CardDescription>
                           Select a product and let our AI generate strategic deal suggestions to boost your sales. This costs 100 AI Points.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col md:flex-row items-center gap-4">
                        <Select onValueChange={setSelectedProductId} disabled={areProductsLoading}>
                            <SelectTrigger className="w-full md:w-[300px]">
                                <SelectValue placeholder={areProductsLoading ? "Loading products..." : "Select a product"} />
                            </SelectTrigger>
                            <SelectContent>
                                {products?.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button onClick={handleGenerateDeals} disabled={isLoading || !selectedProductId}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Generate Deals (100 Points)
                        </Button>
                    </CardContent>
                </Card>

                {isLoading && <DealSkeleton />}

                {deal && (
                    <div className="grid md:grid-cols-3 gap-6">
                        <DealCard title="Flash Sale" icon={Zap}>
                            <p className="font-bold text-2xl text-foreground">${deal.flashSale.newPrice.toFixed(2)}</p>
                            <p className="text-muted-foreground line-through">Was ${deal.flashSale.originalPrice.toFixed(2)}</p>
                            <p className="mt-2"><strong className="text-foreground">Reason:</strong> {deal.flashSale.reason}</p>
                        </DealCard>
                         <DealCard title="Smart Bundle" icon={Box}>
                            <p className="font-bold text-lg text-foreground">Bundle with:</p>
                            <p>{deal.smartBundle.bundleWith}</p>
                            <p className="font-bold text-2xl text-foreground mt-2">${deal.smartBundle.bundlePrice.toFixed(2)}</p>
                            <p className="mt-2"><strong className="text-foreground">Reason:</strong> {deal.smartBundle.reason}</p>
                        </DealCard>
                         <DealCard title="Tiered Offer" icon={Tag}>
                            <p className="font-bold text-lg text-foreground">{deal.tieredOffer.offer}</p>
                             <p className="mt-2"><strong className="text-foreground">Reason:</strong> {deal.tieredOffer.reason}</p>
                        </DealCard>
                    </div>
                )}
            </div>
        </SellerLayout>
    );
}
