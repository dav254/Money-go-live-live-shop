'use client';

import React, { useState } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
}

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hello! This is our private space. How can I help you plan the future of Go Earn today?", sender: 'ai' }
  ]);
  const [input, setInput] = useState('');

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      text: input,
      sender: 'user',
    };

    // Here you would typically send the message to the AI backend
    // For now, we'll just mock a response.
    const aiResponse: Message = {
      id: Date.now() + 1,
      text: `I have stored your message: "${input}". Let's continue building our plan. What is the next step?`,
      sender: 'ai',
    };

    setMessages(prev => [...prev, userMessage, aiResponse]);
    setInput('');
  };

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
                <ScrollArea className="flex-1 pr-4 -mr-4">
                  <div className="space-y-6">
                    {messages.map((msg) => (
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
