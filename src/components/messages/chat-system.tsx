'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Chat, UserProfile } from '@/lib/types';
import { useChats } from '@/lib/chat/use-chat';
import { patchChat, openChat } from '@/lib/chat/client';
import { ConversationList } from './conversation-list';
import { ChatWindow } from './chat-window';
import { useSearchParams } from 'next/navigation';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { cn } from '@/lib/utils';

/**
 * WEBSITE · INBOX.
 *
 * Conversations come from the VPS store (`useChats` → `/api/chat`), polled and
 * refreshed on focus — this screen no longer opens a Firestore listener on the
 * `chats` collection. Participant profiles still come from `userProfiles`,
 * which is account data, not message data.
 *
 * Every chat document that enters state is normalised (`participantIds` /
 * `deletedFor` default to `[]`), because a chat created outside the app may
 * omit them and reading them unguarded is what used to crash this screen.
 */
export function ChatSystem() {
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const searchParams = useSearchParams();

  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [participants, setParticipants] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = userProfile?.userRole === 'admin';

  const {
    chats: liveChats,
    isLoading: chatsLoading,
    error: chatsError,
    refresh: refreshChats,
  } = useChats({ scope: isAdmin ? 'all' : 'mine' });

  /*
   * Profiles change far less often than chats, so they are fetched once per
   * unknown participant and cached for the life of the screen.
   *
   * This callback is driven by an async participant lookup, so a single
   * rejected `getDocs` (network blip, or a rules denial on one chunk) must not
   * abort the rest of the update. Before this guard, the rejection escaped the
   * `await` and `setIsLoading(false)` never ran — the inbox sat on "SYNCING…"
   * forever, which reads exactly like "my messages vanished". A failed lookup
   * now falls back to whatever profiles are already cached, and the inbox
   * still renders.
   */
  const knownProfilesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!firestore || !user || chatsLoading) return;
    let alive = true;

    const wanted = new Set<string>();
    liveChats.forEach((chat) => {
      chat.participantIds.forEach((id) => {
        if (id !== user.uid && !knownProfilesRef.current.has(id)) wanted.add(id);
      });
    });
    if (wanted.size === 0) {
      setIsLoading(false);
      return;
    }

    const participantIdChunks = Array.from(wanted).reduce((acc, item, i) => {
      const chunkIndex = Math.floor(i / 30);
      if (!acc[chunkIndex]) acc[chunkIndex] = [];
      acc[chunkIndex].push(item);
      return acc;
    }, [] as string[][]);

    (async () => {
      const participantPromises = participantIdChunks.map((chunk) =>
        getDocs(query(collection(firestore, 'userProfiles'), where('id', 'in', chunk))),
      );

      let fetchedParticipants: UserProfile[] = [];
      try {
        const participantSnapshots = await Promise.all(participantPromises);
        fetchedParticipants = participantSnapshots.flatMap((snapshot) =>
          snapshot.docs.map((doc) => doc.data() as UserProfile),
        );
      } catch (error) {
        console.error('Could not load conversation participants:', error);
      }

      if (!alive) return;
      fetchedParticipants.forEach((profile) => knownProfilesRef.current.add(profile.id));

      setParticipants((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newParticipants = fetchedParticipants.filter((p) => !existingIds.has(p.id));
        return newParticipants.length ? [...prev, ...newParticipants] : prev;
      });
      setIsLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [firestore, user, liveChats, chatsLoading]);

  const chatsWithParticipants = useMemo(() => {
    if (!liveChats || !participants || !user) return [];

    return liveChats
      .filter((chat) => isAdmin || !chat.deletedFor?.includes(user.uid))
      .map((chat) => {
        const otherParticipantId = chat.participantIds.find((id) => id !== user.uid);
        const otherParticipant = participants.find((p) => p.id === otherParticipantId);
        return { ...chat, otherParticipant };
      })
      .sort(
        (a, b) =>
          (b.lastMessageTimestamp?.toMillis() || 0) - (a.lastMessageTimestamp?.toMillis() || 0),
      );
  }, [liveChats, participants, user, isAdmin]);

  /*
   * `?chatWith=<uid>` must OPEN the conversation even when no chat exists yet —
   * a seller tapping "Chat with Buyer" on a first order has nothing to find in
   * the loaded list, and the old code only selected from that list, so the
   * button silently did nothing. Mirror the buyer app: find the chat (even one
   * I previously deleted, which must be un-deleted or it stays invisible to
   * me), or create it, then select it.
   */
  const openingChatRef = useRef<string | null>(null);
  useEffect(() => {
    // `useSearchParams` can hand back null outside a Suspense boundary.
    const chatWithId = searchParams?.get('chatWith');
    if (!user || !chatWithId || chatWithId === user.uid) return;
    if (selectedChat || openingChatRef.current === chatWithId) return;

    const existing = liveChats.find((c) => c.participantIds.includes(chatWithId));
    if (existing) {
      if (existing.deletedFor?.includes(user.uid)) {
        // Reopening a chat I deleted must clear MY flag — and only mine, which
        // is why this is an API action rather than a write to a shared field.
        patchChat(user, existing.id, 'restore').catch(() => undefined);
      }
      setSelectedChat(existing);
      return;
    }

    // Wait for the first load before creating: until chats have loaded we do
    // not know whether the conversation already exists.
    if (chatsLoading || isLoading) return;

    openingChatRef.current = chatWithId;
    openChat(user, chatWithId)
      .then((chat) => setSelectedChat(chat))
      .catch((error) => {
        console.error('Could not open the conversation:', error);
        // Allow a retry on the next effect run.
        openingChatRef.current = null;
      });
  }, [user, searchParams, liveChats, selectedChat, chatsLoading, isLoading]);

  const handleChatDeleted = () => {
    setSelectedChat(null);
    // The row leaves the inbox now rather than at the next poll tick.
    refreshChats();
  };

  const handleBack = () => {
    setSelectedChat(null);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <div
        className={cn(
          'flex-shrink-0 border-r bg-muted/5 transition-all duration-300 overflow-hidden flex flex-col z-10',
          selectedChat ? 'hidden md:flex md:w-80' : 'w-full md:w-80',
        )}
      >
        {chatsError && (
          <p className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-destructive">
            {chatsError}
          </p>
        )}
        <ConversationList
          chats={chatsWithParticipants}
          selectedChat={selectedChat}
          onSelectChat={setSelectedChat}
          isLoading={isLoading}
        />
      </div>
      <div
        className={cn(
          'flex-1 flex flex-col transition-all duration-300 overflow-hidden z-0 relative',
          !selectedChat ? 'hidden md:flex' : 'flex h-full',
        )}
      >
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
