'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, getDoc, addDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
      // Normalise the two array fields as the documents are read.
      //
      // A chat document is not guaranteed to carry `participantIds`/`deletedFor`
      // — older records, and any chat created outside the app that only wrote
      // the participants into the message payload, omit them. This loop used to
      // call `chat.participantIds.forEach` directly, so the first snapshot that
      // contained such a document threw "Cannot read properties of undefined"
      // inside the snapshot callback. Because that callback only runs on the
      // client once real data arrives, the server-rendered page looked perfect
      // and the screen then crashed wholesale.
      //
      // Normalising at the single point where documents enter state means every
      // consumer below — this loop, the filter in `chatsWithParticipants`, the
      // `chatWith` lookup — can read the fields without guarding each one.
      const fetchedChats = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          participantIds: Array.isArray(data.participantIds) ? data.participantIds : [],
          deletedFor: Array.isArray(data.deletedFor) ? data.deletedFor : [],
        } as Chat;
      });
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
  
  /*
   * `?chatWith=<uid>` must OPEN the conversation even when no chat document
   * exists yet — a seller tapping "Chat with Buyer" on a first order has
   * nothing to find in the loaded list, and the old code only selected from
   * that list, so the button silently did nothing. Mirror the buyer app:
   * find the chat (even one I previously deleted, which must be un-deleted
   * or it stays invisible to me), or create it, then select it.
   */
  const openingChatRef = useRef<string | null>(null);
  useEffect(() => {
    // `useSearchParams` can hand back null outside a Suspense boundary.
    const chatWithId = searchParams?.get('chatWith');
    if (!firestore || !user || !chatWithId || chatWithId === user.uid) return;
    if (selectedChat || openingChatRef.current === chatWithId) return;

    const existing = allChats.find(c => c.participantIds.includes(chatWithId));
    if (existing) {
      if (existing.deletedFor?.includes(user.uid)) {
        // Reopening a chat I deleted must clear the flag, or the other side
        // keeps seeing a conversation I can no longer reach from my list.
        setDoc(doc(firestore, 'chats', existing.id), { deletedFor: [] }, { merge: true }).catch(() => undefined);
      }
      setSelectedChat(existing);
      return;
    }

    // Wait for the first snapshot before creating: until chats have loaded we
    // do not know whether the conversation already exists.
    if (isLoading) return;

    openingChatRef.current = chatWithId;
    (async () => {
      try {
        const chatRef = await addDoc(collection(firestore, 'chats'), {
          participantIds: [user.uid, chatWithId],
          deletedFor: [],
          unreadCounts: {},
          lastMessage: '',
          lastMessageTimestamp: serverTimestamp(),
        });
        setSelectedChat({
          id: chatRef.id,
          participantIds: [user.uid, chatWithId],
          deletedFor: [],
          unreadCounts: {},
          lastMessage: '',
        } as Chat);
      } catch (error) {
        console.error('Could not open the conversation:', error);
        // Allow a retry on the next effect run.
        openingChatRef.current = null;
      }
    })();
  }, [firestore, user, isLoading, searchParams, allChats, selectedChat]);

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
    <div className="flex h-full w-full overflow-hidden bg-background">
      <div className={cn(
        "flex-shrink-0 border-r bg-muted/5 transition-all duration-300 overflow-hidden flex flex-col z-10", 
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
        "flex-1 flex flex-col transition-all duration-300 overflow-hidden z-0 relative",
        !selectedChat ? "hidden md:flex" : "flex h-full"
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
