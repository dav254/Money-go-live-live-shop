'use client';

import React, { useState } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Video, Download, UploadCloud, Radio, Type, ShieldCheck, RefreshCw, Volume2, Music } from 'lucide-react';
import { generateVideoFromText } from '@/ai/flows/generate-video-from-text';
import { publishVideoToProduct } from '@/ai/flows/publish-video';
import { useUser } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export default function AdminVideoGeneratorPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const [prompt, setPrompt] = useState('A cinematic, vibrant high-speed showcase of professional luxury watches on a rotating stand with neon reflections and deep immersive synth-bass audio.');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

    const handleGenerateVideo = async () => {
        if (!prompt.trim()) {
            toast({ variant: 'destructive', title: 'Prompt is required' });
            return;
        }

        setIsGenerating(true);
        setGeneratedVideoUrl(null);
        toast({ 
            title: '🤖 Initializing Neural Studio...', 
            description: 'Synthesizing visuals and synchronized audio. This high-density process takes up to 2 minutes.' 
        });

        try {
            const result = await generateVideoFromText({ prompt });
            setGeneratedVideoUrl(result.videoUrl);
            toast({ 
                title: '✅ Signal Locked!', 
                description: '4K Cinematic Video with Audio is ready for preview.' 
            });
        } catch (error: any) {
            console.error("AI Error:", error);
            toast({ 
                variant: 'destructive', 
                title: 'Generation Failed', 
                description: error.message || 'The AI cluster is under heavy load. Please try again.' 
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!generatedVideoUrl) return;
        const link = document.createElement('a');
        link.href = generatedVideoUrl;
        link.download = `goearnvid-pro-ai-${Date.now()}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: 'Exporting...', description: 'High-fidelity MP4 is saving to your local node.' });
    };

    const handleGlobalPublish = async () => {
        if (!generatedVideoUrl || !user) return;
        
        setIsPublishing(true);
        toast({ title: 'Broadcasting...', description: 'Deploying signal to the Global Discovery Feed.' });

        try {
            // Admin Global Showcase ID
            await publishVideoToProduct({
                productId: 'admin_global_showcase', 
                videoUrl: generatedVideoUrl
            });
            
            toast({ 
                title: 'PUBLISHED!', 
                description: 'The AI content is now live for all users in the immersive feed.' 
            });
            setGeneratedVideoUrl(null);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Broadcast Failed', description: error.message });
        } finally {
            setIsPublishing(false);
        }
    }

    return (
        <AdminLayout>
            <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="font-headline text-4xl font-black uppercase tracking-tighter flex items-center gap-4 text-foreground leading-none">
                            <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20">
                                <Video className="text-primary h-8 w-8" /> 
                            </div>
                            NEURAL STUDIO PRO
                        </h1>
                        <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] mt-2 ml-1 flex items-center gap-2">
                            <Music className="h-3 w-3 text-green-500" />
                            Audio-Visual Synthesis Enabled • 8s Maximum Signal Length
                        </p>
                    </div>
                    <Badge variant="outline" className="h-10 px-6 rounded-xl border-primary/20 bg-primary/5 text-primary font-black uppercase tracking-widest text-[10px]">
                        ADMIN OVERRIDE ACTIVE
                    </Badge>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                    {/* Input Panel */}
                    <Card className="lg:col-span-2 shadow-2xl border-white/5 bg-neutral-900/50 backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
                        <CardHeader className="p-8 bg-white/5">
                            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                <Type className="h-4 w-4" /> 1. NEURAL PROMPT
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                             <div className="space-y-2">
                                <Textarea
                                    rows={10}
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    className="bg-black/40 border-white/10 rounded-3xl resize-none text-sm leading-relaxed p-6 focus-visible:ring-primary transition-all"
                                    placeholder="Describe the cinematic visual and the specific soundscape/audio you want..."
                                    disabled={isGenerating}
                                />
                            </div>
                            <Button 
                                size="lg"
                                className="w-full h-16 rounded-[1.5rem] font-black text-sm uppercase tracking-widest bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 group transition-all" 
                                onClick={handleGenerateVideo} 
                                disabled={isGenerating}
                            >
                                {isGenerating ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : <Sparkles className="mr-3 h-6 w-6 group-hover:scale-110 transition-transform" />}
                                GENERATE MASTER CLIP
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Preview Panel */}
                    <Card className="lg:col-span-3 shadow-2xl border-white/5 bg-neutral-900/50 backdrop-blur-xl min-h-[500px] flex flex-col rounded-[2.5rem] overflow-hidden">
                        <CardHeader className="p-8 bg-white/5 border-b border-white/5">
                            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Radio className="h-4 w-4 text-red-500" /> 2. OUTPUT SIGNAL
                                </span>
                                {generatedVideoUrl && <Volume2 className="h-4 w-4 text-primary animate-pulse" />}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col justify-center p-8 gap-8">
                            <div className="relative aspect-video w-full bg-black rounded-[2rem] overflow-hidden border border-white/10 group shadow-2xl">
                                {isGenerating ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-black/95">
                                        <div className="relative mb-8">
                                            <div className="absolute inset-[-20px] bg-primary/20 rounded-full animate-pulse blur-xl" />
                                            <Loader2 className="h-14 w-14 animate-spin text-primary relative z-10" />
                                        </div>
                                        <h3 className="text-white text-xl font-black uppercase tracking-tighter">Synthesizing Signal...</h3>
                                        <p className="text-white/30 text-[9px] mt-3 max-w-[280px] uppercase font-bold tracking-[0.3em] leading-relaxed">
                                            Calculating temporal vectors and audio frequencies
                                        </p>
                                    </div>
                                ) : generatedVideoUrl ? (
                                    <video 
                                        src={generatedVideoUrl} 
                                        controls 
                                        autoPlay 
                                        loop 
                                        className="w-full h-full object-contain" 
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30 text-center p-12">
                                        <div className="p-6 rounded-full bg-white/5 border border-white/5 mb-6">
                                            <Video className="h-16 w-16 opacity-10" />
                                        </div>
                                        <p className="font-black uppercase tracking-[0.3em] text-[10px]">Awaiting AI Signal Stream</p>
                                    </div>
                                )}
                            </div>
                            
                            {generatedVideoUrl && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                     <div className="grid grid-cols-2 gap-4">
                                        <Button 
                                            size="lg"
                                            variant="secondary"
                                            className="h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-neutral-800 hover:bg-neutral-700 text-white" 
                                            onClick={handleDownload}
                                        >
                                            <Download className="mr-2 h-4 w-4" /> DOWNLOAD MP4
                                        </Button>
                                        <Button 
                                            size="lg"
                                            variant="outline"
                                            className="h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest border-white/10 hover:bg-white/5" 
                                            onClick={handleGenerateVideo} 
                                            disabled={isGenerating}
                                        >
                                            <RefreshCw className="mr-2 h-4 w-4" /> RE-GENERATE
                                        </Button>
                                     </div>

                                     <Button 
                                        size="lg"
                                        className="w-full h-20 rounded-[2rem] font-black text-xl bg-green-600 hover:bg-green-700 text-white shadow-2xl shadow-green-600/30 border-none transition-all active:scale-95" 
                                        onClick={handleGlobalPublish} 
                                        disabled={isPublishing}
                                    >
                                        {isPublishing ? <Loader2 className="mr-3 h-8 w-8 animate-spin" /> : <UploadCloud className="mr-3 h-8 w-8" />}
                                        PUBLISH TO GLOBAL FEED
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="bg-white/5 p-6 border-t border-white/5 flex items-center justify-center gap-3">
                            <ShieldCheck className="h-4 w-4 text-green-500" />
                            <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">
                                High-Density Audio Signal Active • Secure AI Protocol
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </AdminLayout>
    );
}
