
'use client';

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingBag, Heart, UserPlus, Gift, Zap } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, Timestamp } from 'firebase/firestore';

const eventIcons: { [key: string]: React.ReactNode } = {
  purchase: <ShoppingBag className="h-4 w-4 text-green-400" />,
  like: <Heart className="h-4 w-4 text-red-400" />,
  follow: <UserPlus className="h-4 w-4 text-blue-400" />,
  deal: <Zap className="h-4 w-4 text-yellow-400" />,
  giveaway: <Gift className="h-4 w-4 text-pink-400" />,
};

interface LiveActivityFeedProps {
    liveSessionId: string | null;
}

// A simple in-memory event bus for the frontend-only simulation
const localEventBus = {
    listeners: [] as ((event: any) => void)[],
    subscribe(callback: (event: any) => void) {
        this.listeners.push(callback);
    },
    unsubscribe(callback: (event: any) => void) {
        this.listeners = this.listeners.filter(l => l !== callback);
    },
    emit(event: any) {
        this.listeners.forEach(l => l(event));
    }
};

// Export the emit function so other components can trigger local events
export const emitLocalEvent = (event: any) => {
    localEventBus.emit({
        id: `local-${Date.now()}`,
        timestamp: Timestamp.now(),
        ...event
    });
};


export function LiveActivityFeed({ liveSessionId }: LiveActivityFeedProps) {
  const firestore = useFirestore();
  const [localEvents, setLocalEvents] = useState<any[]>([]);

  // Firestore-backed events for real sessions
  const eventsQuery = useMemoFirebase(() => {
    if (!liveSessionId || liveSessionId.startsWith('mock_')) return null; // Don't query for mock sessions
    return query(
      collection(firestore, 'liveSessions', liveSessionId, 'events'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
  }, [liveSessionId, firestore]);
  const { data: firestoreEvents, isLoading } = useCollection(eventsQuery);

  // Effect for handling local (simulated) events
  useEffect(() => {
    // Only listen to local events if we are in a mock session
    if (liveSessionId && liveSessionId.startsWith('mock_')) {
      const handleNewEvent = (event: any) => {
        setLocalEvents(prev => [event, ...prev].slice(0, 20));
      };
      localEventBus.subscribe(handleNewEvent);
      return () => localEventBus.unsubscribe(handleNewEvent);
    } else {
        // Clear local events if we switch to a real session
        setLocalEvents([]);
    }
  }, [liveSessionId]);

  const events = liveSessionId?.startsWith('mock_') ? localEvents : firestoreEvents;

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
