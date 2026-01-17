
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import type { ChatMessage } from '@/lib/types';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Skeleton } from '../ui/skeleton';

interface LiveChatProps {
  streamId: string;
}

export function LiveChat({ streamId }: LiveChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const firestore = useFirestore();
  const { user } = useUser();

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

    await addDoc(collection(firestore, `liveSessions/${streamId}/chat`), {
      senderId: user.uid,
      senderName: user.displayName || 'Anonymous',
      messageText: newMessage.trim(),
      timestamp: serverTimestamp(),
    });
    setNewMessage('');
  };

  return (
      <div className="flex flex-col h-full bg-black border-l border-neutral-700">
        <div className="p-3 border-b border-neutral-700">
            <p className="text-neutral-400 text-sm font-semibold text-center">💬 Live Chat</p>
        </div>
        
        <ScrollArea className="flex-1" ref={scrollAreaRef}>
          <div className="space-y-4 p-3">
              {isLoading && (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-3/4" />
                  <Skeleton className="h-10 w-1/2 ml-auto" />
                </div>
              )}
              {messages?.map((msg) => (
                  <div key={msg.id} className="flex items-start gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback>{msg.senderName?.charAt(0) || 'A'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-bold">{msg.senderName}</p>
                        <p className="text-sm">{msg.messageText}</p>
                      </div>
                  </div>
              ))}
              {!isLoading && (!messages || messages.length === 0) && (
                  <p className="text-center text-sm text-muted-foreground pt-8">Be the first to comment!</p>
              )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-neutral-700">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={user ? "Say something..." : "Log in to chat"}
                    className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500 rounded-lg"
                    disabled={!user}
                />
                <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 flex-shrink-0" disabled={!user}>
                    <Send className="h-4 w-4" />
                </Button>
            </form>
        </div>
      </div>
  );
}
