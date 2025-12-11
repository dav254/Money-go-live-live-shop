
'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingBag, Heart, UserPlus, Gift, Zap } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';

const eventIcons: { [key: string]: React.ReactNode } = {
  purchase: <ShoppingBag className="h-4 w-4 text-green-400" />,
  like: <Heart className="h-4 w-4 text-red-400" />,
  follow: <UserPlus className="h-4 w-4 text-blue-400" />,
  deal: <Zap className="h-4 w-4 text-yellow-400" />,
  giveaway: <Gift className="h-4 w-4 text-pink-400" />,
};

interface LiveShoppingEventFeedProps {
    liveSessionId: string | null;
}

export function LiveShoppingEventFeed({ liveSessionId }: LiveShoppingEventFeedProps) {
  const firestore = useFirestore();

  const eventsQuery = useMemoFirebase(() => {
    if (!liveSessionId) return null;
    return query(
      collection(firestore, 'liveSessions', liveSessionId, 'events'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
  }, [liveSessionId, firestore]);

  const { data: events, isLoading } = useCollection(eventsQuery);

  return (
    <div className="flex flex-col h-full">
        <ScrollArea className="flex-1 -mr-4 pr-4">
            <AnimatePresence>
            {events && events.map((event) => (
                <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                transition={{ duration: 0.5 }}
                className="mb-2 flex items-start gap-3 p-2 bg-neutral-900/70 rounded-md backdrop-blur-sm"
                >
                <div className="mt-1">{eventIcons[event.type as keyof typeof eventIcons]}</div>
                <p className="text-sm text-neutral-200">{event.text}</p>
                </motion.div>
            ))}
            </AnimatePresence>
            {(isLoading || !events || events.length === 0) && (
                <div className="text-center text-sm text-neutral-500 pt-8">
                    {isLoading ? "Loading activity..." : "Waiting for activity..."}
                </div>
            )}
        </ScrollArea>
    </div>
  );
}
