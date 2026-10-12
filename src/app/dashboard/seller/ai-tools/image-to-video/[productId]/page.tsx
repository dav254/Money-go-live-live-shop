
'use client';

import React, { useState } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { generateVideoFromImage } from '@/ai/flows/generate-video-from-image';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, ChevronLeft, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

const PageSkeleton = () => (
    <div className="flex-1 space-y-4 p-8 pt-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-2 gap-8">
            <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
        </div>
    </div>
);

export default function GenerateImagePage() {
    const params = useParams();
    const productId = (params?.productId as string) || '';
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();

    const [prompt, setPrompt] = useState<string>('A professional, clean product shot of the item on a white background.');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

    const productRef = useMemoFirebase(() => {
        if (!productId) return null;
        return doc(firestore, 'products', productId);
    }, [firestore, productId]);

    const { data: product, isLoading } = useDoc<Product>(productRef);

    const handleGenerateImage = async () => {
        if (!product || !prompt) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please enter a prompt.' });
            return;
        }
        setIsGenerating(true);
        setGeneratedImageUrl(null);
        toast({ title: '🤖 Starting Image Generation...', description: 'This may take a moment. Please wait.' });

        try {
            // Note: The flow is misnamed, but we are calling it as intended.
            const result = await generateVideoFromImage({
                productId: product.id,
                prompt: prompt
            });
            setGeneratedImageUrl(result.videoUrl); // The flow returns the URL in a 'videoUrl' field
            toast({ title: '✅ Image Generated!', description: 'Your new image has been saved to the product.' });
        } catch (error: any) {
            console.error("Error generating image:", error);
            toast({ variant: 'destructive', title: 'Image Generation Failed', description: error.message || 'Please try again.' });
        } finally {
            setIsGenerating(false);
        }
    };

    if (isLoading) {
        return <SellerLayout><PageSkeleton /></SellerLayout>;
    }

    if (!product) {
        return <SellerLayout><div className="p-8">Product not found.</div></SellerLayout>;
    }

    return (
        <SellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                 <Button variant="outline" asChild>
                    <Link href="/dashboard/seller/ai-tools/image-to-video">
                        <ChevronLeft className="mr-2 h-4 w-4" /> Back to Product Selection
                    </Link>
                </Button>
                <div className="grid md:grid-cols-2 gap-8 items-start">
                    <Card>
                        <CardHeader>
                            <CardTitle>1. Describe Your Image for "{product.name}"</CardTitle>
                            <CardDescription>Tell the AI what kind of image you want to create.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                rows={5}
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g., A lifestyle photo of the product being used on a sunny day."
                            />
                             <Button className="w-full mt-4" onClick={handleGenerateImage} disabled={isGenerating}>
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                Generate Image (100 Points)
                            </Button>
                        </CardContent>
                    </Card>
                    <div className="space-y-4 sticky top-24">
                        <Card>
                            <CardHeader>
                                <CardTitle>2. Generated Result</CardTitle>
                                <CardDescription>Your new image will appear here.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="aspect-square w-full bg-muted rounded-lg flex items-center justify-center">
                                    {isGenerating ? (
                                         <div className="text-center text-muted-foreground">
                                            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                                            <p className="mt-2">Generating...</p>
                                        </div>
                                    ) : generatedImageUrl ? (
                                        <Image src={generatedImageUrl} alt="Generated product image" width={500} height={500} className="rounded-lg object-contain" />
                                    ) : (
                                        <div className="text-center text-muted-foreground">
                                            <ImageIcon className="mx-auto h-12 w-12" />
                                            <p>Your generated image will appear here.</p>
                                        </div>
                                    )}
                                </div>
                                 {generatedImageUrl && (
                                     <Button variant="outline" className="w-full mt-4" asChild>
                                        <Link href={`/dashboard/products?tab=add-new&productId=${product.id}`}>
                                            View in Product Editor
                                        </Link>
                                    </Button>
                                 )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </SellerLayout>
    );
}
