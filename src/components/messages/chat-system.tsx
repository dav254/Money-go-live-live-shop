
'use client';

import React, { useState, useMemo } from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Chat, ChatMessage, UserProfile } from '@/lib/types';
import { ConversationList } from './conversation-list';
import { ChatWindow } from './chat-window';

export function ChatSystem() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  const chatsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'chats'), where('participantIds', 'array-contains', user.uid));
  }, [firestore, user]);

  const { data: chats, isLoading: isLoadingChats } = useCollection<Chat>(chatsQuery);

  const participantIds = useMemo(() => {
    if (!chats || !user) return [];
    const ids = new Set<string>();
    chats.forEach(chat => {
      // Don't fetch profiles for chats the user has deleted
      if (chat.deletedFor?.includes(user.uid)) {
          return;
      }
      chat.participantIds.forEach(id => {
        if (id !== user.uid) {
          ids.add(id);
        }
      });
    });
    return Array.from(ids);
  }, [chats, user]);

  const usersQuery = useMemoFirebase(() => {
    if (participantIds.length === 0) return null;
    return query(collection(firestore, 'userProfiles'), where('id', 'in', participantIds));
  }, [firestore, participantIds]);

  const { data: participants, isLoading: isLoadingParticipants } = useCollection<UserProfile>(usersQuery);

  const chatsWithParticipants = useMemo(() => {
    if (!chats || !participants || !user) return [];
    
    return chats
      .filter(chat => !chat.deletedFor?.includes(user.uid)) // Filter out deleted chats
      .map(chat => {
        const otherParticipantId = chat.participantIds.find(id => id !== user.uid);
        const otherParticipant = participants.find(p => p.id === otherParticipantId);
        return { ...chat, otherParticipant };
      });

  }, [chats, participants, user]);
  
  const handleChatDeleted = () => {
      setSelectedChat(null);
      // The useCollection hook will automatically refetch and update the list
  }


  return (
    <div className="flex h-[calc(100vh-4rem)] border-t">
      <ConversationList
        chats={chatsWithParticipants}
        selectedChat={selectedChat}
        onSelectChat={setSelectedChat}
        isLoading={isLoadingChats || isLoadingParticipants}
      />
      <ChatWindow
        chat={selectedChat}
        currentUser={user}
        onChatDeleted={handleChatDeleted}
      />
    </div>
  );
}
