'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

interface FloatingChatOverlayProps {
  streamId: string;
  className?: string;
}

/**
 * A dynamic, non-stagnant chat overlay for live sessions.
 * Messages "rise" from the bottom and expire after a set time.
 */
export function FloatingChatOverlay({ streamId, className }: FloatingChatOverlayProps) {
  const firestore = useFirestore();
  const [activeMessages, setActiveMessages] = useState<any[]>([]);

  // We only care about the very latest messages for the floating overlay
  const messagesQuery = React.useMemo(() => {
    if (!firestore || !streamId) return null;
    return query(
      collection(firestore, `liveSessions/${streamId}/chat`),
      orderBy('timestamp', 'desc'),
      limit(5) 
    );
  }, [firestore, streamId]);

  const { data: messages } = useCollection(messagesQuery);

  // Sync server messages to local state with a 'life' timer
  useEffect(() => {
    if (messages && messages.length > 0) {
      const now = Date.now();
      
      setActiveMessages(prev => {
        // Map current server messages to local state with birth timestamps
        const synced = [...messages].reverse().map(m => {
          // If message already exists in state, keep its original birth timestamp
          const existing = prev.find(p => p.id === m.id);
          return {
            ...m,
            addedAt: existing ? existing.addedAt : now
          };
        });
        return synced;
      });
    }
  }, [messages]);

  // Every second, remove messages that have lived longer than 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setActiveMessages(prev => prev.filter(m => now - m.addedAt < 8000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={cn("pointer-events-none flex flex-col justify-end p-4 h-[320px] w-full", className)}>
      <div className="flex flex-col gap-2 max-w-[280px] sm:max-w-xs">
        <AnimatePresence initial={false} mode="popLayout">
          {activeMessages.map((msg: any) => (
            <motion.div
              key={msg.id}
              layout // Automatically animates the position change when items above/below are removed
              initial={{ opacity: 0, y: 30, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.9, transition: { duration: 0.5 } }}
              transition={{ 
                layout: { type: "spring", stiffness: 500, damping: 40, mass: 1 },
                opacity: { duration: 0.2 }
              }}
              className="flex items-start gap-2"
            >
              <div className="bg-black/30 backdrop-blur-2xl border border-white/10 rounded-2xl px-3 py-1.5 flex items-start gap-2 shadow-2xl ring-1 ring-white/5">
                <Avatar className="h-5 w-5 border border-white/10 mt-0.5 shrink-0 shadow-lg">
                  <AvatarImage src={msg.senderAvatar} />
                  <AvatarFallback className="bg-neutral-800 text-[8px] font-black uppercase">
                    {msg.senderName?.charAt(0) || <User className="h-3 w-3" />}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-primary uppercase tracking-tight leading-none mb-0.5 drop-shadow-md">
                    {msg.senderName}
                  </p>
                  <p className="text-white text-xs font-medium leading-tight break-words drop-shadow-sm">
                    {msg.messageText}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
