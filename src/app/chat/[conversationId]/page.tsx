'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Send, Loader2, MessageSquare, ShieldCheck, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/lib/types';
import { SellerLayout } from '@/components/layout/seller-layout';
import { BuyerLayout } from '@/components/layout/buyer-layout';

export default function ConversationPage(props: { params: Promise<{ conversationId: string }> }) {
  const params = use(props.params);
  const conversationId = params.conversationId;
  const router = useRouter();
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const [newMessage, setNewMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const Layout = userProfile?.userRole === 'seller' ? SellerLayout : BuyerLayout;

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !conversationId) return null;
    return query(
      collection(firestore, 'conversations', conversationId, 'messages'),
      orderBy('timestamp', 'asc')
    );
  }, [firestore, conversationId]);

  const { data: messages, isLoading } = useCollection<ChatMessage>(messagesQuery);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !firestore) return;

    const messageText = newMessage;
    setNewMessage('');

    try {
      await addDoc(collection(firestore, 'conversations', conversationId, 'messages'), {
        senderId: user.uid,
        text: messageText,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Chat error:", error);
      setNewMessage(messageText);
    }
  };

  if (isLoading) {
    return (
      <Layout fullWidth>
        <div className="flex h-screen items-center justify-center bg-black">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout fullWidth>
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-black">
        <div className="flex items-center gap-4 border-b border-white/10 p-4 bg-neutral-950/50 backdrop-blur-xl">
          <Button variant="ghost" size="icon" className="rounded-full text-white" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/20">
                <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-black text-sm uppercase tracking-tight text-white">Deal Negotiation</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="h-3 w-3 text-green-500" />
                <span className="text-[8px] font-black uppercase text-green-500 tracking-widest">Secured by Go Earn</span>
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-6 max-w-4xl mx-auto py-8">
            {messages?.map((msg) => {
              const isMe = msg.senderId === user?.uid;
              return (
                <div key={msg.id} className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm font-medium leading-relaxed shadow-xl border",
                    isMe 
                      ? "bg-primary text-white border-primary rounded-tr-none" 
                      : "bg-neutral-900 text-neutral-200 border-white/5 rounded-tl-none"
                  )}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <p className={cn(
                      "text-[8px] font-black uppercase mt-1.5 opacity-50 tracking-widest",
                      isMe ? "text-right" : "text-left"
                    )}>
                      {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                    </p>
                  </div>
                </div>
              );
            })}
            {(!messages || messages.length === 0) && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-30 grayscale">
                  <User className="h-12 w-12 text-primary" />
                  <p className="font-black uppercase tracking-tighter text-xl">The conversation starts here.</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 bg-neutral-950 border-t border-white/10">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="bg-neutral-900 border-white/5 text-white h-14 rounded-2xl px-6 focus-visible:ring-primary"
            />
            <Button type="submit" size="icon" className="h-14 w-14 rounded-2xl bg-primary hover:bg-primary/90 shrink-0" disabled={!newMessage.trim()}>
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
