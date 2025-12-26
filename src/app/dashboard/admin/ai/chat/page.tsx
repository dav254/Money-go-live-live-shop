
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import type { AdminChatMessage } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { askAdminAI } from '@/ai/flows/admin-chat-flow';
import { useToast } from '@/hooks/use-toast';

export default function AIChatPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const messagesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'admins', user.uid, 'adminChat'), orderBy('timestamp', 'asc'));
  }, [user, firestore]);

  const { data: messages, isLoading } = useCollection<AdminChatMessage>(messagesQuery);
  const [input, setInput] = useState('');
  const [isResponding, setIsResponding] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const userMessageText = input;
    setInput(''); // Clear input immediately
    setIsResponding(true);

    const chatCollection = collection(firestore, 'admins', user.uid, 'adminChat');

    // Store the user's message first
    const userMessage: Omit<AdminChatMessage, 'id'> = {
      text: userMessageText,
      sender: 'user',
      timestamp: serverTimestamp() as any,
    };
    await addDoc(chatCollection, userMessage);
    
    try {
        const aiResponseText = await askAdminAI(userMessageText);

        // **FIX:** Check for null or empty response from the AI
        const responseToSave = aiResponseText && aiResponseText.trim() !== ''
            ? aiResponseText
            : "I'm sorry, I couldn't find an answer to that. Please try rephrasing your question.";

        // Store the AI's (or fallback) response
        const aiResponse: Omit<AdminChatMessage, 'id'> = {
            text: responseToSave,
            sender: 'ai',
            timestamp: serverTimestamp() as any,
        };
        await addDoc(chatCollection, aiResponse);

    } catch (error) {
        console.error("AI chat error:", error);
        toast({
            variant: 'destructive',
            title: 'AI Error',
            description: 'I could not process your request. Please try again.'
        });
        // Add a more descriptive error message to the chat
        const errorResponse: Omit<AdminChatMessage, 'id'> = {
            text: "Sorry, I encountered an error and couldn't respond. The technical details have been logged.",
            sender: 'ai',
            timestamp: serverTimestamp() as any,
        };
        await addDoc(chatCollection, errorResponse);
    } finally {
        setIsResponding(false);
    }
  };

  useEffect(() => {
    // Scroll to the bottom when messages are loaded or new messages are added
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isResponding]);


  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex-1 p-4 md:p-8">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="font-headline text-2xl flex items-center gap-3">
                  <Bot className="text-primary" />
                  AI Assistant Chat
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                <ScrollArea className="flex-1 pr-4 -mr-4" ref={scrollAreaRef}>
                  <div className="space-y-6">
                    {isLoading && (
                        <div className="space-y-4">
                            <Skeleton className="h-12 w-3/4" />
                            <Skeleton className="h-12 w-3/4 ml-auto" />
                        </div>
                    )}
                    {messages?.map((msg) => (
                      <div key={msg.id} className={cn("flex items-start gap-3", msg.sender === 'user' ? 'justify-end' : '')}>
                        {msg.sender === 'ai' && (
                           <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                            <AvatarFallback><Bot size={18} /></AvatarFallback>
                          </Avatar>
                        )}
                        <div className={cn("max-w-md rounded-xl px-4 py-3 text-sm shadow", msg.sender === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card border rounded-bl-none')}>
                          <p>{msg.text}</p>
                        </div>
                         {msg.sender === 'user' && (
                           <Avatar className="h-8 w-8">
                            <AvatarFallback><User size={18} /></AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))}
                    {isResponding && (
                         <div className="flex items-start gap-3 justify-start">
                            <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                                <AvatarFallback><Bot size={18} /></AvatarFallback>
                            </Avatar>
                            <div className="max-w-md rounded-xl px-4 py-3 text-sm shadow bg-card border rounded-bl-none">
                                <p className="animate-pulse">Thinking...</p>
                            </div>
                         </div>
                    )}
                  </div>
                </ScrollArea>
                <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2 pt-4 border-t">
                  <Input
                    id="message"
                    placeholder="Ask me anything about your platform..."
                    className="flex-1"
                    autoComplete="off"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isResponding}
                  />
                  <Button type="submit" size="icon" disabled={isResponding}>
                    <Send className="h-4 w-4" />
                    <span className="sr-only">Send</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
