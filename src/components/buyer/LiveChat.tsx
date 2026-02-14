
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, MessageSquare, ShieldCheck, User } from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import type { ChatMessage, UserProfile } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Skeleton } from '../ui/skeleton';

interface LiveChatProps {
  streamId: string;
}

export function LiveChat({ streamId }: LiveChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const firestore = useFirestore();
  const { user } = useUser();

  useEffect(() => {
    if (user && firestore) {
        getDoc(doc(firestore, 'userProfiles', user.uid)).then(snap => {
            if (snap.exists()) setUserData(snap.data() as UserProfile);
        });
    }
  }, [user, firestore]);

  const messagesQuery = React.useMemo(() => {
    if (!firestore || !streamId) return null;
    return query(collection(firestore, `liveSessions/${streamId}/chat`), orderBy('timestamp', 'asc'));
  }, [firestore, streamId]);

  const { data: messages, isLoading } = useCollection<ChatMessage>(messagesQuery);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !firestore || !streamId || !user) return;

    // Use identified name from profile or fallback to display name, then generic title.
    const identifiedName = userData?.shopName || userData?.fullName || user.displayName || 'Verified User';

    const messageData = {
      senderId: user.uid,
      senderName: identifiedName,
      senderAvatar: userData?.profilePictureUrl || user.photoURL || '',
      messageText: newMessage.trim(),
      timestamp: serverTimestamp(),
    };

    await addDoc(collection(firestore, `liveSessions/${streamId}/chat`), messageData);
    setNewMessage('');
  };

  return (
      <div className="flex flex-col h-full bg-black">
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-neutral-950/50">
            <p className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="h-3 w-3 text-primary" /> 
                Live Engagement
            </p>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/20">
                <ShieldCheck className="h-3 w-3 text-green-500" />
                <span className="text-[8px] font-bold text-green-500 uppercase tracking-tighter">Identified</span>
            </div>
        </div>
        
        <ScrollArea className="flex-1" ref={scrollAreaRef}>
          <div className="space-y-4 p-4">
              {isLoading && (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-2">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-10 flex-1 rounded-lg" />
                    </div>
                  ))}
                </div>
              )}
              {messages?.map((msg: any) => (
                  <div key={msg.id} className="flex items-start gap-2 group">
                      <Avatar className="h-7 w-7 border border-white/10">
                        <AvatarImage src={msg.senderAvatar} />
                        <AvatarFallback className="bg-neutral-800 text-[10px]"><User className="h-3 w-3" /></AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-tight mb-0.5 group-hover:text-primary transition-colors">{msg.senderName}</p>
                        <p className="text-sm text-neutral-200 leading-tight bg-white/5 p-2 rounded-lg rounded-tl-none border border-white/5">{msg.messageText}</p>
                      </div>
                  </div>
              ))}
              {!isLoading && (!messages || messages.length === 0) && (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                      <MessageSquare className="h-10 w-10 text-neutral-500 mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Waiting for engagement...</p>
                  </div>
              )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-white/10 bg-neutral-950">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={user ? "Reply to buyers..." : "Log in to chat"}
                    className="bg-neutral-900 border-white/5 text-white placeholder:text-neutral-600 rounded-xl h-11"
                    disabled={!user}
                />
                <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 rounded-xl h-11 w-11 shrink-0" disabled={!user || !newMessage.trim()}>
                    <Send className="h-4 w-4" />
                </Button>
            </form>
        </div>
      </div>
  );
}
