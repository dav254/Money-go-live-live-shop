'use client';

import React, { useState } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUser, useUserProfile } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Image as ImageIcon, Download, Copy, RefreshCw, BadgeCent } from 'lucide-react';
import Image from 'next/image';
import { generateVideoFromImage } from '@/ai/flows/generate-video-from-image';
import { Badge } from '@/components/ui/badge';

export default function StandaloneImageGeneratorPage() {
    const { user } = useUser();
    const { userProfile } = useUserProfile(user?.uid);
    const { toast } = useToast();
    
    const [prompt, setPrompt] = useState('A professional high-fidelity product shot of a luxury watch on a dark marble surface with dramatic cinematic lighting.');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast({ variant: 'destructive', title: 'Description Required', description: 'Please tell the AI what you want to see.' });
            return;
        }

        if ((userProfile?.aiPoints || 0) < 100) {
            toast({ variant: 'destructive', title: 'Insufficient Points', description: 'You need 100 AI Points to generate an image.' });
            return;
        }

        setIsGenerating(true);
        setGeneratedImageUrl(null);
        toast({ title: '🤖 Initializing Imagen 4...', description: 'Crafting your visual masterpiece. Please wait.' });

        try {
            const result = await generateVideoFromImage({
                prompt,
                productId: 'standalone'
            });
            setGeneratedImageUrl(result.videoUrl);
            toast({ title: '✅ Generation Successful!', description: 'Your promotional image is ready.' });
        } catch (error: any) {
            console.error("AI Error:", error);
            toast({ variant: 'destructive', title: 'Generation Failed', description: error.message || 'The AI model is busy. Please try again.' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!generatedImageUrl) return;
        
        const link = document.createElement('a');
        link.href = generatedImageUrl;
        link.download = `vidnov-ai-promo-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({ title: 'Download Started', description: 'Your image is saving to your device.' });
    };

    return (
        <SellerLayout>
            <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="font-headline text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
                            <ImageIcon className="text-primary h-8 w-8" /> 
                            AI Image Architect
                        </h1>
                        <p className="text-muted-foreground font-medium">Create high-converting promotional photos from simple descriptions.</p>
                    </div>
                    <Badge variant="outline" className="h-10 px-4 rounded-xl border-primary/20 bg-primary/5 text-primary font-black uppercase flex items-center gap-2">
                        <BadgeCent className="h-4 w-4" /> 100 Points / GEN
                    </Badge>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                    {/* Control Panel */}
                    <Card className="lg:col-span-2 shadow-2xl border-white/5 bg-neutral-900/50 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-lg font-black uppercase tracking-widest text-primary">1. Image Blueprint</CardTitle>
                            <CardDescription>Detail exactly what you want the AI to create. Mention textures, colors, and mood.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Textarea
                                    rows={8}
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    className="bg-black/40 border-white/10 rounded-2xl resize-none text-sm leading-relaxed"
                                    placeholder="Describe your promotional photo..."
                                    disabled={isGenerating}
                                />
                            </div>
                            <Button 
                                size="lg"
                                className="w-full h-14 rounded-2xl font-black text-lg bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20" 
                                onClick={handleGenerate} 
                                disabled={isGenerating}
                            >
                                {isGenerating ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Sparkles className="mr-2 h-6 w-6" />}
                                GENERATE PHOTO
                            </Button>
                        </CardContent>
                        <CardFooter className="bg-black/20 p-4 border-t border-white/5 text-center">
                             <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest w-full">
                                Your balance: {(userProfile?.aiPoints || 0).toLocaleString()} points
                            </p>
                        </CardFooter>
                    </Card>

                    {/* Result Panel */}
                    <Card className="lg:col-span-3 shadow-2xl border-white/5 bg-neutral-900/50 backdrop-blur-xl min-h-[480px] flex flex-col">
                        <CardHeader>
                            <CardTitle className="text-lg font-black uppercase tracking-widest">2. Preview & Export</CardTitle>
                             <CardDescription>
                                Review your generated image and download it for your shop or social media.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col justify-center gap-6">
                            <div className="relative aspect-square w-full bg-black rounded-3xl overflow-hidden border border-white/10 group shadow-2xl">
                                {isGenerating ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-black/80">
                                        <div className="relative mb-6">
                                            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                                            <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
                                        </div>
                                        <p className="text-white font-black uppercase tracking-tighter">AI Rendering Textures...</p>
                                        <p className="text-white/40 text-[10px] mt-2 max-w-[250px] uppercase font-bold tracking-widest">Applying lighting, materials, and depth of field</p>
                                    </div>
                                ) : generatedImageUrl ? (
                                    <Image src={generatedImageUrl} alt="AI Result" fill className="object-contain" unoptimized />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30 text-center p-12">
                                        <ImageIcon className="h-16 w-16 mb-4 opacity-10" />
                                        <p className="font-black uppercase tracking-widest text-[10px]">Your generation will appear here</p>
                                    </div>
                                )}
                            </div>
                            
                            {generatedImageUrl && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                     <Button 
                                        size="lg"
                                        variant="secondary"
                                        className="h-16 rounded-2xl font-black text-sm uppercase tracking-widest" 
                                        onClick={handleGenerate} 
                                        disabled={isGenerating}
                                    >
                                        <RefreshCw className="mr-2 h-5 w-5" /> RE-GENERATE
                                    </Button>
                                    <Button 
                                        size="lg"
                                        className="h-16 rounded-2xl font-black text-sm uppercase tracking-widest bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-600/30" 
                                        onClick={handleDownload}
                                    >
                                        <Download className="mr-2 h-5 w-5" /> DOWNLOAD PNG
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </SellerLayout>
    );
}
