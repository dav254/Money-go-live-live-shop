
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { analyzeLiveComment, LiveCommentOutput } from '@/ai/flows/live-selling-copilot';
import { AlertCircle, Bot, BrainCircuit, Loader2, Send, Sparkles, ThumbsDown, ThumbsUp, Ticket } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface ChatMessage {
    id: number;
    user: string;
    text: string;
}

interface CopilotSuggestion extends LiveCommentOutput {
    id: number;
    originalComment: string;
}

const classificationIcons: { [key: string]: React.ElementType } = {
    "Buying Signal": Sparkles,
    "Price Objection": Ticket,
    "Question": BrainCircuit,
    "Positive Feedback": ThumbsUp,
    "Negative Feedback": ThumbsDown,
    "Spam/Irrelevant": AlertCircle,
};

export default function LiveCopilotPage() {
    const [publicChat, setPublicChat] = useState<ChatMessage[]>([]);
    const [copilotSuggestions, setCopilotSuggestions] = useState<CopilotSuggestion[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const publicChatAreaRef = useRef<HTMLDivElement>(null);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const userMessage: ChatMessage = {
            id: Date.now(),
            user: 'TestBuyer',
            text: newMessage,
        };

        setPublicChat(prev => [...prev, userMessage]);
        setIsAnalyzing(true);
        setNewMessage('');
        
        try {
            const analysis = await analyzeLiveComment({ comment: newMessage });
            const suggestion: CopilotSuggestion = {
                id: Date.now(),
                originalComment: newMessage,
                ...analysis,
            };
            setCopilotSuggestions(prev => [suggestion, ...prev]);
        } catch (error) {
            console.error("AI analysis failed:", error);
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    useEffect(() => {
        if(publicChatAreaRef.current) {
            publicChatAreaRef.current.scrollTop = publicChatAreaRef.current.scrollHeight;
        }
    }, [publicChat]);


    return (
        <SellerLayout>
            <div className="flex-1 space-y-4 p-4 lg:p-8 pt-6">
                 <Card>
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl flex items-center gap-2">
                           <Bot className="text-primary" /> AI Live Selling Co-Pilot
                        </CardTitle>
                        <CardDescription>
                           This is a simulation of your live selling environment. Type comments in the 'Public Chat' as if you were a buyer, and watch the AI Co-Pilot give you real-time suggestions in the 'Co-Pilot Panel'.
                        </CardDescription>
                    </CardHeader>
                </Card>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    {/* Live View and Public Chat */}
                    <div className="lg:col-span-2 space-y-4">
                        <Card>
                             <CardHeader>
                                <CardTitle>Live Preview</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="aspect-video w-full bg-black rounded-lg flex items-center justify-center">
                                    <p className="text-muted-foreground">Your camera feed would be here</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Public Chat</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-64 border rounded-lg p-4" ref={publicChatAreaRef}>
                                    <div className="space-y-4">
                                        {publicChat.map((msg) => (
                                             <div key={msg.id} className="flex items-start gap-3">
                                                <Avatar className="h-8 w-8"><AvatarFallback>{msg.user.charAt(0)}</AvatarFallback></Avatar>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">{msg.user}</p>
                                                    <p className="text-sm bg-muted p-2 rounded-lg">{msg.text}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
                                    <Input 
                                        placeholder="Simulate a buyer comment..." 
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                    />
                                    <Button type="submit"><Send className="h-4 w-4" /></Button>
                                </form>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Co-pilot Panel */}
                    <div className="lg:sticky lg:top-24">
                        <Card className="bg-primary/5 border-primary/20">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-primary"><Sparkles /> Co-Pilot Panel (Private)</CardTitle>
                                <CardDescription>Real-time AI suggestions will appear here.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[480px] pr-3 -mr-3">
                                    <div className="space-y-4">
                                        {isAnalyzing && (
                                             <div className="flex gap-4">
                                                <Skeleton className="h-10 w-10 rounded-full" />
                                                <div className="space-y-2 flex-1">
                                                    <Skeleton className="h-4 w-24" />
                                                    <Skeleton className="h-4 w-full" />
                                                    <Skeleton className="h-4 w-3/4" />
                                                    <Skeleton className="h-8 w-28" />
                                                </div>
                                            </div>
                                        )}
                                        {copilotSuggestions.map((s) => {
                                            const Icon = classificationIcons[s.classification] || BrainCircuit;
                                            return (
                                                <div key={s.id} className="flex gap-3 p-3 bg-card/60 rounded-lg border">
                                                    <div className="pt-1">
                                                        <Icon className="h-5 w-5 text-primary" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-primary">{s.classification}</p>
                                                        <p className="text-xs text-muted-foreground italic my-1">"{s.originalComment}"</p>
                                                        <p className="text-sm font-semibold mt-2">Whisper:</p>
                                                        <p className="text-sm text-foreground/90">{s.sellerWhisper}</p>
                                                        <Button size="sm" className="mt-3">{s.suggestedAction}</Button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {copilotSuggestions.length === 0 && !isAnalyzing && (
                                            <div className="text-center text-muted-foreground py-12">
                                                <p>Waiting for comments...</p>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </SellerLayout>
    );
}
