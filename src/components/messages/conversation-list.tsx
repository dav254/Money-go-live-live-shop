'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Search, Loader2, Circle } from 'lucide-react';
import type { Chat } from '@/lib/types';
import { useUser } from '@/firebase';

interface ConversationListProps {
  chats: Chat[];
  selectedChat: Chat | null;
  onSelectChat: (chat: Chat) => void;
  isLoading: boolean;
}

export function ConversationList({ chats, selectedChat, onSelectChat, isLoading }: ConversationListProps) {
  const { user } = useUser();

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="p-4 sm:p-6 border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="font-black text-lg sm:text-xl uppercase tracking-tighter">Messages</h2>
            {chats.length > 0 && <Badge className="rounded-full h-5 px-2 bg-primary/20 text-primary border-none">{chats.length}</Badge>}
        </div>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input placeholder="Search people..." className="pl-10 h-10 rounded-xl bg-background/50 border-white/5 text-sm" />
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading && chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-30">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest">Scanning Network...</p>
            </div>
          ) : chats.length > 0 ? (
            chats.map((chat) => {
              const otherParticipant = chat.otherParticipant;
              if (!otherParticipant) return null;
              const isActive = selectedChat?.id === chat.id;
              
              // Online status logic
              const isOnline = otherParticipant.lastSeen ? (Date.now() - otherParticipant.lastSeen.toMillis() < 120000) : false;

              return (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat)}
                  className={cn(
                    'w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl transition-all duration-300 relative group',
                    isActive ? 'bg-primary shadow-xl shadow-primary/20 text-white' : 'hover:bg-white/5 text-neutral-400'
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className={cn("h-10 w-10 sm:h-12 sm:w-12 border-2 transition-all", isActive ? "border-white/50 scale-105" : "border-white/5 group-hover:border-primary/30")}>
                        <AvatarImage src={otherParticipant.profilePictureUrl} />
                        <AvatarFallback className="bg-neutral-800 font-bold">{otherParticipant.fullName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 sm:h-3 sm:w-3 border-2 border-background rounded-full", isOnline ? "bg-green-500" : "bg-neutral-500")} />
                  </div>
                  
                  <div className="flex-1 overflow-hidden text-left min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={cn("font-bold text-sm truncate uppercase tracking-tight", isActive ? "text-white" : "text-foreground")}>
                        {otherParticipant.fullName}
                      </p>
                      {chat.lastMessageTimestamp && (
                        <span className={cn("text-[8px] font-bold uppercase shrink-0 ml-2", isActive ? "text-white/60" : "text-muted-foreground/50")}>
                          {chat.lastMessageTimestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className={cn("text-xs truncate font-medium", isActive ? "text-white/80" : "text-muted-foreground")}>
                        {chat.lastMessage}
                    </p>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6 opacity-30">
                <Circle className="h-12 w-12 text-neutral-500 mb-4" />
                <p className="text-[10px] text-muted-foreground leading-tight uppercase font-black tracking-widest">No active chats found</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}