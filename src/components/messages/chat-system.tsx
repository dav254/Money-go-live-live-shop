
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import type { Chat, UserProfile } from '@/lib/types';
import { ConversationList } from './conversation-list';
import { ChatWindow } from './chat-window';
import { useSearchParams } from 'next/navigation';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { cn } from '@/lib/utils';

export function ChatSystem() {
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const searchParams = useSearchParams();

  const [allChats, setAllChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [participants, setParticipants] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = userProfile?.userRole === 'admin';

  useEffect(() => {
    if (!firestore || !user) return;

    setIsLoading(true);

    let chatsQuery;
    if (isAdmin) {
      chatsQuery = query(
        collection(firestore, 'chats'),
        orderBy('lastMessageTimestamp', 'desc')
      );
    } else {
      chatsQuery = query(
        collection(firestore, 'chats'),
        where('participantIds', 'array-contains', user.uid)
      );
    }

    const unsubscribeChats = onSnapshot(chatsQuery, async (querySnapshot) => {
      const fetchedChats = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      setAllChats(fetchedChats);

      const participantIds = new Set<string>();
      fetchedChats.forEach(chat => {
        chat.participantIds.forEach(id => {
            if (id !== user.uid) {
              participantIds.add(id);
            }
        });
      });

      if (participantIds.size > 0) {
        const participantIdChunks = Array.from(participantIds).reduce((acc, item, i) => {
            const chunkIndex = Math.floor(i / 30);
            if (!acc[chunkIndex]) acc[chunkIndex] = [];
            acc[chunkIndex].push(item);
            return acc;
        }, [] as string[][]);

        const participantPromises = participantIdChunks.map(chunk =>
            getDocs(query(collection(firestore, 'userProfiles'), where('id', 'in', chunk)))
        );
        
        const participantSnapshots = await Promise.all(participantPromises);
        const fetchedParticipants = participantSnapshots.flatMap(snapshot =>
            snapshot.docs.map(doc => doc.data() as UserProfile)
        );

        setParticipants(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newParticipants = fetchedParticipants.filter(p => !existingIds.has(p.id));
            return [...prev, ...newParticipants];
        });
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching chats in real-time:", error);
      setIsLoading(false);
    });

    return () => unsubscribeChats();

  }, [firestore, user, isAdmin]);

  const chatsWithParticipants = useMemo(() => {
    if (!allChats || !participants || !user) return [];
    
    return allChats
      .filter(chat => isAdmin || !chat.deletedFor?.includes(user.uid))
      .map(chat => {
        const otherParticipantId = chat.participantIds.find(id => id !== user.uid);
        const otherParticipant = participants.find(p => p.id === otherParticipantId);
        return { ...chat, otherParticipant };
      })
      .sort((a, b) => (b.lastMessageTimestamp?.toMillis() || 0) - (a.lastMessageTimestamp?.toMillis() || 0));

  }, [allChats, participants, user, isAdmin]);
  
  useEffect(() => {
    const chatWithId = searchParams.get('chatWith');
    if (chatWithId && chatsWithParticipants.length > 0 && !selectedChat) {
      const chatToSelect = chatsWithParticipants.find(c => c.participantIds.includes(chatWithId));
      if (chatToSelect) {
        setSelectedChat(chatToSelect);
      }
    }
  }, [searchParams, chatsWithParticipants, selectedChat]);

  const handleChatDeleted = () => {
    if(selectedChat) {
      setAllChats(prev => prev.filter(c => c.id !== selectedChat.id));
      setSelectedChat(null);
    }
  };

  const handleBack = () => {
    setSelectedChat(null);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-background">
      <div className={cn(
        "flex-shrink-0 border-r bg-muted/5 transition-all duration-300 overflow-hidden flex flex-col", 
        selectedChat ? "hidden md:flex md:w-80" : "w-full md:w-80"
      )}>
        <ConversationList
            chats={chatsWithParticipants}
            selectedChat={selectedChat}
            onSelectChat={setSelectedChat}
            isLoading={isLoading}
        />
      </div>
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300 overflow-hidden",
        !selectedChat ? "hidden md:flex" : "flex"
      )}>
        <ChatWindow
            chat={selectedChat}
            currentUser={user}
            onChatDeleted={handleChatDeleted}
            onBack={handleBack}
        />
      </div>
    </div>
  );
}
