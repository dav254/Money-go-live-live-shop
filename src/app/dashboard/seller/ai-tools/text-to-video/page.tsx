
'use client';

import React, { useState, useMemo } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Text, Download, ChevronLeft } from 'lucide-react';
import { generateVideoFromText } from '@/ai/flows/generate-video-from-text';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import Link from 'next/link';

export default function TextToVideoPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const [prompt, setPrompt] = useState('A cinematic shot of a an old car driving down a deserted road at sunset.');
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

    const productsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
    }, [firestore, user]);

    const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

    const handleGenerateVideo = async () => {
        if (!prompt.trim()) {
            toast({ variant: 'destructive', title: 'Prompt is required', description: 'Please enter a description for your video.' });
            return;
        }
        if (!selectedProductId) {
            toast({ variant: 'destructive', title: 'Product selection required', description: 'Please select which product this video is for.' });
            return;
        }

        setIsGenerating(true);
        setGeneratedVideoUrl(null);
        toast({ title: '🤖 Starting Video Generation...', description: 'This is a slow process and may take over a minute. Please wait.' });

        try {
            const result = await generateVideoFromText({ 
                prompt,
                productId: selectedProductId,
             });
            setGeneratedVideoUrl(result.videoUrl);
            toast({ title: '✅ Video Generated & Saved!', description: 'Your new video has been added to the selected product.' });
        } catch (error: any) {
            console.error("Error generating video:", error);
            toast({ variant: 'destructive', title: 'Video Generation Failed', description: error.message || 'Please try again.' });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <SellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="grid md:grid-cols-2 gap-8 items-start">
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline text-2xl flex items-center gap-2">
                                <Text className="text-primary" /> Text-to-Video Generator
                            </CardTitle>
                            <CardDescription>
                                Describe a video, assign it to a product, and let our AI create it for you. This tool costs 250 points.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">1. Select Product</label>
                                <Select onValueChange={setSelectedProductId} disabled={areProductsLoading}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={areProductsLoading ? "Loading products..." : "Assign video to a product..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {products?.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <label className="text-sm font-medium">2. Describe Your Video</label>
                                <Textarea
                                    rows={8}
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="e.g., A majestic dragon soaring over a mystical forest at dawn."
                                    disabled={isGenerating}
                                />
                            </div>
                            <Button className="w-full" onClick={handleGenerateVideo} disabled={isGenerating || !selectedProductId}>
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                Generate & Save Video
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="sticky top-24">
                        <CardHeader>
                            <CardTitle>Result</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="aspect-video w-full bg-muted rounded-lg flex items-center justify-center">
                                {isGenerating ? (
                                    <div className="text-center text-muted-foreground">
                                        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                                        <p className="mt-2">Generating... Please wait.</p>
                                    </div>
                                ) : generatedVideoUrl ? (
                                    <video src={generatedVideoUrl} controls autoPlay muted loop className="w-full h-full rounded-md" />
                                ) : (
                                    <p className="text-muted-foreground">Your video will appear here.</p>
                                )}
                            </div>
                             {generatedVideoUrl && (
                                 <Button variant="outline" className="w-full mt-4" asChild>
                                    <Link href={`/dashboard/products?tab=add-new`}>
                                        View in Products
                                    </Link>
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </SellerLayout>
    );
}
