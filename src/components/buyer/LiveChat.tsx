'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, MessageSquare, ShieldCheck, User, Reply, Loader2 } from 'lucide-react';
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

  // Subscribe to the live session to monitor startTime for fresh-start filtering
  const sessionRef = React.useMemo(() => {
    if (!firestore || !streamId) return null;
    return doc(firestore, 'liveSessions', streamId);
  }, [firestore, streamId]);

  const { data: session } = useDoc<LiveSession>(sessionRef);

  // FRESH START: Clear optimistic messages if the session startTime changes (meaning a new show began)
  useEffect(() => {
      setOptimisticMessages([]);
  }, [session?.startTime]);

  useEffect(() => {
    if (user && firestore) {
        const fetchProfile = async () => {
            const snap = await (await import('firebase/firestore')).getDoc(doc(firestore, 'userProfiles', user.uid));
            if (snap.exists()) setUserData(snap.data() as UserProfile);
        };
        fetchProfile();
    }
  }, [user, firestore]);

  // FRESH START FILTER: Only show messages sent after the current show's startTime
  const messagesQuery = React.useMemo(() => {
    if (!firestore || !streamId || !session?.startTime || session.status === 'ended') return null;
    return query(
        collection(firestore, `liveSessions/${streamId}/chat`), 
        where('timestamp', '>=', session.startTime),
        orderBy('timestamp', 'asc')
    );
  }, [firestore, streamId, session?.startTime, session?.status]);

  const { data: serverMessages, isLoading } = useCollection<ChatMessage>(messagesQuery);

  // Clear optimistic messages once server messages are received
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

  // If the show has ended, chats "vanish" by being hidden from the UI
  if (session?.status === 'ended') {
      return (
          <div className="flex flex-col h-full items-center justify-center p-8 text-center opacity-40">
              <MessageSquare className="h-12 w-12 mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">Show Concluded</p>
          </div>
      );
  }

  const allMessages = [...(serverMessages || []), ...optimisticMessages];

  return (
      <div className="flex flex-col h-full bg-black">
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-neutral-950/50">
            <p className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="h-3 w-3 text-primary" /> 
                Live Chat
            </p>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/20">
                <ShieldCheck className="h-3 w-3 text-green-500" />
                <span className="text-[8px] font-bold text-green-500 uppercase tracking-tighter">Secure</span>
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
              {allMessages.map((msg: any) => {
                  const isProvider = msg.senderRole === 'seller' || msg.senderRole === 'admin';
                  const alignRight = !isProvider; 

                  return (
                    <div key={msg.id} className={cn("flex flex-col group", alignRight ? "items-end" : "items-start", msg.isSending && "opacity-70")}>
                        <div className={cn("flex max-w-[85%] gap-2", alignRight ? "flex-row-reverse text-right" : "flex-row text-left")}>
                            <Avatar className="h-7 w-7 border border-white/10 shrink-0 shadow-lg">
                                <AvatarImage src={msg.senderAvatar} />
                                <AvatarFallback className="bg-neutral-800 text-[10px]"><User className="h-3 w-3" /></AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className={cn("flex items-center gap-2 mb-0.5", alignRight ? "flex-row-reverse" : "flex-row")}>
                                    <button 
                                        onClick={() => handleReply(msg.senderName)}
                                        className="text-[10px] font-black text-neutral-500 uppercase tracking-tight hover:text-primary transition-colors truncate"
                                    >
                                        {msg.senderName}
                                    </button>
                                </div>
                                <p className={cn(
                                    "text-sm leading-tight p-2.5 rounded-2xl border shadow-sm",
                                    alignRight 
                                        ? "bg-primary text-primary-foreground border-primary rounded-tr-none" 
                                        : "bg-white/5 text-neutral-200 border-white/5 rounded-tl-none"
                                )}>
                                    {msg.messageText}
                                </p>
                            </div>
                        </div>
                    </div>
                  );
              })}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-white/10 bg-neutral-950">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={user ? "Say something..." : "Login to chat"}
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