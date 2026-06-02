'use client';

import React, { useState } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Text, UploadCloud, Radio, Video } from 'lucide-react';
import { generateVideoFromText } from '@/ai/flows/generate-video-from-text';
import { publishVideoToProduct } from '@/ai/flows/publish-video';
import { useUser, useUserProfile } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function TextToVideoPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const { userProfile } = useUserProfile(user?.uid);
    const [prompt, setPrompt] = useState('A cinematic, vibrant high-speed showcase of professional luxury watches on a rotating stand with neon reflections.');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [generatedVideoUrl, setGeneratedVideoUrl] = setGeneratedVideoUrl(null);

    const handleGenerateVideo = async () => {
        if (!prompt.trim()) {
            toast({ variant: 'destructive', title: 'Prompt is required' });
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
    
    const handleDirectPublish = async () => {
        if (!generatedVideoUrl || !user) return;
        
        setIsPublishing(true);
        toast({ title: 'Publishing to Live Feed...', description: 'Your video is being transcoded for global discovery.' });

        try {
            // DIRECT PUBLISH: No product ID means it goes straight to the global live feed as a generic showcase
            await publishVideoToProduct({
                productId: 'global_showcase', 
                videoUrl: generatedVideoUrl
            });
            
            toast({ 
                title: 'Successfully Published!', 
                description: 'Your AI video is now appearing in the global Live Stream feed for all buyers.' 
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
                        <h1 className="font-headline text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
                            <Text className="text-primary h-8 w-8" /> 
                            AI Showcase Generator
                        </h1>
                        <p className="text-muted-foreground font-medium">Create and publish cinematic videos directly to the global Live Feed.</p>
                    </div>
                    <Badge variant="outline" className="h-10 px-4 rounded-xl border-primary/20 bg-primary/5 text-primary font-black uppercase">
                        250 Points / GEN
                    </Badge>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                    <Card className="lg:col-span-2 shadow-2xl border-white/5 bg-neutral-900/50 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-lg font-black uppercase tracking-widest text-primary">1. Imagine Your Content</CardTitle>
                            <CardDescription>Describe your product in high detail. Mention lighting, movement, and environment.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             <div className="space-y-2">
                                <Textarea
                                    rows={8}
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    className="bg-black/40 border-white/10 rounded-2xl resize-none text-sm leading-relaxed"
                                    placeholder="Describe your masterpiece..."
                                    disabled={isGenerating}
                                />
                            </div>
                            <Button 
                                size="lg"
                                className="w-full h-14 rounded-2xl font-black text-lg bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20" 
                                onClick={handleGenerateVideo} 
                                disabled={isGenerating}
                            >
                                {isGenerating ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Sparkles className="mr-2 h-6 w-6" />}
                                GENERATE MASTERPIECE
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-3 shadow-2xl border-white/5 bg-neutral-900/50 backdrop-blur-xl min-h-[400px] flex flex-col">
                        <CardHeader>
                            <CardTitle className="text-lg font-black uppercase tracking-widest">2. Preview & Global Publish</CardTitle>
                             <CardDescription>
                                Once generated, publish your video to the main feed to reach potential buyers instantly.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col justify-center gap-6">
                            <div className="relative aspect-video w-full bg-black rounded-3xl overflow-hidden border border-white/10 group shadow-2xl">
                                {isGenerating ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-black/80">
                                        <div className="relative mb-6">
                                            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                                            <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
                                        </div>
                                        <p className="text-white font-black uppercase tracking-tighter">AI Dreaming in 4K...</p>
                                        <p className="text-white/40 text-[10px] mt-2 max-w-[250px] uppercase font-bold tracking-widest">Building cinematics, lighting shaders, and motion vectors</p>
                                    </div>
                                ) : generatedVideoUrl ? (
                                    <video src={generatedVideoUrl} controls autoPlay muted loop className="w-full h-full object-contain" />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30 text-center p-12">
                                        <Video className="h-16 w-16 mb-4 opacity-10" />
                                        <p className="font-black uppercase tracking-widest text-[10px]">Your generation will appear here</p>
                                    </div>
                                )}
                            </div>
                            
                            {generatedVideoUrl && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                     <Alert className="bg-green-500/10 border-green-500/30 text-green-400">
                                        <Radio className="h-4 w-4 animate-pulse" />
                                        <AlertTitle className="font-black uppercase text-[10px] tracking-widest">Global Discovery Ready</AlertTitle>
                                        <AlertDescription className="text-xs font-medium">Publishing now will place this video in the main discover feed for all Go Earn users.</AlertDescription>
                                    </Alert>
                                     <Button 
                                        size="lg"
                                        className="w-full h-16 rounded-2xl font-black text-xl bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-600/30" 
                                        onClick={handleDirectPublish} 
                                        disabled={isPublishing}
                                    >
                                        {isPublishing ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <UploadCloud className="mr-2 h-6 w-6" />}
                                        PUBLISH TO LIVE FEED
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="bg-black/20 p-4 border-t border-white/5">
                            <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest text-center w-full">
                                Published videos are subject to AI content moderation guidelines.
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </SellerLayout>
    );
}
