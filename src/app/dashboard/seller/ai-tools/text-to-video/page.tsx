'use client';

import React, { useState, useMemo } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Type, UploadCloud, Radio, Video, Download, RefreshCw, Box, BrainCircuit } from 'lucide-react';
import { generateVideoFromText } from '@/ai/flows/generate-video-from-text';
import { generateVideoScript } from '@/ai/flows/generate-video-script';
import { publishVideoToProduct } from '@/ai/flows/publish-video';
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Product } from '@/lib/types';
import { Label } from '@/components/ui/label';

export default function TextToVideoPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const { userProfile } = useUserProfile(user?.uid);
    const firestore = useFirestore();

    const [prompt, setPrompt] = useState('A cinematic, vibrant high-speed showcase of professional luxury products on a rotating stand with neon reflections.');
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isScripting, setIsScripting] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

    const productsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
    }, [firestore, user]);

    const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

    const handleGenerateScript = async () => {
        if (!selectedProductId) {
            toast({ variant: 'destructive', title: 'Please select a product' });
            return;
        }

        const product = products?.find(p => p.id === selectedProductId);
        if (!product) return;

        setIsScripting(true);
        try {
            const { script } = await generateVideoScript({
                contextType: 'product',
                data: {
                    name: product.name,
                    description: product.description,
                    category: product.category,
                    price: product.price
                }
            });
            setPrompt(script);
            toast({ title: 'Ad Script Created!', description: 'Neural engine has optimized the script for this product.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'AI Error', description: 'Could not generate script.' });
        } finally {
            setIsScripting(false);
        }
    };

    const handleGenerateVideo = async () => {
        if (!prompt.trim()) {
            toast({ variant: 'destructive', title: 'Prompt is required' });
            return;
        }

        if ((userProfile?.aiPoints || 0) < 250) {
            toast({ variant: 'destructive', title: 'Insufficient Points', description: 'You need 250 AI points for video generation.' });
            return;
        }

        setIsGenerating(true);
        setGeneratedVideoUrl(null);
        toast({ title: '🤖 Initializing Veo AI...', description: 'Generating slow-motion 4K video. This can take up to 2 minutes.' });

        try {
            const result = await generateVideoFromText({ prompt });
            setGeneratedVideoUrl(result.videoUrl);
            toast({ title: '✅ Video Generated!', description: 'Preview your AI creation below.' });
        } catch (error: any) {
            console.error("Error generating video:", error);
            toast({ variant: 'destructive', title: 'Generation Failed', description: error.message || 'The AI model is busy. Please try again in a moment.' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!generatedVideoUrl) return;
        const link = document.createElement('a');
        link.href = generatedVideoUrl;
        link.download = `goearnvid-ai-showcase-${Date.now()}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: 'Download Started', description: 'Your video is saving to your device.' });
    };
    
    const handleDirectPublish = async () => {
        if (!generatedVideoUrl || !user || !selectedProductId) {
             toast({ variant: 'destructive', title: 'Setup Required', description: 'Please select a product and generate a video first.' });
             return;
        }
        
        setIsPublishing(true);
        toast({ title: 'Publishing to Product...', description: 'Attaching AI video to your inventory.' });

        try {
            await publishVideoToProduct({
                productId: selectedProductId, 
                videoUrl: generatedVideoUrl
            });
            
            toast({ 
                title: 'Successfully Published!', 
                description: 'Your AI video is now live in the discovery feed and on your product page.' 
            });
            setGeneratedVideoUrl(null);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Publish Failed', description: error.message });
        } finally {
            setIsPublishing(false);
        }
    }

    return (
        <SellerLayout>
            <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="font-headline text-3xl font-black uppercase tracking-tighter flex items-center gap-3 text-white">
                            <Type className="text-primary h-8 w-8" /> 
                            AI Showcase Generator
                        </h1>
                        <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Create cinematic ads from product context or scripts.</p>
                    </div>
                    <Badge variant="outline" className="h-10 px-4 rounded-xl border-primary/20 bg-primary/5 text-primary font-black uppercase">
                        250 Points / GEN
                    </Badge>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                    <Card className="lg:col-span-2 shadow-2xl border-white/5 bg-neutral-900/50 backdrop-blur-xl rounded-[2rem] overflow-hidden">
                        <CardHeader className="bg-white/5">
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <Box className="h-4 w-4" /> 1. Select & Script
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                             <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Pick a Product to Advertise</Label>
                                <div className="flex gap-2">
                                    <Select value={selectedProductId || ''} onValueChange={setSelectedProductId}>
                                        <SelectTrigger className="bg-black/40 border-white/10 h-12 rounded-xl">
                                            <SelectValue placeholder={areProductsLoading ? "Loading..." : "Choose product..."} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {products?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Button 
                                        variant="secondary" 
                                        size="icon" 
                                        className="h-12 w-12 rounded-xl"
                                        onClick={handleGenerateScript}
                                        disabled={!selectedProductId || isScripting}
                                    >
                                        {isScripting ? <Loader2 className="animate-spin" /> : <BrainCircuit className="h-5 w-5 text-primary" />}
                                    </Button>
                                </div>
                                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight">Click the brain icon to auto-write a script for this product.</p>
                            </div>

                             <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Video Prompt / Script</Label>
                                <Textarea
                                    rows={8}
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    className="bg-black/40 border-white/10 rounded-2xl resize-none text-sm leading-relaxed p-4 focus-visible:ring-primary"
                                    placeholder="Describe your masterpiece..."
                                    disabled={isGenerating}
                                />
                            </div>
                            <Button 
                                size="lg"
                                className="w-full h-14 rounded-2xl font-black text-sm uppercase tracking-widest bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 group" 
                                onClick={handleGenerateVideo} 
                                disabled={isGenerating}
                            >
                                {isGenerating ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Sparkles className="mr-2 h-6 w-6 group-hover:scale-110 transition-transform" />}
                                GENERATE 8s SCENE
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-3 shadow-2xl border-white/5 bg-neutral-900/50 backdrop-blur-xl min-h-[400px] flex flex-col rounded-[2rem] overflow-hidden">
                        <CardHeader className="bg-white/5 border-b border-white/5">
                            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                <Radio className="h-4 w-4 text-red-500" /> 2. Preview & Deploy
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col justify-center p-8 gap-6">
                            <div className="relative aspect-video w-full bg-black rounded-3xl overflow-hidden border border-white/10 group shadow-2xl">
                                {isGenerating ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-black/80">
                                        <div className="relative mb-6">
                                            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                                            <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
                                        </div>
                                        <p className="text-white font-black uppercase tracking-tighter">AI Dreaming in 4K...</p>
                                        <p className="text-white/40 text-[9px] mt-2 max-w-[250px] uppercase font-bold tracking-widest">Building cinematics, lighting shaders, and soundscape</p>
                                    </div>
                                ) : generatedVideoUrl ? (
                                    <video src={generatedVideoUrl} controls autoPlay muted loop className="w-full h-full object-contain" />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30 text-center p-12">
                                        <div className="p-4 rounded-full bg-white/5 border border-white/10 mb-4">
                                            <Video className="h-12 w-12 opacity-10" />
                                        </div>
                                        <p className="font-black uppercase tracking-widest text-[10px]">Your generation will appear here</p>
                                    </div>
                                )}
                            </div>
                            
                            {generatedVideoUrl && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                     <div className="grid grid-cols-2 gap-4">
                                        <Button 
                                            size="lg"
                                            variant="secondary"
                                            className="h-14 rounded-xl font-black text-[10px] uppercase tracking-widest" 
                                            onClick={handleDownload}
                                        >
                                            <Download className="mr-2 h-4 w-4" /> DOWNLOAD MP4
                                        </Button>
                                        <Button 
                                            size="lg"
                                            variant="outline"
                                            className="h-14 rounded-xl font-black text-[10px] uppercase tracking-widest border-white/10 hover:bg-white/5" 
                                            onClick={handleGenerateVideo} 
                                            disabled={isGenerating}
                                        >
                                            <RefreshCw className="mr-2 h-4 w-4" /> RETAKE
                                        </Button>
                                     </div>

                                     <Button 
                                        size="lg"
                                        className="w-full h-16 rounded-2xl font-black text-lg bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-600/30" 
                                        onClick={handleDirectPublish} 
                                        disabled={isPublishing}
                                    >
                                        {isPublishing ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <UploadCloud className="mr-2 h-6 w-6" />}
                                        PUBLISH TO PRODUCT
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="bg-black/20 p-4 border-t border-white/5">
                            <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest text-center w-full">
                                Optimized for TikTok & Instagram discovery feeds.
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </SellerLayout>
    );
}
