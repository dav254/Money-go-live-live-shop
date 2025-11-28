
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

export default function AIChatPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const messagesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'admins', user.uid, 'adminChat'), orderBy('timestamp', 'asc'));
  }, [user, firestore]);

  const { data: messages, isLoading } = useCollection<AdminChatMessage>(messagesQuery);
  const [input, setInput] = useState('');

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const userMessage: Omit<AdminChatMessage, 'id'> = {
      text: input,
      sender: 'user',
      timestamp: serverTimestamp() as any,
    };
    
    // For now, we mock the AI response immediately for a better user experience.
    // In a real scenario, this would come from a backend flow.
    const aiResponse: Omit<AdminChatMessage, 'id'> = {
      text: `I have stored your message: "${input}". Let's continue building our plan. What is the next step?`,
      sender: 'ai',
      timestamp: serverTimestamp() as any,
    };

    const chatCollection = collection(firestore, 'admins', user.uid, 'adminChat');
    
    // Add both messages to Firestore
    await addDoc(chatCollection, userMessage);
    await addDoc(chatCollection, aiResponse);
    
    setInput('');
  };

  useEffect(() => {
    // Scroll to the bottom when messages are loaded or new messages are added
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight });
    }
  }, [messages]);


  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex-1 p-4 md:p-8">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="font-headline text-2xl flex items-center gap-3">
                  <Bot className="text-primary" />
                  My Memory & Planning
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
                  </div>
                </ScrollArea>
                <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2 pt-4 border-t">
                  <Input
                    id="message"
                    placeholder="Type your plans here..."
                    className="flex-1"
                    autoComplete="off"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <Button type="submit" size="icon">
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
