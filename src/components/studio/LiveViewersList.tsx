'use client';

import React from 'react';
import { useMeeting } from '@videosdk.live/react-sdk';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Users, User } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

/**
 * Real-time list of viewers in a live session.
 * Used by sellers to see exactly who is watching by name.
 */
export function LiveViewersList() {
  const { participants } = useMeeting();
  
  // Convert map to array and filter out the local participant (the seller/host)
  const viewers = Array.from(participants.values()).filter(p => !p.local);

  return (
    <div className="flex flex-col h-full bg-black">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {viewers.length > 0 ? (
            viewers.map((viewer) => (
              <div key={viewer.id} className="flex items-center gap-3 animate-in fade-in slide-in-from-right-1 duration-300">
                <Avatar className="h-10 w-10 border border-white/10 shadow-lg">
                  <AvatarFallback className="bg-neutral-800 text-[10px] font-black uppercase text-neutral-400">
                    {viewer.displayName?.charAt(0) || <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate uppercase tracking-tight">
                    {viewer.displayName || 'Anonymous Buyer'}
                  </p>
                  <p className="text-[8px] font-black text-primary uppercase tracking-widest">Watching Live</p>
                </div>
                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6 opacity-30">
              <Users className="h-12 w-12 text-neutral-500 mb-4" />
              <p className="text-[10px] text-muted-foreground leading-tight uppercase font-black tracking-[0.2em]">Waiting for audience...</p>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-4 bg-neutral-900/50 border-t border-white/5 shrink-0">
         <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest text-center">
            TOTAL VIEWERS: {viewers.length}
         </p>
      </div>
    </div>
  );
}