'use client';

import React, { useEffect, useRef } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { ChatMessage } from '@/lib/types';
import { AnimatePresence, motion } from 'framer-motion';

interface LiveActivityFeedProps {
    liveSessionId: string | null;
}

export function LiveActivityFeed({ liveSessionId }: LiveActivityFeedProps) {
  const firestore = useFirestore();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const messagesQuery = useMemoFirebase(() => {
    if (!liveSessionId) return null;
    return query(
      collection(firestore, 'liveSessions', liveSessionId, 'chat'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
  }, [liveSessionId, firestore]);

  const { data: messages, isLoading } = useCollection<ChatMessage>(messagesQuery);
  
  // Auto-scroll to bottom
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      setTimeout(() => {
        viewport.scrollTop = viewport.scrollHeight;
      }, 100);
    }
  }, [messages]);


  return (
    <div className="flex flex-col h-full">
        <ScrollArea className="flex-1 -mr-4 pr-4" ref={scrollAreaRef}>
             <AnimatePresence>
                <div className="flex flex-col-reverse gap-2">
                    {messages && messages.map((message) => (
                        <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="flex items-start gap-2 p-2 bg-neutral-900/70 rounded-md backdrop-blur-sm"
                        >
                        <div>
                            <p className="text-xs font-bold text-primary">{message.senderName || 'Anonymous'}</p>
                            <p className="text-sm text-neutral-200">{message.messageText}</p>
                        </div>
                        </motion.div>
                    ))}
                </div>
            </AnimatePresence>
            {(isLoading || !messages || messages.length === 0) && (
                <div className="flex h-full items-center justify-center text-center text-sm text-neutral-500">
                    <p>{isLoading ? "Loading chat..." : "Waiting for activity..."}</p>
                </div>
            )}
        </ScrollArea>
    </div>
  );
}