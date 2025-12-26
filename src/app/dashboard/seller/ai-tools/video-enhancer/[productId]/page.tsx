
'use client';

import React, { useState, useMemo } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, ChevronLeft, Film } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { enhanceVideo } from '@/ai/flows/enhance-video';

const PageSkeleton = () => (
    <div className="flex-1 space-y-4 p-8 pt-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-2 gap-8">
            <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
        </div>
    </div>
);

export default function EnhanceVideoPage() {
    const params = useParams();
    const productId = params.productId as string;
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();

    const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('Add upbeat, energetic background music and a "Limited Time Offer!" text overlay in the corner.');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

    const productRef = useMemoFirebase(() => {
        if (!productId) return null;
        return doc(firestore, 'products', productId);
    }, [firestore, productId]);

    const { data: product, isLoading } = useDoc<Product>(productRef);

    const handleGenerateVideo = async () => {
        if (!product || !selectedVideo) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a video and enter an editing prompt.' });
            return;
        }
        setIsGenerating(true);
        setGeneratedVideoUrl(null);
        toast({ title: '🤖 Starting Video Enhancement...', description: 'This may take over a minute. Please wait.' });

        try {
            // Fetch the video from its URL to get a data URI
            const videoResponse = await fetch(selectedVideo);
            const videoBlob = await videoResponse.blob();
            const videoDataUri = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(videoBlob);
            });
            
            const result = await enhanceVideo({
                productId: product.id,
                videoDataUri: videoDataUri,
                prompt: prompt,
            });

            setGeneratedVideoUrl(result.videoUrl);
            toast({ title: '✅ Video Enhanced!', description: 'Your new video has been added to the product gallery.' });

        } catch (error: any) {
             console.error("Error enhancing video:", error);
            toast({ variant: 'destructive', title: 'Enhancement Failed', description: error.message || 'Please try again.' });
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
                    <Link href="/dashboard/seller/ai-tools/video-enhancer">
                        <ChevronLeft className="mr-2 h-4 w-4" /> Back to Product Selection
                    </Link>
                </Button>
                <div className="grid md:grid-cols-2 gap-8 items-start">
                    <Card>
                        <CardHeader>
                            <CardTitle>1. Select a Video from "{product.name}"</CardTitle>
                            <CardDescription>Choose the video you want to edit or enhance.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <RadioGroup onValueChange={setSelectedVideo} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {product.videoUrls?.map((url, index) => (
                                    <Label key={index} htmlFor={`vid-${index}`} className="block relative aspect-square rounded-md overflow-hidden cursor-pointer has-[:checked]:ring-2 has-[:checked]:ring-primary">
                                        <video src={url} className="w-full h-full object-cover" muted />
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                            <Film className="h-6 w-6 text-white/70" />
                                        </div>
                                        <RadioGroupItem value={url} id={`vid-${index}`} className="absolute top-2 right-2" />
                                    </Label>
                                ))}
                            </RadioGroup>
                            {(!product.videoUrls || product.videoUrls.length === 0) && <p className="text-muted-foreground text-center py-8">This product has no videos.</p>}
                        </CardContent>
                    </Card>
                    <div className="space-y-4 sticky top-24">
                        <Card>
                            <CardHeader>
                                <CardTitle>2. Describe Your Edits</CardTitle>
                                <CardDescription>Tell the AI what changes to make.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Textarea
                                    rows={5}
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="e.g., Add upbeat background music and a '50% OFF' text overlay."
                                />
                            </CardContent>
                        </Card>
                        <Button className="w-full" onClick={handleGenerateVideo} disabled={!selectedVideo || isGenerating}>
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Enhance Video (250 Points)
                        </Button>

                         {isGenerating && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Result</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="aspect-video w-full bg-muted rounded-lg flex items-center justify-center">
                                         <div className="text-center text-muted-foreground">
                                            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                                            <p className="mt-2">Enhancing... Please wait.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                         )}

                         {generatedVideoUrl && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Enhanced Video</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <video src={generatedVideoUrl} controls autoPlay muted loop className="w-full rounded-md" />
                                    <Button variant="outline" className="w-full mt-4" asChild>
                                        <Link href={`/dashboard/products?tab=add-new`}>
                                            View in Products
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </SellerLayout>
    );
}
