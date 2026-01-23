'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingBag, Heart, UserPlus, Gift, Zap } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

const simulatedEvents = [
    { id: 1, type: 'like', text: 'Sarah liked the video' },
    { id: 2, type: 'follow', text: 'Ben just followed you' },
    { id: 3, type: 'purchase', text: 'Amina just bought this item!' },
    { id: 4, type: 'deal', text: 'Tip: Announce a flash sale to create urgency.' },
    { id: 5, type: 'giveaway', text: 'Tip: Mention a giveaway to boost engagement.' },
];

const eventIcons: { [key: string]: React.ReactNode } = {
  purchase: <ShoppingBag className="h-4 w-4 text-green-400" />,
  like: <Heart className="h-4 w-4 text-red-400" />,
  follow: <UserPlus className="h-4 w-4 text-blue-400" />,
  deal: <Zap className="h-4 w-4 text-yellow-400" />,
  giveaway: <Gift className="h-4 w-4 text-pink-400" />,
};

interface LiveActivityFeedProps {
    liveSessionId?: string | null; // Made optional
}

export function LiveActivityFeed({ liveSessionId }: LiveActivityFeedProps) {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    // Simulate events appearing one by one for the demo
    const interval = setInterval(() => {
      setEvents(prevEvents => {
        if (prevEvents.length >= simulatedEvents.length) {
          return prevEvents;
        }
        const nextEvent = simulatedEvents[prevEvents.length];
        return [...prevEvents, nextEvent];
      });
    }, 5000); // Add a new event every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full">
        <ScrollArea className="flex-1 -mr-4 pr-4">
            <AnimatePresence>
            {events.map((event) => (
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
            {events.length === 0 && (
                <div className="text-center text-sm text-neutral-500 pt-8">
                    Waiting for activity...
                </div>
            )}
        </ScrollArea>
    </div>
  );
}
