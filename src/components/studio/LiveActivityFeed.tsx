
'use client';

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingBag, Heart, UserPlus } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

const eventIcons = {
  purchase: <ShoppingBag className="h-4 w-4 text-green-400" />,
  like: <Heart className="h-4 w-4 text-red-400" />,
  follow: <UserPlus className="h-4 w-4 text-blue-400" />,
};

const sampleEvents = [
  { type: 'purchase', text: 'Jane D. just bought the Classic Handbag!' },
  { type: 'follow', text: 'Mike K. started following you.' },
  { type: 'purchase', text: 'Ben O. just placed an order for Urban Sneakers!' },
  { type: 'like', text: 'Amina K. liked your live stream.' },
  { type: 'purchase', text: 'Chris P. purchased the NextGen Smartphone.' },
];

export function LiveActivityFeed() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    // Simulate receiving a new event every 5 seconds
    const interval = setInterval(() => {
      const randomEvent = sampleEvents[Math.floor(Math.random() * sampleEvents.length)];
      const newEvent = {
        id: Date.now(),
        ...randomEvent,
      };
      setEvents(prev => [newEvent, ...prev].slice(0, 20)); // Keep the list to a max of 20 items
    }, 5000);

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
                className="mb-2 flex items-start gap-3 p-2 bg-neutral-900/70 rounded-md"
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
