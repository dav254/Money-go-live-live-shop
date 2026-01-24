'use client';

import React, { useState, useMemo } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Bot, Youtube, Loader2, Sparkles, Copy, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { generateAdKit, AdKitOutput } from '@/ai/flows/generate-ad-kit';


const ProductSelectionCard = ({ product, onSelect, isSelected }: { product: Product; onSelect: (id: string) => void; isSelected: boolean }) => (
    <Label
        htmlFor={product.id}
        className={`flex items-center gap-4 rounded-lg p-3 border-2 transition-colors cursor-pointer ${
            isSelected ? "border-primary bg-primary/10" : "border-card bg-card hover:bg-muted/50"
        }`}
    >
        <RadioGroupItem value={product.id} id={product.id} />
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md">
            {product.videoUrl || (product.videoUrls && product.videoUrls.length > 0) ? (
                 <video src={product.videoUrl || product.videoUrls?.[0]} className="h-full w-full object-cover" muted />
            ) : (
                <Image src={product.imageUrl || '/placeholder.svg'} alt={product.name || 'Product Image'} fill className="object-cover" />
            )}
        </div>
        <div className="flex-1">
            <p className="font-semibold">{product.name}</p>
            <p className="text-sm text-primary">${product.price.toLocaleString()}</p>
        </div>
    </Label>
);

const AdKitDisplay = ({ kit }: { kit: AdKitOutput }) => {
    const { toast } = useToast();
    const copyToClipboard = (text: string, fieldName: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: `${fieldName} Copied!`, description: 'Ready to paste.' });
    };

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText /> Your YouTube Boost Guide</CardTitle>
                <CardDescription>Copy the content below and follow the steps to promote your video on YouTube.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Optimized Title</Label>
                    <div className="relative">
                        <Input readOnly value={kit.title} className="pr-10" />
                        <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => copyToClipboard(kit.title, 'Title')}><Copy className="h-4 w-4" /></Button>
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label>Optimized Description</Label>
                     <div className="relative">
                        <Textarea readOnly value={kit.description} rows={5} className="pr-10" />
                         <Button size="icon" variant="ghost" className="absolute right-1 top-2 h-8 w-8" onClick={() => copyToClipboard(kit.description, 'Description')}><Copy className="h-4 w-4" /></Button>
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label>Suggested Tags</Label>
                    <div className="relative">
                        <Input readOnly value={kit.tags.join(', ')} className="pr-10"/>
                         <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => copyToClipboard(kit.tags.join(', '), 'Tags')}><Copy className="h-4 w-4" /></Button>
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label>Promotion Steps</Label>
                    <ol className="list-decimal list-inside space-y-2 text-sm bg-muted p-4 rounded-md">
                        {kit.instructions.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                </div>
            </CardContent>
        </Card>
    );
};

export default function AssistBoostPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [adKit, setAdKit] = useState<AdKitOutput | null>(null);

    const productsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
    }, [firestore, user]);

    const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

    const productsWithVideo = useMemo(() => {
        if (!products) return [];
        return products.filter(p => p.videoUrl || (p.videoUrls && p.videoUrls.length > 0));
    }, [products]);
    
    const handleGenerate = async () => {
        if (!selectedProductId || !user) return;
        const product = products?.find(p => p.id === selectedProductId);
        if (!product) return;

        setIsLoading(true);
        setAdKit(null);

        try {
            const result = await generateAdKit({
                productId: product.id,
                productName: product.name,
                productDescription: product.description || '',
                platform: 'youtube', // Hardcoded for now
                userId: user.uid,
                location: product.location,
            });
            setAdKit(result);
            toast({ title: 'Boost Guide Generated!', description: 'Your promotion kit is ready.' });
        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Generation Failed', description: error.message || 'Could not generate the ad kit.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SellerLayout>
            <div className="flex-1 space-y-6 p-8 pt-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl flex items-center gap-2">
                           <Bot className="text-primary" /> AI "Assist Boost" Center
                        </CardTitle>
                        <CardDescription>
                           Select a video, choose a platform, and pay with points to get an AI-generated ad kit and step-by-step guide to boost your video.
                        </CardDescription>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>1. Select a Product Video to Promote</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {areProductsLoading ? <p>Loading your products...</p> : productsWithVideo.length === 0 ? (
                            <p className="text-muted-foreground">You have no products with videos. Please upload a video to a product first.</p>
                        ) : (
                             <RadioGroup value={selectedProductId || ''} onValueChange={setSelectedProductId}>
                                <div className="space-y-2">
                                {productsWithVideo.map(p => (
                                    <ProductSelectionCard key={p.id} product={p} onSelect={setSelectedProductId} isSelected={selectedProductId === p.id} />
                                ))}
                                </div>
                            </RadioGroup>
                        )}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>2. Generate Your Boost Guide</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleGenerate} disabled={!selectedProductId || isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Generate for YouTube (50 Points)
                        </Button>
                    </CardContent>
                </Card>
                
                {adKit && <AdKitDisplay kit={adKit} />}

            </div>
        </SellerLayout>
    );
}