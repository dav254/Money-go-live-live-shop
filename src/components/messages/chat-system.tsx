

'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs, orderBy, limit, startAfter, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import type { Chat, UserProfile } from '@/lib/types';
import { ConversationList } from './conversation-list';
import { ChatWindow } from './chat-window';
import { useSearchParams } from 'next/navigation';
import { useUserProfile } from '@/firebase/auth/use-user-profile';

const CHAT_PAGE_SIZE = 25;

export function ChatSystem() {
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const searchParams = useSearchParams();

  const [allChats, setAllChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [participants, setParticipants] = useState<UserProfile[]>([]);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = userProfile?.userRole === 'admin';

  const fetchChats = useCallback(async (loadMore = false) => {
    if (!firestore || !user) return;

    setIsLoading(true);

    let chatsQuery;
    if (isAdmin) {
      chatsQuery = query(
        collection(firestore, 'chats'),
        orderBy('lastMessageTimestamp', 'desc'),
        limit(CHAT_PAGE_SIZE)
      );
    } else {
      chatsQuery = query(
        collection(firestore, 'chats'),
        where('participantIds', 'array-contains', user.uid),
        orderBy('lastMessageTimestamp', 'desc'),
        limit(CHAT_PAGE_SIZE)
      );
    }

    if (loadMore && lastVisible) {
      chatsQuery = query(chatsQuery, startAfter(lastVisible));
    }
    
    try {
        const querySnapshot = await getDocs(chatsQuery);
        const fetchedChats = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
        
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setHasMore(fetchedChats.length === CHAT_PAGE_SIZE);

        if (loadMore) {
            setAllChats(prev => [...prev, ...fetchedChats]);
        } else {
            setAllChats(fetchedChats);
        }

        const participantIds = new Set<string>();
        fetchedChats.forEach(chat => {
            chat.participantIds.forEach(id => {
                if (id !== user.uid) {
                  participantIds.add(id);
                }
            });
        });
        
        if (participantIds.size > 0) {
            const usersQuery = query(collection(firestore, 'userProfiles'), where('id', 'in', Array.from(participantIds)));
            const usersSnapshot = await getDocs(usersQuery);
            const fetchedParticipants = usersSnapshot.docs.map(doc => doc.data() as UserProfile);
            setParticipants(prev => {
                const existingIds = new Set(prev.map(p => p.id));
                const newParticipants = fetchedParticipants.filter(p => !existingIds.has(p.id));
                return [...prev, ...newParticipants];
            });
        }
    } catch (error) {
        console.error("Error fetching chats:", error);
    } finally {
        setIsLoading(false);
    }
  }, [firestore, user, lastVisible, isAdmin]);

  useEffect(() => {
    if(user && firestore) {
      fetchChats();
    }
  }, [user, firestore, isAdmin]); // Re-fetch if admin status changes


  const chatsWithParticipants = useMemo(() => {
    if (!allChats || !participants || !user) return [];
    
    return allChats
      .filter(chat => isAdmin || !chat.deletedFor?.includes(user.uid)) // Filter out deleted chats for non-admins
      .map(chat => {
        const otherParticipantId = chat.participantIds.find(id => id !== user.uid);
        const otherParticipant = participants.find(p => p.id === otherParticipantId);
        return { ...chat, otherParticipant };
      });

  }, [allChats, participants, user, isAdmin]);
  
  useEffect(() => {
    const chatWithId = searchParams.get('chatWith');
    if (chatWithId && chatsWithParticipants.length > 0) {
      const chatToSelect = chatsWithParticipants.find(c => c.participantIds.includes(chatWithId));
      if (chatToSelect) {
        setSelectedChat(chatToSelect);
      }
    }
  }, [searchParams, chatsWithParticipants]);


  const handleChatDeleted = () => {
      setSelectedChat(null);
      // Refetch the initial list after a deletion
      setLastVisible(null);
      fetchChats();
  }

  return (
    <div className="flex h-full border-t">
      <ConversationList
        chats={chatsWithParticipants}
        selectedChat={selectedChat}
        onSelectChat={setSelectedChat}
        isLoading={isLoading}
        loadMore={() => fetchChats(true)}
        hasMore={hasMore}
      />
      <ChatWindow
        chat={selectedChat}
        currentUser={user}
        onChatDeleted={handleChatDeleted}
      />
    </div>
  );
}
