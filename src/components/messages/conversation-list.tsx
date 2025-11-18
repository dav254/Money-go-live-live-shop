
'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import type { Chat } from '@/lib/types';

interface ConversationListProps {
  chats: Chat[];
  selectedChat: Chat | null;
  onSelectChat: (chat: Chat) => void;
  isLoading: boolean;
}

export function ConversationList({ chats, selectedChat, onSelectChat, isLoading }: ConversationListProps) {
  return (
    <div className="hidden h-full w-full max-w-xs flex-col border-r bg-muted/20 md:flex">
      <div className="flex items-center gap-2 border-b p-3">
        <h2 className="font-headline text-xl font-bold">Messages</h2>
        {chats && <Badge>{chats.length}</Badge>}
      </div>
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search messages..." className="pl-9" />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {isLoading ? (
            <div className="p-3 text-sm text-muted-foreground">Loading conversations...</div>
          ) : (
            chats.map((chat) => {
              const otherParticipant = chat.otherParticipant;
              if (!otherParticipant) return null;

              return (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat)}
                  className={cn(
                    'flex items-start gap-3 p-3 text-left transition-colors hover:bg-accent',
                    selectedChat?.id === chat.id && 'bg-accent'
                  )}
                >
                  <Avatar className="h-8 w-8 border">
                    <AvatarImage src={otherParticipant.profilePictureUrl} alt={otherParticipant.fullName} />
                    <AvatarFallback>{otherParticipant.fullName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{otherParticipant.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {chat.lastMessageTimestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm text-muted-foreground pr-4">{chat.lastMessage}</p>
                      {/* {chat.unread > 0 && <Badge className="flex h-5 w-5 items-center justify-center p-0">{chat.unread}</Badge>} */}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
