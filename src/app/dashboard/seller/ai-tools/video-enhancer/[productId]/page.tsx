'use client';

import React, { useState, useMemo } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { generateEnhancedVideo } from '@/ai/flows/generate-enhanced-video';
import { publishVideoToProduct } from '@/ai/flows/publish-video';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, ChevronLeft, Film, UploadCloud, Download, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

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
    const productId = (params?.productId as string) || '';
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();

    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('Animate this image with subtle motion. Make the background gently drift.');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

    const productRef = useMemoFirebase(() => {
        if (!productId) return null;
        return doc(firestore, 'products', productId);
    }, [firestore, productId]);

    const { data: product, isLoading } = useDoc<Product>(productRef);

    const productImages = useMemo(() => {
        if (!product) return [];
        const images = [...(product.imageUrls || [])];
        if (product.imageUrl && !images.includes(product.imageUrl)) {
            images.unshift(product.imageUrl);
        }
        return images;
    }, [product]);

    const handleGenerateVideo = async () => {
        if (!product || !selectedImage || !prompt) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select an image and enter a prompt.' });
            return;
        }
        setIsGenerating(true);
        setGeneratedVideoUrl(null);
        toast({ title: '🤖 Starting Video Generation...', description: 'This is a slow process and may take over a minute. Please wait.' });

        try {
            const result = await generateEnhancedVideo({
                imageDataUri: selectedImage,
                prompt: prompt
            });
            setGeneratedVideoUrl(result.videoUrl);
            toast({ title: '✅ Video Generated!', description: 'Your new animated video is ready for preview.' });
        } catch (error: any) {
            console.error("Error generating video:", error);
            toast({ variant: 'destructive', title: 'Video Generation Failed', description: error.message || 'Please try again.' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!generatedVideoUrl) return;
        const link = document.createElement('a');
        link.href = generatedVideoUrl;
        link.download = `vidnov-enhanced-${product?.name || 'video'}-${Date.now()}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: 'Download Started' });
    };
    
    const handlePublishVideo = async () => {
        if (!generatedVideoUrl || !productId) {
             toast({ variant: 'destructive', title: 'Missing Information', description: 'No video to publish.' });
            return;
        }
        
        setIsPublishing(true);
        toast({ title: 'Publishing Video...', description: 'Adding the video to your product.' });

        try {
            await publishVideoToProduct({
                productId: productId,
                videoUrl: generatedVideoUrl
            });
            toast({ title: 'Published!', description: 'Your video is now live on your product page.' });
        } catch (error: any) {
             console.error("Error publishing video:", error);
            toast({ variant: 'destructive', title: 'Publish Failed', description: error.message || 'Please try again.' });
        } finally {
            setIsPublishing(false);
        }
    }

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
                            <CardTitle>Enhance Video for "{product.name}"</CardTitle>
                            <CardDescription>Select an image, describe how you want to animate it, and let the AI create a short video.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>1. Select an Image to Animate</Label>
                                <div className="grid grid-cols-4 gap-2 mt-2">
                                    {productImages.map((url, i) => (
                                        <button key={i} className={cn("relative aspect-square rounded-md overflow-hidden border-2", selectedImage === url ? "border-primary" : "border-transparent")} onClick={() => setSelectedImage(url)}>
                                            <Image src={url} alt={`Product image ${i+1}`} fill className="object-cover" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <Label>2. Describe the Animation</Label>
                                <Textarea
                                    rows={3}
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="e.g., A gentle zoom in, with sparkles appearing."
                                />
                            </div>
                             <Button className="w-full" onClick={handleGenerateVideo} disabled={isGenerating || !selectedImage}>
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                Generate Video (250 Points)
                            </Button>
                        </CardContent>
                    </Card>
                    <div className="space-y-4 sticky top-24">
                        <Card>
                            <CardHeader>
                                <CardTitle>3. Generated Result</CardTitle>
                                <CardDescription>Your new video will appear here.</CardDescription>
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
                                        <div className="text-center text-muted-foreground">
                                            <Film className="mx-auto h-12 w-12" />
                                            <p>Your generated video will appear here.</p>
                                        </div>
                                    )}
                                </div>
                                 {generatedVideoUrl && (
                                     <div className="space-y-3 mt-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <Button variant="secondary" onClick={handleDownload}>
                                                <Download className="mr-2 h-4 w-4" /> Download MP4
                                            </Button>
                                            <Button variant="outline" onClick={handleGenerateVideo}>
                                                <RefreshCw className="mr-2 h-4 w-4" /> Retake
                                            </Button>
                                        </div>
                                        <Button className="w-full" onClick={handlePublishVideo} disabled={isPublishing}>
                                            {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                                            Publish to Product
                                        </Button>
                                     </div>
                                 )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </SellerLayout>
    );
}
