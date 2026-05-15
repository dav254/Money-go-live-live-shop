'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, MessageSquare, ShieldCheck, User, Loader2 } from 'lucide-react';
import { useCollection, useFirestore, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, doc, where } from 'firebase/firestore';
import type { ChatMessage, UserProfile, LiveSession } from '@/lib/types';
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

  const sessionRef = React.useMemo(() => {
    if (!firestore || !streamId) return null;
    return doc(firestore, 'liveSessions', streamId);
  }, [firestore, streamId]);

  const { data: session } = useDoc<LiveSession>(sessionRef);

  useEffect(() => {
      if (session?.status !== 'live') {
          setOptimisticMessages([]);
          setNewMessage('');
      }
  }, [session?.status, session?.startTime]);

  useEffect(() => {
    if (user && firestore) {
        const fetchProfile = async () => {
            const snap = await (await import('firebase/firestore')).getDoc(doc(firestore, 'userProfiles', user.uid));
            if (snap.exists()) setUserData(snap.data() as UserProfile);
        };
        fetchProfile();
    }
  }, [user, firestore]);

  const messagesQuery = React.useMemo(() => {
    if (!firestore || !streamId || !session?.startTime || session.status !== 'live') return null;
    return query(
        collection(firestore, `liveSessions/${streamId}/chat`), 
        where('timestamp', '>=', session.startTime),
        orderBy('timestamp', 'asc')
    );
  }, [firestore, streamId, session?.startTime, session?.status]);

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
    if (!newMessage.trim() || !firestore || !streamId || !user || session?.status !== 'live') return;

    const identifiedName = userData?.shopName || userData?.fullName || user.displayName || 'Member';
    const messageText = newMessage.trim();
    
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
        id: tempId,
        senderId: user.uid,
        senderName: identifiedName,
        senderAvatar: userData?.profilePictureUrl || user.photoURL || '',
        messageText: messageText,
        senderRole: userData?.userRole || 'buyer',
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
            senderRole: userData?.userRole || 'buyer',
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

  if (session?.status !== 'live') {
      return (
          <div className="flex flex-col h-full items-center justify-center p-6 text-center bg-black">
              <div className="p-3 rounded-full bg-white/5 border border-white/10 mb-3">
                <MessageSquare className="h-8 w-8 text-neutral-800" />
              </div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">
                  {session?.status === 'ended' ? 'SHOW CONCLUDED' : 'PREVIEW MODE'}
              </p>
              <p className="text-[11px] text-neutral-700 font-medium mt-1">Live interaction is currently inactive.</p>
          </div>
      );
  }

  const allMessages = [...(serverMessages || []), ...optimisticMessages];

  return (
      <div className="flex flex-col h-full bg-black">
        <div className="p-3 border-b border-white/5 flex items-center justify-between bg-neutral-950/50">
            <div className="text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                Live Chat
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-green-500/5 border border-green-500/10">
                <ShieldCheck className="h-3 w-3 text-green-500/60" />
                <span className="text-[8px] font-black text-green-500/60 uppercase tracking-tighter">SECURED</span>
            </div>
        </div>
        
        <ScrollArea className="flex-1" ref={scrollAreaRef}>
          <div className="space-y-3 p-3">
              {isLoading && allMessages.length === 0 && (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-2">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-8 flex-1 rounded-lg" />
                    </div>
                  ))}
                </div>
              )}
              {allMessages.map((msg: any) => {
                  const isProvider = msg.senderRole === 'seller' || msg.senderRole === 'admin';
                  const alignRight = !isProvider; 

                  return (
                    <div key={msg.id} className={cn("flex flex-col group", alignRight ? "items-end" : "items-start", msg.isSending && "opacity-70")}>
                        <div className={cn("flex max-w-[90%] gap-1.5", alignRight ? "flex-row-reverse text-right" : "flex-row text-left")}>
                            <Avatar className="h-6 w-6 border border-white/5 shrink-0 shadow-md">
                                <AvatarImage src={msg.senderAvatar} />
                                <AvatarFallback className="bg-neutral-800 text-[8px]"><User className="h-2.5 w-2.5" /></AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <button 
                                    onClick={() => handleReply(msg.senderName)}
                                    className="text-[9px] font-black text-neutral-500 uppercase tracking-tight hover:text-primary transition-colors truncate block mb-0.5"
                                >
                                    {msg.senderName}
                                </button>
                                <p className={cn(
                                    "text-[12px] leading-tight p-2 rounded-xl border shadow-sm break-words overflow-hidden",
                                    alignRight 
                                        ? "bg-primary text-primary-foreground border-primary rounded-tr-none" 
                                        : "bg-white/5 text-neutral-300 border-white/5 rounded-tl-none"
                                )} style={{ overflowWrap: 'anywhere' }}>
                                    {msg.messageText}
                                </p>
                            </div>
                        </div>
                    </div>
                  );
              })}
          </div>
        </ScrollArea>

        <div className="p-2 sm:p-3 border-t border-white/5 bg-neutral-950">
            <form onSubmit={handleSendMessage} className="flex items-center gap-1.5">
                <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={user ? "Type..." : "Login to chat"}
                    className="bg-neutral-900 border-white/5 text-white rounded-lg h-9 text-xs focus-visible:ring-primary px-3"
                    disabled={!user || session?.status !== 'live'}
                />
                <Button type="submit" size="icon" className="bg-primary rounded-lg h-9 w-9 shrink-0 border-none" disabled={!user || !newMessage.trim() || session?.status !== 'live'}>
                    <Send className="h-3.5 w-3.5" />
                </Button>
            </form>
        </div>
      </div>
  );
}
