
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, MessageSquare, ShieldCheck, User, Reply, Loader2 } from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import type { ChatMessage, UserProfile } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';

interface LiveChatProps {
  streamId: string;
}

export function LiveChat({ streamId }: LiveChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([]);
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

  const { data: serverMessages, isLoading } = useCollection<ChatMessage>(messagesQuery);

  useEffect(() => {
    if (serverMessages) setOptimisticMessages([]);
  }, [serverMessages]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [serverMessages, optimisticMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !firestore || !streamId || !user) return;

    const identifiedName = userData?.shopName || userData?.fullName || user.displayName || 'Member';
    const messageText = newMessage.trim();
    
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
        id: tempId,
        senderId: user.uid,
        senderName: identifiedName,
        senderAvatar: userData?.profilePictureUrl || user.photoURL || '',
        messageText: messageText,
        timestamp: new Date(),
        isSending: true
    };
    
    setOptimisticMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');

    try {
        await addDoc(collection(firestore, `liveSessions/${streamId}/chat`), {
            senderId: user.uid,
            senderName: identifiedName,
            senderAvatar: userData?.profilePictureUrl || user.photoURL || '',
            messageText: messageText,
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error("Failed to send message:", error);
        setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const handleReply = (userName: string) => {
    setNewMessage(prev => `@${userName} ${prev}`);
  };

  const allMessages = [...(serverMessages || []), ...optimisticMessages];

  return (
      <div className="flex flex-col h-full bg-black">
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-neutral-950/50">
            <p className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="h-3 w-3 text-primary" /> 
                Live Engagement
            </p>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/20">
                <ShieldCheck className="h-3 w-3 text-green-500" />
                <span className="text-[8px] font-bold text-green-500 uppercase tracking-tighter">Verified</span>
            </div>
        </div>
        
        <ScrollArea className="flex-1" ref={scrollAreaRef}>
          <div className="space-y-4 p-4">
              {isLoading && allMessages.length === 0 && (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-2">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-10 flex-1 rounded-lg" />
                    </div>
                  ))}
                </div>
              )}
              {allMessages.map((msg: any) => (
                  <div key={msg.id} className={cn("flex items-start gap-2 group transition-opacity", msg.isSending && "opacity-70")}>
                      <Avatar className="h-7 w-7 border border-white/10 shrink-0">
                        <AvatarImage src={msg.senderAvatar} />
                        <AvatarFallback className="bg-neutral-800 text-[10px]"><User className="h-3 w-3" /></AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <button 
                                onClick={() => handleReply(msg.senderName)}
                                className="text-[10px] font-black text-neutral-500 uppercase tracking-tight mb-0.5 hover:text-primary transition-colors text-left truncate"
                            >
                                {msg.senderName}
                            </button>
                            {msg.isSending ? (
                                <Loader2 className="h-2 w-2 animate-spin text-primary" />
                            ) : (
                                <button 
                                    onClick={() => handleReply(msg.senderName)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-neutral-500 hover:text-white"
                                >
                                    <Reply className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                        <p className="text-sm text-neutral-200 leading-tight bg-white/5 p-2 rounded-lg rounded-tl-none border border-white/5 shadow-sm">
                            {msg.messageText}
                        </p>
                      </div>
                  </div>
              ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-white/10 bg-neutral-950">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={user ? "Reply to buyers..." : "Log in to chat"}
                    className="bg-neutral-900 border-white/5 text-white rounded-xl h-11"
                    disabled={!user}
                />
                <Button type="submit" size="icon" className="bg-primary rounded-xl h-11 w-11 shrink-0" disabled={!user || !newMessage.trim()}>
                    <Send className="h-4 w-4" />
                </Button>
            </form>
        </div>
      </div>
  );
}
