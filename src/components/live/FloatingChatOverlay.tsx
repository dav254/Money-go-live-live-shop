'use client';

import React, { useRef, useEffect } from 'react';
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

export function FloatingChatOverlay({ streamId, className }: FloatingChatOverlayProps) {
  const firestore = useFirestore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const messagesQuery = React.useMemo(() => {
    if (!firestore || !streamId) return null;
    return query(
      collection(firestore, `liveSessions/${streamId}/chat`),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
  }, [firestore, streamId]);

  const { data: messages } = useCollection(messagesQuery);

  // Reverse messages to show oldest at top, newest at bottom for the overlay
  const displayMessages = React.useMemo(() => {
    return [...(messages || [])].reverse();
  }, [messages]);

  return (
    <div className={cn("pointer-events-none flex flex-col justify-end gap-2 p-4", className)}>
      <div className="flex flex-col gap-2 max-w-[280px] sm:max-w-xs">
        <AnimatePresence initial={false}>
          {displayMessages.map((msg: any) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: -20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-start gap-2"
            >
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl px-3 py-1.5 flex items-start gap-2 shadow-2xl">
                <Avatar className="h-5 w-5 border border-white/10 mt-0.5 shrink-0">
                  <AvatarImage src={msg.senderAvatar} />
                  <AvatarFallback className="bg-neutral-800 text-[8px]"><User className="h-3 w-3" /></AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-primary uppercase tracking-tight leading-none mb-0.5">
                    {msg.senderName}
                  </p>
                  <p className="text-white text-xs font-medium leading-tight break-words">
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
