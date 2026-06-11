'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, User, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import type { AdminChatMessage } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { askAdminAI } from '@/ai/flows/admin-chat-flow';
import { useToast } from '@/hooks/use-toast';

/**
 * LIGHTWEIGHT ADMIN AI CHAT
 * Optimized for speed and robustness.
 */
export default function AIChatPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Limited query for "light" initial load
  const messagesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'admins', user.uid, 'adminChat'), 
        orderBy('timestamp', 'asc'),
        limit(50)
    );
  }, [user, firestore]);

  const { data: messages, isLoading } = useCollection<AdminChatMessage>(messagesQuery);
  const [input, setInput] = useState('');
  const [isResponding, setIsResponding] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const messageText = input.trim();
    if (!messageText || !user || !firestore) return;

    setInput('');
    setIsResponding(true);

    const chatCollection = collection(firestore, 'admins', user.uid, 'adminChat');

    try {
        // 1. Store User Message
        await addDoc(chatCollection, {
            text: messageText,
            sender: 'user',
            timestamp: serverTimestamp(),
        });

        // 2. Request AI Response
        const aiResponseText = await askAdminAI(messageText);

        // 3. Store AI Response with safety fallback
        const finalResponse = (aiResponseText && aiResponseText.trim() !== '') 
            ? aiResponseText 
            : "The model returned an empty signal. Please try rephrasing.";

        await addDoc(chatCollection, {
            text: finalResponse,
            sender: 'ai',
            timestamp: serverTimestamp(),
        });

    } catch (error: any) {
        console.error("AI chat crash:", error);
        toast({
            variant: 'destructive',
            title: 'SIGNAL ERROR',
            description: 'AI core returned a non-zero exit code.'
        });
        
        // Log failure to chat UI
        await addDoc(chatCollection, {
            text: `[SYSTEM ERROR]: Could not reach AI core. Details: ${error.message || 'Unknown Handshake Failure'}`,
            sender: 'ai',
            timestamp: serverTimestamp(),
        });
    } finally {
        setIsResponding(false);
    }
  };

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isResponding]);

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
        <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full overflow-hidden">
            <Card className="h-full flex flex-col border-white/5 bg-neutral-900/50 shadow-2xl rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-white/5 border-b border-white/5 flex flex-row items-center justify-between">
                <CardTitle className="font-headline text-lg uppercase tracking-widest flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  Go-AI Assistant
                </CardTitle>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">Active Signal</span>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden pt-6">
                <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
                  <div className="space-y-6">
                    {isLoading && !messages && (
                        <div className="space-y-4">
                            <Skeleton className="h-16 w-3/4 rounded-2xl" />
                            <Skeleton className="h-16 w-3/4 ml-auto rounded-2xl" />
                        </div>
                    )}
                    
                    {messages?.map((msg) => (
                      <div key={msg.id} className={cn("flex items-start gap-3", msg.sender === 'user' ? 'justify-end' : 'justify-start')}>
                        {msg.sender === 'ai' && (
                           <Avatar className="h-9 w-9 border border-primary/20 bg-primary/10">
                            <AvatarFallback className="bg-transparent text-primary"><Bot size={18} /></AvatarFallback>
                          </Avatar>
                        )}
                        <div className={cn(
                            "max-w-[85%] rounded-[1.5rem] px-5 py-3 text-sm font-medium leading-relaxed shadow-xl", 
                            msg.sender === 'user' 
                                ? 'bg-primary text-white border-primary rounded-tr-none' 
                                : 'bg-neutral-800 text-neutral-200 border border-white/5 rounded-tl-none'
                        )}>
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                         {msg.sender === 'user' && (
                           <Avatar className="h-9 w-9 border border-white/10">
                            <AvatarFallback className="bg-neutral-800 text-[10px] font-black uppercase">AD</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))}
                    
                    {isResponding && (
                         <div className="flex items-start gap-3 justify-start animate-in fade-in slide-in-from-bottom-2">
                            <Avatar className="h-9 w-9 border border-primary/20 bg-primary/10">
                                <AvatarFallback className="bg-transparent text-primary"><Bot size={18} /></AvatarFallback>
                            </Avatar>
                            <div className="max-w-[200px] rounded-2xl px-5 py-3 bg-neutral-800 border border-white/5 rounded-tl-none flex items-center gap-3">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Thinking...</span>
                            </div>
                         </div>
                    )}
                    
                    {!isLoading && messages?.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-32 text-center opacity-30">
                            <Sparkles className="h-12 w-12 text-primary mb-4" />
                            <p className="font-black uppercase tracking-widest text-[10px]">Begin the AI Analysis Loop</p>
                        </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="pt-6 mt-auto border-t border-white/5">
                    <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-3">
                    <div className="flex-1 relative">
                        <Input
                            placeholder="Analyze platform performance..."
                            className="w-full h-14 bg-black/40 border-white/5 rounded-2xl px-6 font-bold text-sm focus-visible:ring-primary transition-all"
                            autoComplete="off"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={isResponding}
                        />
                    </div>
                    <Button 
                        type="submit" 
                        size="icon" 
                        className="h-14 w-14 rounded-2xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 shrink-0" 
                        disabled={isResponding || !input.trim()}
                    >
                        {isResponding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </Button>
                    </form>
                    <p className="text-[8px] font-black text-neutral-600 uppercase tracking-widest mt-4 text-center">
                        Secure AI Protocol • Data Syncing from Global Nodes
                    </p>
                </div>
              </CardContent>
            </Card>
        </div>
      </div>
    </AdminLayout>
  );
}