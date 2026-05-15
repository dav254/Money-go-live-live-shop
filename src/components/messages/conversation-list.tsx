
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
    <div className="flex h-full w-full flex-col bg-background overflow-hidden">
      <div className="px-4 py-4 border-b border-white/5 shrink-0 bg-card/20">
        <div className="flex items-center justify-between mb-3 overflow-hidden">
            <h2 className="font-black text-base uppercase tracking-tighter truncate">Messages</h2>
            {chats.length > 0 && (
              <Badge className="rounded-full h-4 px-1.5 bg-primary/20 text-primary border-none text-[9px] shrink-0 font-black">
                {chats.length}
              </Badge>
            )}
        </div>
        <div className="relative group">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Search network..." 
            className="pl-8 h-8 rounded-lg bg-background/50 border-white/5 text-[12px] placeholder:text-muted-foreground/30" 
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="px-2 py-2 space-y-0.5">
          {isLoading && chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 opacity-30">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p className="text-[9px] font-black uppercase tracking-widest text-center">SYNCING...</p>
            </div>
          ) : chats.length > 0 ? (
            chats.map((chat) => {
              const otherParticipant = chat.otherParticipant;
              if (!otherParticipant) return null;
              const isActive = selectedChat?.id === chat.id;
              
              // Online status logic: active within last 2 minutes
              const isOnline = otherParticipant.lastSeen ? (Date.now() - otherParticipant.lastSeen.toMillis() < 120000) : false;

              // Unread count for current user
              const unreadCount = user ? (chat.unreadCounts?.[user.uid] || 0) : 0;

              return (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat)}
                  className={cn(
                    'w-full flex items-center gap-2.5 p-2.5 rounded-xl transition-all duration-300 relative group text-left min-w-0 border border-transparent',
                    isActive ? 'bg-primary shadow-xl shadow-primary/20 text-white border-primary/20' : 'hover:bg-white/5 text-neutral-400'
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className={cn(
                      "h-9 w-9 border-2 transition-all", 
                      isActive ? "border-white/40 scale-105" : "border-white/5 group-hover:border-primary/20"
                    )}>
                        <AvatarImage src={otherParticipant.profilePictureUrl} />
                        <AvatarFallback className="bg-neutral-800 font-bold text-[10px]">{otherParticipant.fullName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 border-2 border-background rounded-full", 
                      isOnline ? "bg-green-500" : "bg-neutral-500"
                    )} />
                  </div>
                  
                  <div className="flex-1 overflow-hidden min-w-0">
                    <div className="flex items-center justify-between mb-0.5 overflow-hidden">
                      <p className={cn(
                        "font-black text-[12px] truncate uppercase tracking-tight leading-none", 
                        isActive ? "text-white" : "text-foreground"
                      )}>
                        {otherParticipant.fullName}
                      </p>
                      {chat.lastMessageTimestamp && (
                        <span className={cn(
                          "text-[8px] font-black uppercase shrink-0 ml-1.5 opacity-40", 
                          isActive ? "text-white/60" : "text-muted-foreground"
                        )}>
                          {chat.lastMessageTimestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className={cn(
                        "text-[11px] truncate font-medium leading-none flex-1", 
                        isActive ? "text-white/80" : "text-muted-foreground/70",
                        unreadCount > 0 && !isActive && "text-foreground font-black"
                        )}>
                            {chat.lastMessage || 'Start a conversation'}
                        </p>
                        {unreadCount > 0 && !isActive && (
                            <Badge className="rounded-full h-4 min-w-[1rem] px-1 bg-red-600 text-white border-none text-[8px] font-black animate-bounce shrink-0 shadow-lg shadow-red-600/20">
                                {unreadCount}
                            </Badge>
                        )}
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4 opacity-20">
                <Circle className="h-10 w-10 text-neutral-500 mb-3" />
                <p className="text-[9px] text-muted-foreground leading-tight uppercase font-black tracking-[0.2em]">INBOX EMPTY</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
