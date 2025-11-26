
'use client';

import React, { useState } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Text, Download } from 'lucide-react';
import { generateVideoFromText } from '@/ai/flows/generate-video-from-text';

export default function TextToVideoPage() {
    const { toast } = useToast();
    const [prompt, setPrompt] = useState('A cinematic shot of a an old car driving down a deserted road at sunset.');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

    const handleGenerateVideo = async () => {
        if (!prompt.trim()) {
            toast({ variant: 'destructive', title: 'Prompt is required', description: 'Please enter a description for your video.' });
            return;
        }

        setIsGenerating(true);
        setGeneratedVideoUrl(null);
        toast({ title: '🤖 Starting Video Generation...', description: 'This is a slow process and may take over a minute. Please wait.' });

        try {
            const result = await generateVideoFromText({ prompt });
            setGeneratedVideoUrl(result.videoDataUri);
            toast({ title: '✅ Video Generated!', description: 'Your new video is ready.' });
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
                                Describe the video you want to create. Be as descriptive as possible for the best results. This tool costs 250 points.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                rows={8}
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g., A majestic dragon soaring over a mystical forest at dawn."
                                disabled={isGenerating}
                            />
                            <Button className="w-full" onClick={handleGenerateVideo} disabled={isGenerating}>
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                Generate Video
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
                                <Button asChild variant="outline" className="w-full mt-4">
                                   <a href={generatedVideoUrl} download="generated-video.mp4">
                                     <Download className="mr-2 h-4 w-4" />
                                     Download Video
                                   </a>
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </SellerLayout>
    );
}
