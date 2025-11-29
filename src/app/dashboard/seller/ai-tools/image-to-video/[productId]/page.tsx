
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
import { Loader2, Sparkles, ChevronLeft } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
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

export default function GenerateVideoPage() {
    const params = useParams();
    const productId = params.productId as string;
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();

    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('A dynamic, short promotional video of the product, with smooth camera pans and zooms, in a studio setting.');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

    const productRef = useMemoFirebase(() => {
        if (!productId) return null;
        return doc(firestore, 'products', productId);
    }, [firestore, productId]);

    const { data: product, isLoading } = useDoc<Product>(productRef);

    const handleGenerateVideo = async () => {
        if (!product || !selectedImage) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select an image and enter a prompt.' });
            return;
        }
        setIsGenerating(true);
        setGeneratedVideoUrl(null);
        toast({ title: '🤖 Starting Video Generation...', description: 'This may take up to a minute. Please wait.' });

        try {
            const result = await generateVideoFromImage({
                productId: product.id,
                imageDataUri: selectedImage,
                prompt: prompt
            });
            setGeneratedVideoUrl(result.videoUrl);
            toast({ title: '✅ Video Generated!', description: 'Your new video has been saved to the product.' });
        } catch (error: any) {
            console.error("Error generating video:", error);
            toast({ variant: 'destructive', title: 'Video Generation Failed', description: error.message || 'Please try again.' });
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
                            <CardTitle>1. Select an Image for "{product.name}"</CardTitle>
                            <CardDescription>Choose the base image to animate.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <RadioGroup onValueChange={setSelectedImage} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {product.imageUrls?.map((url, index) => (
                                    <Label key={index} htmlFor={`img-${index}`} className="block relative aspect-square rounded-md overflow-hidden cursor-pointer has-[:checked]:ring-2 has-[:checked]:ring-primary">
                                        <Image src={url} alt={`Product image ${index + 1}`} fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover" />
                                        <RadioGroupItem value={url} id={`img-${index}`} className="absolute top-2 right-2" />
                                    </Label>
                                ))}
                            </RadioGroup>
                            {(!product.imageUrls || product.imageUrls.length === 0) && <p className="text-muted-foreground text-center py-8">This product has no images.</p>}
                        </CardContent>
                    </Card>
                    <div className="space-y-4 sticky top-24">
                        <Card>
                            <CardHeader>
                                <CardTitle>2. Describe Your Video</CardTitle>
                                <CardDescription>Tell the AI how to animate the image.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Textarea
                                    rows={5}
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="e.g., A slow zoom out revealing the product on a wooden table."
                                />
                            </CardContent>
                        </Card>
                        <Button className="w-full" onClick={handleGenerateVideo} disabled={!selectedImage || isGenerating}>
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Generate Video
                        </Button>

                         {generatedVideoUrl && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Result</CardTitle>
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
